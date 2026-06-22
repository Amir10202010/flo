import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { messagePreview } from '@/lib/html'
import { embedTexts, getEmbeddingProvider, parseSearchQuery, type ParsedSearchQuery } from './ai'
import { bufferToVector } from './embedding.service'
import { enqueueMany } from './jobs/queue'
import {
  applyBoosts,
  blendScore,
  cosine,
  keywordScore,
  matchSnippet,
  PRIORITY_AT_LEAST,
  RISK_AT_LEAST,
  SEARCH_TUNING,
  tokenize,
} from './search.ranking'
import type {
  Channel,
  ConversationStatus,
  EmailCategory,
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
 *   2. Keyword candidates — matched in SQL across contact / subject / messages /
 *      AI summary (whole table, not a priority-capped slice), scored in-process.
 *   3. Semantic recall — cosine over a RECENCY-bounded universe of embeddings
 *      (not the old top-400-by-priority cap), unioned with the keyword hits.
 *
 * Every stage degrades gracefully: no AI key → plain keyword search; missing
 * embeddings → keyword-only for those rows + a bounded backfill enqueue.
 */

export interface SearchFilters {
  status?: ConversationStatus
  priority?: PriorityLevel
  channel?: Channel
  risk?: RiskLevel
  sentiment?: Sentiment
  awaiting?: boolean
}

const META_SELECT = {
  id: true,
  channel: true,
  subject: true,
  status: true,
  priority: true,
  priorityScore: true,
  category: true,
  lastMessageAt: true,
  awaitingReply: true,
  contact: { select: { name: true, email: true } },
  analysis: { select: { summary: true, riskLevel: true, sentiment: true } },
  messages: { orderBy: { sentAt: 'desc' }, take: 3, select: { direction: true, content: true } },
} satisfies Prisma.ConversationSelect

type MetaRow = Prisma.ConversationGetPayload<{ select: typeof META_SELECT }>

/**
 * Base WHERE shared by keyword, semantic-universe, filter-mode queries, AND the
 * server-side `/api/conversations` filter endpoint (exported for reuse).
 */
export function buildWhere(
  organizationId: string,
  f: {
    status?: ConversationStatus
    channel?: Channel
    category?: EmailCategory
    priority?: PriorityLevel
    risk?: RiskLevel
    sentiment?: Sentiment
    awaiting?: boolean
    sinceDate?: Date | null
  },
): Prisma.ConversationWhereInput {
  // risk + sentiment both live on the analysis relation — merge into ONE filter
  // (the previous spread overwrote risk when sentiment was also set).
  const analysis: Prisma.ConversationAnalysisWhereInput = {}
  if (f.risk) analysis.riskLevel = { in: RISK_AT_LEAST[f.risk] }
  if (f.sentiment) analysis.sentiment = f.sentiment

  return {
    organizationId,
    integration: { isActive: true },
    ...(f.status ? { status: f.status } : {}),
    ...(f.channel ? { channel: f.channel } : {}),
    ...(f.category ? { category: f.category } : {}),
    ...(f.priority ? { priority: { in: PRIORITY_AT_LEAST[f.priority] } } : {}),
    ...(Object.keys(analysis).length ? { analysis } : {}),
    ...(f.sinceDate ? { lastMessageAt: { gte: f.sinceDate } } : {}),
    ...(f.awaiting !== undefined ? { awaitingReply: f.awaiting } : {}),
  }
}

/** SQL OR clauses matching any term in any searchable field (whole-table recall). */
function keywordOrClauses(terms: string[]): Prisma.ConversationWhereInput[] {
  const or: Prisma.ConversationWhereInput[] = []
  for (const term of terms) {
    or.push(
      { contact: { name: { contains: term, mode: 'insensitive' } } },
      { contact: { email: { contains: term, mode: 'insensitive' } } },
      { subject: { contains: term, mode: 'insensitive' } },
      { analysis: { summary: { contains: term, mode: 'insensitive' } } },
      { messages: { some: { content: { contains: term, mode: 'insensitive' } } } },
    )
  }
  return or
}

function toItem(
  conv: MetaRow,
  ctx: { score: number; matchedOn: string[]; semantic: number | null; keyword: number; snippet: string | null },
): SearchResultItem {
  return {
    id: conv.id,
    channel: conv.channel as Channel,
    subject: conv.subject,
    status: conv.status as ConversationStatus,
    priority: conv.priority as PriorityLevel,
    priorityScore: conv.priorityScore,
    category: conv.category as EmailCategory,
    lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
    contact: { name: conv.contact.name, email: conv.contact.email },
    snippet:
      ctx.snippet ??
      conv.analysis?.summary ??
      (conv.messages[0] ? messagePreview(conv.messages[0].content, 160) : null),
    score: Math.round(ctx.score * 100) / 100,
    matchedOn: ctx.matchedOn,
    semanticMatch: ctx.semantic !== null && ctx.semantic >= SEARCH_TUNING.SEMANTIC_ONLY_CUTOFF && ctx.keyword === 0,
    awaitingReply: conv.awaitingReply,
    risk: (conv.analysis?.riskLevel as RiskLevel | undefined) ?? null,
  }
}

function lowerFields(conv: MetaRow): Record<string, string> {
  return {
    contact: conv.contact.name.toLowerCase(),
    email: (conv.contact.email ?? '').toLowerCase(),
    subject: (conv.subject ?? '').toLowerCase(),
    summary: (conv.analysis?.summary ?? '').toLowerCase(),
    message: conv.messages.map((m) => m.content).join('\n').toLowerCase(),
  }
}

export async function searchConversations(
  organizationId: string,
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
  const where = buildWhere(organizationId, {
    status: filters.status,
    channel: filters.channel,
    priority: filters.priority ?? parsed?.priority,
    risk: filters.risk ?? parsed?.risk,
    sentiment: filters.sentiment ?? parsed?.sentiment,
    awaiting: filters.awaiting ?? parsed?.awaitingReply,
    sinceDate: parsed?.daysBack ? new Date(Date.now() - parsed.daysBack * 86_400_000) : null,
  })

  const parsedFilters = parsed
    ? {
        keywords: parsed.keywords,
        ...(parsed.priority ? { priority: parsed.priority } : {}),
        ...(parsed.risk ? { risk: parsed.risk } : {}),
        ...(parsed.sentiment ? { sentiment: parsed.sentiment } : {}),
        ...(parsed.awaitingReply !== undefined ? { awaitingReply: parsed.awaitingReply } : {}),
        ...(parsed.daysBack ? { daysBack: parsed.daysBack } : {}),
      }
    : null

  // ── Empty query → pure filter/browse mode ranked by priority ──────────────
  if (!query) {
    const rows = await prisma.conversation.findMany({
      where,
      select: META_SELECT,
      orderBy: [{ priorityScore: 'desc' }, { lastMessageAt: 'desc' }],
      take: limit,
    })
    return {
      items: rows.map((conv) => toItem(conv, { score: 0, matchedOn: [], semantic: null, keyword: 0, snippet: null })),
      meta: { mode: 'filter', total: rows.length, tookMs: Date.now() - startedAt, parsedFilters, degraded: degraded.length ? degraded : null },
    }
  }

  const terms = Array.from(new Set([...tokenize(query), ...(parsed?.keywords ?? [])])).slice(0, 10)

  // 2. Keyword candidates — full-table SQL match, full metadata (sequential).
  const keywordRows: MetaRow[] = terms.length
    ? await prisma.conversation.findMany({
        where: { ...where, OR: keywordOrClauses(terms) },
        select: META_SELECT,
        orderBy: [{ lastMessageAt: 'desc' }],
        take: SEARCH_TUNING.KEYWORD_CANDIDATE_LIMIT,
      })
    : []

  // 3. Semantic recall over a recency-bounded universe.
  const semById = new Map<string, number>()
  let semanticActive = false
  const provider = getEmbeddingProvider()
  if (provider) {
    try {
      const embedded = await embedTexts([query], 'query')
      if (embedded) {
        const queryVec = embedded.vectors[0]
        const universe = await prisma.conversation.findMany({
          where,
          select: { id: true },
          orderBy: { lastMessageAt: 'desc' },
          take: SEARCH_TUNING.SEMANTIC_SCAN_LIMIT,
        })
        const universeIds = universe.map((u) => u.id)
        if (universeIds.length) {
          const rows = await prisma.conversationEmbedding.findMany({
            where: { conversationId: { in: universeIds }, model: provider.embeddingModel },
            select: { conversationId: true, vector: true, dims: true },
          })
          for (const r of rows) {
            if (r.dims !== queryVec.length) continue
            semById.set(r.conversationId, cosine(queryVec, bufferToVector(r.vector)))
          }
          semanticActive = true
          if (rows.length < universeIds.length) {
            degraded.push(`embeddings-partial(${rows.length}/${universeIds.length})`)
            await enqueueEmbeddingBackfill(universeIds.filter((id) => !semById.has(id)))
          }
        }
      } else {
        degraded.push('embeddings-unavailable')
      }
    } catch (err) {
      console.warn('[search] semantic scoring failed, keyword-only:', String(err))
      degraded.push('embeddings-unavailable')
    }
  } else {
    degraded.push('embeddings-unavailable')
  }

  // 4. Hydrate top semantic ids that the keyword pass didn't already load.
  const haveIds = new Set(keywordRows.map((r) => r.id))
  const semOnlyIds = [...semById.entries()]
    .filter(([id, s]) => !haveIds.has(id) && s >= SEARCH_TUNING.SEMANTIC_ONLY_CUTOFF)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SEARCH_TUNING.SEMANTIC_TOP)
    .map(([id]) => id)

  const semRows: MetaRow[] = semOnlyIds.length
    ? await prisma.conversation.findMany({ where: { id: { in: semOnlyIds } }, select: META_SELECT })
    : []

  // 5. Blend, boost, rank.
  const now = Date.now()
  const ranked = [...keywordRows, ...semRows]
    .map((conv) => {
      const { score: keyword, matchedOn } = keywordScore(lowerFields(conv), terms)
      const semantic = semById.has(conv.id) ? semById.get(conv.id)! : null
      let score = blendScore(keyword, semantic)
      if (score <= 0) return null
      const ageMs = conv.lastMessageAt ? now - conv.lastMessageAt.getTime() : Infinity
      score = applyBoosts(score, { ageMs, priority: conv.priority })
      const snippet = matchSnippet(conv.messages.map((m) => m.content).join('\n'), terms)
      return { conv, score, matchedOn, semantic, keyword, snippet }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.score - a.score)

  return {
    items: ranked.slice(0, limit).map((s) => toItem(s.conv, s)),
    meta: {
      mode: semanticActive ? 'hybrid' : 'keyword',
      total: ranked.length,
      tookMs: Date.now() - startedAt,
      parsedFilters,
      degraded: degraded.length ? degraded : null,
    },
  }
}

/**
 * Queue EMBED jobs for conversations missing a vector — bounded, and skipped
 * entirely while a previous backfill is still pending (no job pile-up).
 */
async function enqueueEmbeddingBackfill(conversationIds: string[]): Promise<void> {
  if (!conversationIds.length) return
  try {
    // Per-conversation dedupeKey already guarantees idempotency; a coarse global
    // cap on pending EMBED work is enough to avoid piling on every search.
    const pending = await prisma.job.count({
      where: { type: 'EMBED_CONVERSATION', status: 'PENDING' },
    })
    if (pending > SEARCH_TUNING.BACKFILL_LIMIT) return
    await enqueueMany(
      'EMBED_CONVERSATION',
      conversationIds.slice(0, SEARCH_TUNING.BACKFILL_LIMIT).map((conversationId) => ({ conversationId })),
      {},
      (p) => `EMBED_CONVERSATION:${p.conversationId}`,
    )
  } catch (err) {
    console.warn('[search] embedding backfill enqueue failed:', String(err))
  }
}
