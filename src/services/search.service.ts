import { prisma } from '@/lib/prisma'
import { messagePreview } from '@/lib/html'
import { embedTexts, getEmbeddingProvider, parseSearchQuery, type ParsedSearchQuery } from './ai'
import { bufferToVector } from './embedding.service'
import { enqueueMany } from './jobs/queue'
import type {
  Channel,
  ConversationStatus,
  PriorityLevel,
  RiskLevel,
  SearchResponse,
  SearchResultItem,
  Sentiment,
} from '@/types'

/**
 * Hybrid conversation search:
 *
 *   1. Query understanding (free Gemini tier) — natural language → keywords +
 *      structured filters ("angry clients last week" → sentiment, daysBack).
 *   2. Keyword scoring over contact / subject / messages / AI summary.
 *   3. Semantic scoring — cosine (dot, vectors are L2-normalized) between the
 *      query embedding and stored conversation embeddings.
 *
 * Every stage degrades gracefully: no AI key → plain keyword search; missing
 *embeddings → keyword-only for those rows + a bounded backfill enqueue.
 */

export interface SearchFilters {
  status?: ConversationStatus
  priority?: PriorityLevel
  channel?: Channel
  risk?: RiskLevel
  sentiment?: Sentiment
  awaiting?: boolean
}

const CANDIDATE_LIMIT = 400
const BACKFILL_LIMIT = 30
const SEMANTIC_ONLY_CUTOFF = 0.45

/** "at least this severe" expansions — "high risk" should include CRITICAL. */
const RISK_AT_LEAST: Record<RiskLevel, RiskLevel[]> = {
  LOW: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  MEDIUM: ['MEDIUM', 'HIGH', 'CRITICAL'],
  HIGH: ['HIGH', 'CRITICAL'],
  CRITICAL: ['CRITICAL'],
}
const PRIORITY_AT_LEAST: Record<PriorityLevel, PriorityLevel[]> = {
  HOT: ['HOT'],
  ATTENTION: ['HOT', 'ATTENTION'],
  COLD: ['HOT', 'ATTENTION', 'COLD'],
  SPAM: ['HOT', 'ATTENTION', 'COLD', 'SPAM'],
}

// Function words carry no relevance signal and flood keyword matches on long
// natural-language queries ("who is waiting for my reply") — strip them and
// let the AI query parser / semantic layer carry the meaning instead.
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

function tokenize(q: string): string[] {
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

interface FieldHit {
  field: string
  weight: number
}

const FIELD_WEIGHTS: FieldHit[] = [
  { field: 'contact', weight: 3 },
  { field: 'email', weight: 2.5 },
  { field: 'subject', weight: 3 },
  { field: 'summary', weight: 2 },
  { field: 'message', weight: 1.8 },
]
const MAX_TERM_SCORE = FIELD_WEIGHTS.reduce((a, f) => a + f.weight, 0)

/** Extract a ±70-char window around the first matched term, ellipsized. */
function matchSnippet(content: string, terms: string[]): string | null {
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

export async function searchConversations(
  userId: string,
  q: string,
  filters: SearchFilters = {},
  limit = 20,
): Promise<SearchResponse> {
  const startedAt = Date.now()
  const query = q.trim()
  const degraded: string[] = []

  // 1. Query understanding — only worth a model call for natural-ish queries.
  let parsed: ParsedSearchQuery | null = null
  if (query.length >= 8 && /\s/.test(query)) {
    parsed = await parseSearchQuery(query)
    if (!parsed) degraded.push('query-parse-unavailable')
  }

  // Explicit filters always win over parsed ones.
  const priority = filters.priority ?? parsed?.priority
  const risk = filters.risk ?? parsed?.risk
  const sentiment = filters.sentiment ?? parsed?.sentiment
  const awaiting = filters.awaiting ?? parsed?.awaitingReply
  const sinceDate = parsed?.daysBack ? new Date(Date.now() - parsed.daysBack * 86_400_000) : null

  // 2. One bounded candidate query (sequential-friendly: small pool — see CLAUDE.md).
  const candidates = await prisma.conversation.findMany({
    where: {
      userId,
      integration: { isActive: true },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(priority ? { priority: { in: PRIORITY_AT_LEAST[priority] } } : {}),
      ...(risk ? { analysis: { riskLevel: { in: RISK_AT_LEAST[risk] } } } : {}),
      ...(sentiment ? { analysis: { sentiment } } : {}),
      ...(sinceDate ? { lastMessageAt: { gte: sinceDate } } : {}),
    },
    select: {
      id: true,
      channel: true,
      subject: true,
      status: true,
      priority: true,
      priorityScore: true,
      lastMessageAt: true,
      contact: { select: { name: true, email: true } },
      analysis: { select: { summary: true, riskLevel: true, sentiment: true } },
      messages: {
        orderBy: { sentAt: 'desc' },
        take: 3,
        select: { direction: true, content: true },
      },
    },
    orderBy: [{ priorityScore: 'desc' }, { lastMessageAt: 'desc' }],
    take: CANDIDATE_LIMIT,
  })

  const pool = awaiting === undefined
    ? candidates
    : candidates.filter((c) => (c.messages[0]?.direction === 'INBOUND') === awaiting)

  // 3. Keyword scoring.
  const rawTerms = tokenize(query)
  const terms = Array.from(new Set([...rawTerms, ...(parsed?.keywords ?? [])])).slice(0, 10)

  interface Scored {
    conv: (typeof pool)[number]
    keyword: number
    semantic: number | null
    matchedOn: string[]
    snippet: string | null
  }

  const now = Date.now()
  const scored: Scored[] = pool.map((conv) => {
    const fields: Record<string, string> = {
      contact: conv.contact.name.toLowerCase(),
      email: (conv.contact.email ?? '').toLowerCase(),
      subject: (conv.subject ?? '').toLowerCase(),
      summary: (conv.analysis?.summary ?? '').toLowerCase(),
      message: conv.messages.map((m) => m.content).join('\n').toLowerCase(),
    }

    let total = 0
    let termsFound = 0
    const matchedOn = new Set<string>()
    for (const term of terms) {
      let found = false
      for (const { field, weight } of FIELD_WEIGHTS) {
        if (fields[field].includes(term)) {
          total += weight
          matchedOn.add(field)
          found = true
        }
      }
      if (found) termsFound++
    }

    let keyword = terms.length ? total / (terms.length * MAX_TERM_SCORE) : 0
    if (terms.length) keyword *= termsFound / terms.length // penalize partial coverage

    const snippet = terms.length
      ? matchSnippet(conv.messages.map((m) => m.content).join('\n'), terms)
      : null

    return { conv, keyword, semantic: null, matchedOn: Array.from(matchedOn), snippet }
  })

  // 4. Semantic scoring — only when there's an actual query to embed.
  let mode: SearchResponse['meta']['mode'] = query ? 'keyword' : 'filter'
  const provider = getEmbeddingProvider()
  if (query && provider) {
    try {
      const embedded = await embedTexts([query], 'query')
      if (embedded) {
        const queryVec = embedded.vectors[0]
        const rows = await prisma.conversationEmbedding.findMany({
          where: { conversationId: { in: pool.map((c) => c.id) }, model: provider.embeddingModel },
          select: { conversationId: true, vector: true, dims: true },
        })
        const byConv = new Map(rows.map((r) => [r.conversationId, r]))

        for (const s of scored) {
          const row = byConv.get(s.conv.id)
          if (!row || row.dims !== queryVec.length) continue
          const vec = bufferToVector(row.vector)
          let dot = 0
          for (let i = 0; i < queryVec.length; i++) dot += queryVec[i] * vec[i]
          s.semantic = Math.max(0, Math.min(1, dot))
        }
        mode = 'hybrid'

        const covered = rows.length
        if (covered < pool.length) {
          degraded.push(`embeddings-partial(${covered}/${pool.length})`)
          await enqueueEmbeddingBackfill(userId, pool.map((c) => c.id).filter((id) => !byConv.has(id)))
        }
      } else {
        degraded.push('embeddings-unavailable')
      }
    } catch (err) {
      // Semantic layer is an enhancement — never let it break search.
      console.warn('[search] semantic scoring failed, keyword-only:', String(err))
      degraded.push('embeddings-unavailable')
    }
  } else if (query && !provider) {
    degraded.push('embeddings-unavailable')
  }

  // 5. Blend, boost, rank.
  const ranked = scored
    .map((s) => {
      let score: number
      if (s.semantic !== null && s.keyword > 0) score = 0.6 * s.semantic + 0.4 * s.keyword
      else if (s.semantic !== null) score = s.semantic >= SEMANTIC_ONLY_CUTOFF ? s.semantic * 0.85 : 0
      else score = s.keyword

      if (query && score <= 0) return null

      const ageMs = s.conv.lastMessageAt ? now - s.conv.lastMessageAt.getTime() : Infinity
      if (ageMs < 86_400_000) score += 0.08
      else if (ageMs < 7 * 86_400_000) score += 0.05
      else if (ageMs < 30 * 86_400_000) score += 0.02
      if (s.conv.priority === 'HOT') score += 0.06
      else if (s.conv.priority === 'ATTENTION') score += 0.03

      return { ...s, score: Math.min(1, score) }
    })
    .filter((s): s is Scored & { score: number } => s !== null)
    .sort((a, b) =>
      query
        ? b.score - a.score
        : b.conv.priorityScore - a.conv.priorityScore ||
          (b.conv.lastMessageAt?.getTime() ?? 0) - (a.conv.lastMessageAt?.getTime() ?? 0),
    )

  const items: SearchResultItem[] = ranked.slice(0, limit).map((s) => ({
    id: s.conv.id,
    channel: s.conv.channel as Channel,
    subject: s.conv.subject,
    status: s.conv.status as ConversationStatus,
    priority: s.conv.priority as PriorityLevel,
    priorityScore: s.conv.priorityScore,
    lastMessageAt: s.conv.lastMessageAt?.toISOString() ?? null,
    contact: { name: s.conv.contact.name, email: s.conv.contact.email },
    snippet:
      s.snippet ??
      s.conv.analysis?.summary ??
      (s.conv.messages[0] ? messagePreview(s.conv.messages[0].content, 160) : null),
    score: Math.round(s.score * 100) / 100,
    matchedOn: s.matchedOn,
    semanticMatch: s.semantic !== null && s.semantic >= SEMANTIC_ONLY_CUTOFF && s.keyword === 0,
    awaitingReply: s.conv.messages[0]?.direction === 'INBOUND',
    risk: (s.conv.analysis?.riskLevel as RiskLevel | undefined) ?? null,
  }))

  return {
    items,
    meta: {
      mode,
      total: ranked.length,
      tookMs: Date.now() - startedAt,
      parsedFilters: parsed
        ? {
            keywords: parsed.keywords,
            ...(parsed.priority ? { priority: parsed.priority } : {}),
            ...(parsed.risk ? { risk: parsed.risk } : {}),
            ...(parsed.sentiment ? { sentiment: parsed.sentiment } : {}),
            ...(parsed.awaitingReply !== undefined ? { awaitingReply: parsed.awaitingReply } : {}),
            ...(parsed.daysBack ? { daysBack: parsed.daysBack } : {}),
          }
        : null,
      degraded: degraded.length ? degraded : null,
    },
  }
}

/**
 * Queue EMBED jobs for conversations missing a vector — bounded, and skipped
 * entirely while a previous backfill is still pending (no job pile-up).
 */
async function enqueueEmbeddingBackfill(userId: string, conversationIds: string[]): Promise<void> {
  if (!conversationIds.length) return
  try {
    const pending = await prisma.job.count({
      where: { type: 'EMBED_CONVERSATION', userId, status: 'PENDING' },
    })
    if (pending > 0) return
    await enqueueMany(
      'EMBED_CONVERSATION',
      conversationIds.slice(0, BACKFILL_LIMIT).map((conversationId) => ({ conversationId })),
      { userId },
    )
  } catch (err) {
    console.warn('[search] embedding backfill enqueue failed:', String(err))
  }
}
