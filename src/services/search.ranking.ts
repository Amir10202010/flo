import type { PriorityLevel, RiskLevel } from '@/types'

/**
 * Pure, side-effect-free search scoring helpers — extracted so the ranking math
 * can be reasoned about (and unit-tested) independently of Prisma/AI I/O.
 *
 * Retuned vs the original inline implementation:
 *  - blend weights 0.55 semantic / 0.45 keyword (was 0.6 / 0.4)
 *  - semantic-only cutoff lowered to 0.40, scaled at 0.9 (was 0.45 / 0.85)
 *  - partial keyword coverage penalty softened from linear to sqrt
 */

export const SEARCH_TUNING = {
  /** Full-metadata keyword candidates pulled from the DB (matched via SQL). */
  KEYWORD_CANDIDATE_LIMIT: 250,
  /** Recency-ordered id universe scored semantically (was an implicit top-400 by priority). */
  SEMANTIC_SCAN_LIMIT: 1500,
  /** Top semantic ids kept after cosine scoring. */
  SEMANTIC_TOP: 120,
  /** Max EMBED backfill jobs enqueued when coverage is low. */
  BACKFILL_LIMIT: 60,
  SEMANTIC_ONLY_CUTOFF: 0.4,
  SEMANTIC_ONLY_SCALE: 0.9,
  BLEND_SEMANTIC: 0.55,
  BLEND_KEYWORD: 0.45,
} as const

/** "At least this severe" expansions — "high risk" should include CRITICAL. */
export const RISK_AT_LEAST: Record<RiskLevel, RiskLevel[]> = {
  LOW: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  MEDIUM: ['MEDIUM', 'HIGH', 'CRITICAL'],
  HIGH: ['HIGH', 'CRITICAL'],
  CRITICAL: ['CRITICAL'],
}
export const PRIORITY_AT_LEAST: Record<PriorityLevel, PriorityLevel[]> = {
  HOT: ['HOT'],
  ATTENTION: ['HOT', 'ATTENTION'],
  COLD: ['HOT', 'ATTENTION', 'COLD'],
  SPAM: ['HOT', 'ATTENTION', 'COLD', 'SPAM'],
}

// Function words carry no relevance signal and flood keyword matches on long
// natural-language queries — strip them; the AI parser / semantic layer carry meaning.
const STOPWORDS = new Set([
  // en
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did', 'has', 'have',
  'had', 'who', 'what', 'which', 'when', 'where', 'how', 'why', 'me', 'my', 'mine', 'our', 'your',
  'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'and', 'or', 'not', 'no', 'all', 'any',
  'that', 'this', 'these', 'those', 'show', 'find', 'get', 'list', 'last', 'still', 'about',
  // ru
  'кто', 'что', 'какой', 'какие', 'когда', 'где', 'как', 'почему', 'мой', 'моя', 'мои', 'мне',
  'для', 'на', 'в', 'по', 'от', 'из', 'за', 'и', 'или', 'не', 'нет', 'все', 'это', 'тот', 'эти',
  'покажи', 'найди', 'список', 'ещё', 'еще', 'про',
])

export function tokenize(q: string): string[] {
  return Array.from(
    new Set(
      q
        .toLowerCase()
        .split(/[^\p{L}\p{N}@.\-]+/u)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
    ),
  ).slice(0, 8)
}

interface FieldWeight {
  field: string
  weight: number
}

export const FIELD_WEIGHTS: FieldWeight[] = [
  { field: 'contact', weight: 3 },
  { field: 'email', weight: 2.5 },
  { field: 'subject', weight: 3 },
  { field: 'summary', weight: 2 },
  { field: 'message', weight: 1.8 },
]
const MAX_TERM_SCORE = FIELD_WEIGHTS.reduce((a, f) => a + f.weight, 0)

/** Keyword relevance over pre-lowercased fields, normalized 0–1, with a soft
 *  penalty when only some query terms are found. */
export function keywordScore(
  fields: Record<string, string>,
  terms: string[],
): { score: number; matchedOn: string[] } {
  if (!terms.length) return { score: 0, matchedOn: [] }

  let total = 0
  let termsFound = 0
  const matchedOn = new Set<string>()
  for (const term of terms) {
    let found = false
    for (const { field, weight } of FIELD_WEIGHTS) {
      if (fields[field]?.includes(term)) {
        total += weight
        matchedOn.add(field)
        found = true
      }
    }
    if (found) termsFound++
  }

  let score = total / (terms.length * MAX_TERM_SCORE)
  score *= Math.sqrt(termsFound / terms.length) // softer than linear coverage penalty
  return { score, matchedOn: Array.from(matchedOn) }
}

/** Extract a ±70-char window around the first matched term, ellipsized. */
export function matchSnippet(content: string, terms: string[]): string | null {
  const flat = content.replace(/\s+/g, ' ').trim()
  const lower = flat.toLowerCase()
  for (const term of terms) {
    const at = lower.indexOf(term)
    if (at === -1) continue
    const start = Math.max(0, at - 70)
    const end = Math.min(flat.length, at + term.length + 70)
    return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
  }
  return null
}

/** Cosine of two L2-normalized vectors (plain dot product). Accepts number[]
 *  or a packed Float32Array (stored embeddings) on either side. */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return Math.max(0, Math.min(1, dot))
}

/** Blend keyword + semantic into a single relevance score. */
export function blendScore(keyword: number, semantic: number | null): number {
  const T = SEARCH_TUNING
  if (semantic !== null && keyword > 0) return T.BLEND_SEMANTIC * semantic + T.BLEND_KEYWORD * keyword
  if (semantic !== null) return semantic >= T.SEMANTIC_ONLY_CUTOFF ? semantic * T.SEMANTIC_ONLY_SCALE : 0
  return keyword
}

/** Recency + priority nudges, clamped to 1. */
export function applyBoosts(score: number, opts: { ageMs: number; priority: string }): number {
  let s = score
  if (opts.ageMs < 86_400_000) s += 0.08
  else if (opts.ageMs < 7 * 86_400_000) s += 0.05
  else if (opts.ageMs < 30 * 86_400_000) s += 0.02
  if (opts.priority === 'HOT') s += 0.06
  else if (opts.priority === 'ATTENTION') s += 0.03
  return Math.min(1, s)
}
