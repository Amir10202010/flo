import { contactActivityMap, isAwaitingReply, lastInboundAt, type Workspace } from './metrics.helpers'
import { waitDuration } from '@/lib/time'
import type { RiskLevel } from '@/types'

/**
 * Alert engine — pure rules over workspace data. No I/O.
 *
 * "Rules + AI scoring": several rules consume the Gemini analysis output
 * (riskLevel / sentiment / riskReasons / nextAction), so AI raises and explains
 * alerts while deterministic rules (reply SLAs, gone-quiet) guarantee coverage
 * even for unanalyzed threads. Every candidate carries a human-readable reason
 * and a suggested action — explainability is a hard requirement.
 *
 * dedupeScope keeps one alert per (rule, thread/contact); the scanner in
 * alert.service.ts owns persistence, dedupe and lifecycle.
 */

export interface AlertCandidate {
  /** Rule id — stable, used in the dedupe key. */
  type: 'ai-critical-risk' | 'ai-high-risk' | 'overdue-reply' | 'negative-sentiment' | 'gone-quiet'
  severity: RiskLevel
  conversationId: string | null
  /** Entity id the alert is deduped on (conversation or contact). */
  dedupeScope: string
  title: string
  reason: string
  suggestedAction: string | null
}

const OVERDUE_MEDIUM_HOURS = 24
const OVERDUE_HIGH_HOURS = 72
const QUIET_DAYS = 10
const QUIET_MIN_MSGS_28D = 3
const DAY_MS = 86_400_000

/**
 * Newsletters/notification senders must never raise "client" alerts — an
 * unanswered LinkedIn digest is not an overdue reply. Matched against the
 * contact's email and name.
 */
const AUTOMATED_SENDER_RE =
  /no-?reply|do-?not-?reply|notifications?@|newsletters?|mailer|updates@|news@|digest@|marketing@|noreply|automated|account-security|googlemail/i

function isAutomatedSender(contact: { name: string; email: string | null }): boolean {
  return AUTOMATED_SENDER_RE.test(contact.email ?? '') || AUTOMATED_SENDER_RE.test(contact.name)
}

export function computeAlerts(ws: Workspace): AlertCandidate[] {
  const { conversations, messages, now } = ws
  const out: AlertCandidate[] = []

  const active = conversations.filter((c) => c.status === 'ACTIVE')

  // Threads where the user has actually written something (35d window) —
  // a proxy for "this is a real two-way relationship, not inbox noise".
  const outboundConvs = new Set<string>()
  for (const m of messages) {
    if (m.direction === 'OUTBOUND') outboundConvs.add(m.conversationId)
  }

  for (const conv of active) {
    if (isAutomatedSender(conv.contact)) continue

    const a = conv.analysis
    const awaiting = isAwaitingReply(conv)
    const inboundAt = lastInboundAt(conv)
    const waitHours = awaiting && inboundAt ? (now - inboundAt.getTime()) / 3_600_000 : 0
    const waiting = awaiting ? waitDuration(inboundAt, now) : null
    const name = conv.contact.name
    const aiRisk = (a?.riskLevel as RiskLevel | undefined) ?? null
    // Engagement gate for SLA-style rules: the user replied at some point, or
    // the AI considers the thread at least medium-risk / elevated priority.
    const engaged =
      outboundConvs.has(conv.id) ||
      aiRisk === 'MEDIUM' || aiRisk === 'HIGH' || aiRisk === 'CRITICAL' ||
      conv.priority === 'HOT' || conv.priority === 'ATTENTION'

    // R1/R2 — AI-flagged churn risk (severity comes straight from the model).
    if (aiRisk === 'CRITICAL' || aiRisk === 'HIGH') {
      const waitNote = waiting ? ` Client has been waiting ${waiting} for a reply.` : ''
      out.push({
        type: aiRisk === 'CRITICAL' ? 'ai-critical-risk' : 'ai-high-risk',
        severity: aiRisk,
        conversationId: conv.id,
        dedupeScope: conv.id,
        title: `${aiRisk === 'CRITICAL' ? 'Critical' : 'High'} churn risk · ${name}`,
        reason: (a?.riskReasons?.[0] ?? a?.summary ?? 'AI flagged elevated churn risk.') + waitNote,
        suggestedAction: a?.nextAction ?? `Reach out to ${name} today.`,
      })
    } else if (awaiting && waitHours >= OVERDUE_MEDIUM_HOURS && engaged) {
      // R3 — reply SLA breach (only when not already covered by an AI-risk alert).
      const days = Math.floor(waitHours / 24)
      out.push({
        type: 'overdue-reply',
        severity: waitHours >= OVERDUE_HIGH_HOURS ? 'HIGH' : 'MEDIUM',
        conversationId: conv.id,
        dedupeScope: conv.id,
        title: `Reply overdue ${waiting} · ${name}`,
        reason: `${name} wrote ${days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${Math.floor(waitHours)}h`} ago and still has no reply.`,
        suggestedAction: `Reply to ${name} now${conv.subject ? ` — “${conv.subject}”` : ''}.`,
      })
    } else if (awaiting && a?.sentiment === 'NEGATIVE') {
      // R4 — negative tone waiting on you (medium urgency even inside SLA).
      out.push({
        type: 'negative-sentiment',
        severity: 'MEDIUM',
        conversationId: conv.id,
        dedupeScope: conv.id,
        title: `Negative tone · ${name}`,
        reason: a.riskReasons?.[0] ?? `AI detected a negative tone in ${name}'s latest messages.`,
        suggestedAction: a.nextAction ?? `Address ${name}'s concerns in your reply.`,
      })
    }
  }

  // R5 — engaged contact went quiet after your last message.
  const convToContact = new Map(active.map((c) => [c.id, c.contact.id]))
  const activity = contactActivityMap(messages, convToContact, now)
  const latestByContact = new Map<string, (typeof active)[number]>()
  for (const conv of active) {
    const prev = latestByContact.get(conv.contact.id)
    if (!prev || (conv.lastMessageAt?.getTime() ?? 0) > (prev.lastMessageAt?.getTime() ?? 0)) {
      latestByContact.set(conv.contact.id, conv)
    }
  }
  for (const [contactId, conv] of latestByContact) {
    if (isAutomatedSender(conv.contact)) continue
    const act = activity.get(contactId)
    if (!act || act.msgs28 < QUIET_MIN_MSGS_28D) continue
    if (conv.messages[0]?.direction !== 'OUTBOUND' || !conv.lastMessageAt) continue
    const quietDays = Math.floor((now - conv.lastMessageAt.getTime()) / DAY_MS)
    if (quietDays < QUIET_DAYS) continue

    out.push({
      type: 'gone-quiet',
      severity: 'MEDIUM',
      conversationId: conv.id,
      dedupeScope: contactId,
      title: `${conv.contact.name} went quiet`,
      reason: `Previously active contact (${act.msgs28} messages in 28 days) hasn't replied to your last message for ${quietDays} days.`,
      suggestedAction: `Send ${conv.contact.name} a follow-up to restart the thread.`,
    })
  }

  return out
}
