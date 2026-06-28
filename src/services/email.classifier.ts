import type { EmailCategory } from '@/types'
import { domainOf, isBulkLocalPart, localPartOf } from '@/lib/categories'

/**
 * Deterministic, rule-based email classifier — the always-on backbone of inbox
 * categorisation. It never calls the network, so it works with zero API keys
 * and can't be a single point of failure. The AI layer only *refines* its
 * low-confidence (PRIMARY) results; a manual move overrides everything via a
 * learned CategoryRule, which this function honours ahead of every heuristic.
 *
 * Categories: PRIMARY · CLIENTS · SERVICES · PROMOTIONS · NEWSLETTERS · SPAM.
 */

export interface ClassificationSignals {
  senderEmail: string
  senderName: string
  subject: string
  /** Plain-text body of the representative (first inbound) message. */
  body: string
  /** Raw Gmail labelIds present on the thread, e.g. CATEGORY_PROMOTIONS, SPAM. */
  gmailLabels: string[]
  /** A `List-Unsubscribe` header was present — the canonical bulk-mail signal. */
  hasListUnsubscribe: boolean
  /** The user has sent at least one reply in this thread (two-way human contact). */
  hasUserReplied: boolean
}

/** A learned/custom routing rule (subset of the CategoryRule row). */
export interface ClassifierRule {
  matchType: string // 'email' | 'domain'
  value: string
  category: EmailCategory
}

export interface ClassificationResult {
  category: EmailCategory
  /** 'rules' (heuristics) or 'manual' (a learned/custom rule matched). */
  source: 'rules' | 'manual'
  /** 0..1 — below CONFIDENCE_FLOOR the result is the PRIMARY fallback. */
  confidence: number
  reason: string
}

/** Below this the classifier wasn't sure → PRIMARY, leaving room for AI to refine. */
export const CONFIDENCE_FLOOR = 0.4

type Scores = Record<EmailCategory, number>

function emptyScores(): Scores {
  return { PRIMARY: 0, CLIENTS: 0, SERVICES: 0, PROMOTIONS: 0, NEWSLETTERS: 0, SPAM: 0 }
}

// ── Keyword banks (English + Russian; service apps see a lot of both) ───────

const SERVICE_WORDS = [
  'invoice', 'receipt', 'payment', 'payout', 'transaction', 'billing', 'billed',
  'statement', 'subscription', 'renewal', 'renew', 'refund', 'order #', 'your order',
  'order confirmation', 'order number', 'paid', 'charged', 'purchase', 'shipping',
  'tracking number', 'delivery', 'verify your', 'verification code', 'reset your password',
  'счёт', 'счет', 'оплата', 'оплачен', 'платёж', 'платеж', 'квитанция', 'чек',
  'подписка', 'продление', 'возврат', 'заказ', 'доставка', 'покупка', 'транзакц',
]

const PROMO_WORDS = [
  'sale', '% off', 'discount', 'deal', 'deals', 'offer', 'limited time', 'coupon',
  'promo', 'promotion', 'save up to', 'save now', 'buy now', 'shop now', 'black friday',
  'cyber monday', 'flash sale', 'exclusive offer', 'new arrivals', 'best price',
  'free shipping', 'giveaway', 'last chance', 'don’t miss', 'dont miss',
  'скидка', 'распродажа', 'акция', 'выгодно', 'промокод', 'успей', 'дешевле', 'спецпредложение',
]

const NEWSLETTER_WORDS = [
  'newsletter', 'weekly digest', 'daily digest', 'roundup', 'this week', 'issue #',
  'edition', 'unsubscribe', 'view in browser', 'view this email in your browser',
  'you are receiving this', 'manage your preferences', 'дайджест', 'рассылка', 'выпуск',
]

const SPAM_WORDS = [
  'viagra', 'you have won', 'you won', 'winner', 'congratulations you', 'claim your prize',
  'lottery', 'nigerian prince', 'wire transfer', 'crypto investment', 'get rich',
  'work from home and earn', 'act now', 'risk free', 'this is not a scam',
  'million dollars', 'bitcoin doubler', 'hot singles', 'enlarge', 'cheap meds',
]

// Deliberately narrow: only deal/engagement-specific wording. Generic business
// words ("project", "meeting", "call", "follow up", "deadline") were removed —
// they litter newsletters, promos and personal mail and were the single biggest
// source of false CLIENTS. The relationship signal (a real two-way thread) does
// the heavy lifting for client detection; keywords only nudge human-looking mail.
const CLIENT_WORDS = [
  'proposal', 'quote', 'quotation', 'contract', 'agreement', 'scope of work',
  'statement of work', 'kickoff', 'onboarding', 'deliverable', 'invoice attached',
  'estimate', 'engagement', 'retainer', 'signed contract',
  'договор', 'предложение', 'смета', 'бриф', 'техзадание', 'тз ', 'счёт на оплату',
]

function hay(s: ClassificationSignals): string {
  return `${s.subject}\n${s.body}`.toLowerCase()
}

function countHits(text: string, words: string[]): { hits: number; first: string | null } {
  let hits = 0
  let first: string | null = null
  for (const w of words) {
    if (text.includes(w)) {
      hits++
      if (!first) first = w
    }
  }
  return { hits, first }
}

function lookupRule(rules: ClassifierRule[], email: string): ClassifierRule | null {
  const lower = email.toLowerCase()
  const domain = domainOf(lower)
  // Email-level rules are the most specific → check them first.
  const byEmail = rules.find((r) => r.matchType === 'email' && r.value === lower)
  if (byEmail) return byEmail
  const byDomain = rules.find((r) => r.matchType === 'domain' && r.value === domain)
  return byDomain ?? null
}

/**
 * Classify one email thread. `rules` are the user's learned/custom rules
 * (highest authority); pass [] when none.
 */
export function classifyEmail(
  signals: ClassificationSignals,
  rules: ClassifierRule[] = [],
): ClassificationResult {
  const senderEmail = (signals.senderEmail ?? '').trim().toLowerCase()
  const labels = new Set((signals.gmailLabels ?? []).map((l) => l.toUpperCase()))

  // 1. Learned / custom rule — overrides every heuristic.
  if (senderEmail) {
    const rule = lookupRule(rules, senderEmail)
    if (rule) {
      return {
        category: rule.category,
        source: 'manual',
        confidence: 1,
        reason: `Matched your rule for ${rule.matchType === 'domain' ? domainOf(senderEmail) : senderEmail}`,
      }
    }
  }

  // 2. Gmail's own classification (strong, free signal when present).
  if (labels.has('SPAM') || labels.has('JUNK')) {
    return { category: 'SPAM', source: 'rules', confidence: 0.97, reason: 'Flagged as spam by Gmail' }
  }

  const scores = emptyScores()
  const reasons: Partial<Record<EmailCategory, string>> = {}
  const bump = (cat: EmailCategory, by: number, why: string) => {
    scores[cat] += by
    if (!reasons[cat]) reasons[cat] = why
  }

  if (labels.has('CATEGORY_PROMOTIONS')) bump('PROMOTIONS', 0.55, 'Gmail tagged it Promotions')
  if (labels.has('CATEGORY_SOCIAL')) bump('PROMOTIONS', 0.3, 'Social-network notification')
  if (labels.has('CATEGORY_FORUMS')) bump('NEWSLETTERS', 0.4, 'Mailing-list / forum mail')
  if (labels.has('CATEGORY_UPDATES')) bump('SERVICES', 0.35, 'Gmail tagged it Updates')

  // 3. Header & sender-shape signals.
  const local = localPartOf(senderEmail)
  const bulkSender = isBulkLocalPart(local)
  if (signals.hasListUnsubscribe) {
    // Bulk mail. Whether it's a newsletter or a promo is decided by content below;
    // seed both, leaning newsletter (the header's primary meaning).
    bump('NEWSLETTERS', 0.45, 'Has a List-Unsubscribe header (bulk mail)')
    bump('PROMOTIONS', 0.2, 'Bulk-sent mail')
  }
  if (bulkSender) bump('SERVICES', 0.1, 'Automated sender address')

  // Does this plausibly read as a real person writing to you (not bulk /
  // marketing / social mail)? Computed BEFORE keyword scoring so that "client"
  // wording only counts for human-looking senders — the same generic business
  // words show up constantly in newsletters and promos.
  const looksHuman =
    !signals.hasListUnsubscribe &&
    !bulkSender &&
    !labels.has('CATEGORY_PROMOTIONS') &&
    !labels.has('CATEGORY_SOCIAL') &&
    !labels.has('CATEGORY_FORUMS')

  // 4. Content keywords.
  const text = hay(signals)
  const service = countHits(text, SERVICE_WORDS)
  const promo = countHits(text, PROMO_WORDS)
  const news = countHits(text, NEWSLETTER_WORDS)
  const spam = countHits(text, SPAM_WORDS)
  const client = countHits(text, CLIENT_WORDS)

  if (service.hits) bump('SERVICES', Math.min(0.6, 0.3 + service.hits * 0.12), `Mentions “${service.first}”`)
  if (promo.hits) bump('PROMOTIONS', Math.min(0.6, 0.25 + promo.hits * 0.12), `Mentions “${promo.first}”`)
  if (news.hits) bump('NEWSLETTERS', Math.min(0.55, 0.2 + news.hits * 0.12), `Reads like a newsletter (“${news.first}”)`)
  if (spam.hits) bump('SPAM', Math.min(0.95, 0.45 + spam.hits * 0.2), `Spam-like wording (“${spam.first}”)`)
  // CLIENTS keywords only count for human-looking mail — a bulk/marketing sender
  // never becomes a "client" on wording alone (the #1 false-positive source).
  if (client.hits && looksHuman) bump('CLIENTS', Math.min(0.5, 0.2 + client.hits * 0.12), `Business wording (“${client.first}”)`)

  // 5. Relationship signal — a real two-way human thread is a client/primary,
  //    never bulk. This is the strongest "this is a person" indicator we have.
  if (signals.hasUserReplied && looksHuman) {
    bump('CLIENTS', 0.65, 'You and this contact reply back and forth')
  } else if (looksHuman && signals.senderName && signals.senderName !== senderEmail) {
    // A named human you haven't replied to yet → important/primary.
    bump('PRIMARY', 0.5, 'Direct mail from a person')
  }

  // Pick the winner.
  let best: EmailCategory = 'PRIMARY'
  let bestScore = scores.PRIMARY
  for (const cat of Object.keys(scores) as EmailCategory[]) {
    if (scores[cat] > bestScore) {
      best = cat
      bestScore = scores[cat]
    }
  }

  if (bestScore < CONFIDENCE_FLOOR) {
    return {
      category: 'PRIMARY',
      source: 'rules',
      confidence: Math.max(0.2, bestScore),
      reason: 'No strong category signal — kept in Primary',
    }
  }

  return {
    category: best,
    source: 'rules',
    confidence: Math.min(1, bestScore),
    reason: reasons[best] ?? 'Matched category heuristics',
  }
}
