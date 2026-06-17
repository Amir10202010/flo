import type {
  AnalysisResult,
  DraftOutcome,
  DraftPayload,
  DraftTone,
  GeminiAnalysisPayload,
  RiskLevel,
  Sentiment,
  ThreadSummary,
} from '@/types'
import { AiProviderError, type AiEmbeddingProvider, type AiJsonSchema, type AiTextProvider, type EmbedTaskType } from './types'
import { geminiProvider } from './gemini.provider'
import { localAnalyzeConversation, localReplyDraft, localThreadSummary } from './local.provider'

/**
 * High-level AI entry points. Everything here is provider-agnostic:
 *
 *   AI_PROVIDER=auto    (default) Gemini when GEMINI_API_KEY is set, local otherwise
 *   AI_PROVIDER=gemini  force Gemini (errors surface instead of falling back to local)
 *   AI_PROVIDER=local   force the free heuristic provider (no network calls)
 *
 * Adding a paid provider later = implement AiTextProvider/AiEmbeddingProvider
 * in one new file and extend the two getters below — no business-logic edits.
 */

type ProviderMode = 'auto' | 'gemini' | 'local'

function providerMode(): ProviderMode {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase()
  return raw === 'gemini' || raw === 'local' ? raw : 'auto'
}

export function getTextProvider(): AiTextProvider | null {
  const mode = providerMode()
  if (mode === 'local') return null
  if (mode === 'gemini') return geminiProvider
  return process.env.GEMINI_API_KEY ? geminiProvider : null
}

export function getEmbeddingProvider(): AiEmbeddingProvider | null {
  const mode = providerMode()
  if (mode === 'local') return null
  if (mode === 'gemini') return geminiProvider
  return process.env.GEMINI_API_KEY ? geminiProvider : null
}

// ── Conversation analysis ───────────────────────────────────────────────────

const VALID_RISK = new Set<string>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const VALID_SENTIMENT = new Set<string>(['POSITIVE', 'NEUTRAL', 'NEGATIVE'])
const VALID_CATEGORY = new Set<string>(['PRIMARY', 'CLIENTS', 'SERVICES', 'PROMOTIONS', 'NEWSLETTERS', 'SPAM'])

const ANALYSIS_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Concise 1–2 sentence summary of where this conversation currently stands.',
    },
    riskLevel: {
      type: 'string',
      format: 'enum',
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      description: 'Risk of losing this client.',
    },
    riskReasons: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific reasons for the risk level. Empty array when risk is LOW.',
    },
    nextAction: {
      type: 'string',
      description: 'The single most important action the manager should take next. Be specific.',
    },
    lostReason: {
      type: 'string',
      description: 'Why the client was lost or is very likely lost. Omit field if not applicable.',
    },
    sentiment: {
      type: 'string',
      format: 'enum',
      enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
      description: 'Overall client sentiment in this conversation.',
    },
    category: {
      type: 'string',
      format: 'enum',
      enum: ['PRIMARY', 'CLIENTS', 'SERVICES', 'PROMOTIONS', 'NEWSLETTERS', 'SPAM'],
      description:
        'Best inbox category for this email: CLIENTS (real customer/prospect conversation), SERVICES (invoice/payment/transactional), PROMOTIONS (marketing/sales), NEWSLETTERS (subscriptions/digests), SPAM (junk), or PRIMARY (important personal mail that fits none of the above).',
    },
  },
  required: ['summary', 'riskLevel', 'riskReasons', 'nextAction', 'sentiment'],
}

function validateAnalysis(raw: unknown): AnalysisResult {
  if (!raw || typeof raw !== 'object') {
    throw new AiProviderError('Analysis response is not an object', 'bad_response')
  }
  const r = raw as Record<string, unknown>

  const riskLevel = String(r.riskLevel ?? '').toUpperCase()
  const sentiment = String(r.sentiment ?? '').toUpperCase()
  if (!VALID_RISK.has(riskLevel)) {
    throw new AiProviderError(`Unexpected riskLevel: "${riskLevel}"`, 'bad_response')
  }
  if (!VALID_SENTIMENT.has(sentiment)) {
    throw new AiProviderError(`Unexpected sentiment: "${sentiment}"`, 'bad_response')
  }

  const riskReasons = Array.isArray(r.riskReasons) ? r.riskReasons.map(String).filter(Boolean) : []
  const lostReason =
    typeof r.lostReason === 'string' && r.lostReason.trim() ? r.lostReason.trim() : undefined

  const category = String(r.category ?? '').toUpperCase()
  const validCategory = VALID_CATEGORY.has(category) ? (category as AnalysisResult['category']) : undefined

  return {
    summary: String(r.summary ?? '').trim() || 'No summary available.',
    riskLevel: riskLevel as RiskLevel,
    riskReasons,
    nextAction: String(r.nextAction ?? '').trim() || 'Review the conversation.',
    lostReason,
    sentiment: sentiment as Sentiment,
    category: validCategory,
  }
}

function buildAnalysisPrompt(payload: GeminiAnalysisPayload): string {
  const { channel, contactName, messages } = payload

  const lines = messages.map((m) => {
    const role = m.direction === 'INBOUND' ? `CLIENT (${contactName})` : 'MANAGER'
    const time = new Date(m.sentAt).toISOString().slice(0, 16).replace('T', ' ')
    // Truncate long messages to stay within token budget
    const body = m.content.length > 600 ? m.content.slice(0, 600) + '…' : m.content
    return `[${time}] ${role}: ${body}`
  })

  return `You are an AI assistant helping a service-business sales manager track client conversations.

Analyze the following ${channel} conversation between a manager and a client named "${contactName}".
The conversation may be in any language — analyze it as-is and respond in the same language as the conversation.

CONVERSATION:
${lines.join('\n')}

Evaluate:
- Where the conversation currently stands (interest level, urgency, objections)
- Risk of losing this client and specific reasons
- The manager's single most important next step
- Whether the client has already been lost or is very likely to churn (and why)
- Overall client sentiment

Return a JSON object matching the provided schema.`
}

export type AnalyzedBy = 'gemini' | 'local'

export interface AnalysisOutcome extends AnalysisResult {
  /** Which provider produced this analysis — persisted for honest UI labeling. */
  provider: AnalyzedBy
}

/**
 * Analyze a conversation with the configured provider, falling back to the
 * local heuristic when no provider is configured or it fails NON-retryably.
 *
 * Retryable failures (rate limit / transient outage) are rethrown by default
 * so the job queue retries with backoff instead of silently downgrading the
 * analysis. `fallbackOnRetryable` flips that for the FINAL job attempt: a
 * labelled "quick scan" beats a permanently failed job when the quota turns
 * out to be exhausted for the day.
 */
export async function analyzeConversationContent(
  payload: GeminiAnalysisPayload,
  opts: { fallbackOnRetryable?: boolean } = {},
): Promise<AnalysisOutcome> {
  if (!payload.messages.length) {
    throw new Error('Cannot analyze a conversation with no messages')
  }

  const provider = getTextProvider()
  if (provider) {
    try {
      const raw = await provider.generateJson({ prompt: buildAnalysisPrompt(payload), schema: ANALYSIS_SCHEMA })
      return { ...validateAnalysis(raw), provider: 'gemini' }
    } catch (err) {
      if (err instanceof AiProviderError && err.retryable && !opts.fallbackOnRetryable) throw err
      console.warn(`[ai] ${provider.name} analysis failed (${String(err)}); using local heuristic fallback`)
    }
  }

  return { ...localAnalyzeConversation(payload), provider: 'local' }
}

// ── Reply / compose drafting ────────────────────────────────────────────────

const DRAFT_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    subject: {
      type: 'string',
      description: 'Email subject line. ONLY for a brand-new email (compose mode); omit it for replies.',
    },
    body: {
      type: 'string',
      description:
        'The complete, ready-to-send message body, in the same language as the conversation. Plain text, no placeholders.',
    },
  },
  required: ['body'],
}

const TONE_GUIDE: Record<DraftTone, string> = {
  WARM: 'Warm, friendly and personable, while staying professional.',
  CONCISE: 'Short and to the point — a few sentences at most, no filler.',
  FORMAL: 'Formal, polished business tone.',
  MATCH:
    "Imitate the user's own writing voice from the provided style samples (greeting, length, formality, sign-off).",
}

function buildDraftPrompt(p: DraftPayload): string {
  const thread = p.messages
    .map((m) => {
      const role = m.direction === 'INBOUND' ? `THEM (${p.contactName})` : 'ME'
      const body = m.content.length > 800 ? m.content.slice(0, 800) + '…' : m.content
      return `${role}: ${body}`
    })
    .join('\n\n')

  const styleBlock =
    p.tone === 'MATCH' && p.styleSamples?.length
      ? `\n\nMY PAST REPLIES (imitate this voice):\n${p.styleSamples.map((s) => `- ${s.slice(0, 400)}`).join('\n')}`
      : ''

  const intro =
    p.mode === 'compose'
      ? `Write a brand-new ${p.channel} email to "${p.contactName || 'the recipient'}".`
      : `Write the next reply from ME in this ${p.channel} conversation with "${p.contactName}".`

  return `You are drafting on behalf of a service-business manager. ${intro}
Tone: ${TONE_GUIDE[p.tone]}
Write in the SAME LANGUAGE as the conversation/instruction. Output a complete, ready-to-send message — no placeholders like [Your name], no markdown, plain text only. End with a natural sign-off.${
    p.analysisSummary ? `\nContext: ${p.analysisSummary}` : ''
  }${p.nextAction ? `\nIntended next step: ${p.nextAction}` : ''}${
    p.steer ? `\nThe user specifically wants to convey: "${p.steer}"` : ''
  }
${p.mode === 'compose' ? '' : `\nCONVERSATION:\n${thread}`}${styleBlock}

Return a JSON object matching the provided schema.`
}

/**
 * Generate a ready-to-send reply (or new-email) draft. Mirrors
 * analyzeConversationContent's fallback contract: retryable provider errors are
 * rethrown so a background job can back off, UNLESS `fallbackOnRetryable` is set
 * (interactive path / final job attempt), in which case the local template is used.
 */
export async function generateReplyDraft(
  payload: DraftPayload,
  opts: { fallbackOnRetryable?: boolean } = {},
): Promise<DraftOutcome> {
  const provider = getTextProvider()
  if (provider) {
    try {
      const raw = await provider.generateJson<{ body?: unknown; subject?: unknown }>({
        prompt: buildDraftPrompt(payload),
        schema: DRAFT_SCHEMA,
        maxOutputTokens: 1024,
      })
      const body = String(raw.body ?? '').trim()
      if (!body) throw new AiProviderError('Draft response had an empty body', 'bad_response')
      const subject =
        typeof raw.subject === 'string' && raw.subject.trim() ? raw.subject.trim() : undefined
      return { body, subject, provider: 'gemini' }
    } catch (err) {
      if (err instanceof AiProviderError && err.retryable && !opts.fallbackOnRetryable) throw err
      console.warn(`[ai] ${provider.name} draft generation failed (${String(err)}); using local template`)
    }
  }

  return { ...localReplyDraft(payload), provider: 'local' }
}

// ── Thread summarization ("catch me up") ────────────────────────────────────

export interface ThreadSummaryPayload {
  channel: string
  contactName: string
  messages: { direction: 'INBOUND' | 'OUTBOUND'; content: string }[]
}

export interface ThreadSummaryOutcome extends ThreadSummary {
  provider: AnalyzedBy
}

const SUMMARY_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    tldr: { type: 'string', description: 'One or two sentences on where the conversation stands right now.' },
    keyPoints: {
      type: 'array',
      items: { type: 'string' },
      description: 'The most important facts, decisions and commitments so far (max 5), most important first.',
    },
    openItems: {
      type: 'array',
      items: { type: 'string' },
      description: 'Unresolved questions or things still awaiting action. Empty array if none.',
    },
  },
  required: ['tldr', 'keyPoints', 'openItems'],
}

function buildSummaryPrompt(p: ThreadSummaryPayload): string {
  const thread = p.messages
    .map((m) => {
      const role = m.direction === 'INBOUND' ? `THEM (${p.contactName})` : 'ME'
      const body = m.content.length > 600 ? m.content.slice(0, 600) + '…' : m.content
      return `${role}: ${body}`
    })
    .join('\n\n')

  return `Summarize this ${p.channel} conversation with "${p.contactName}" so the manager can catch up fast.
Respond in the SAME LANGUAGE as the conversation. Be concrete and brief.

CONVERSATION:
${thread}

Return a JSON object matching the schema (tldr, keyPoints, openItems).`
}

/**
 * "Catch me up" — a structured summary of a (usually long) thread. On-demand and
 * user-facing, so any provider error degrades straight to the local heuristic
 * (no rethrow): a labelled offline summary beats an error in the UI.
 */
export async function summarizeThread(payload: ThreadSummaryPayload): Promise<ThreadSummaryOutcome> {
  const provider = getTextProvider()
  if (provider) {
    try {
      const raw = await provider.generateJson<{ tldr?: unknown; keyPoints?: unknown; openItems?: unknown }>({
        prompt: buildSummaryPrompt(payload),
        schema: SUMMARY_SCHEMA,
        maxOutputTokens: 700,
      })
      const tldr = String(raw.tldr ?? '').trim()
      if (!tldr) throw new AiProviderError('Summary had an empty tldr', 'bad_response')
      const keyPoints = Array.isArray(raw.keyPoints) ? raw.keyPoints.map(String).filter(Boolean).slice(0, 6) : []
      const openItems = Array.isArray(raw.openItems) ? raw.openItems.map(String).filter(Boolean).slice(0, 6) : []
      return { tldr, keyPoints, openItems, provider: 'gemini' }
    } catch (err) {
      console.warn(`[ai] ${provider.name} summarize failed (${String(err)}); using local heuristic`)
    }
  }
  return { ...localThreadSummary(payload), provider: 'local' }
}

// ── Search-query understanding ──────────────────────────────────────────────

export interface ParsedSearchQuery {
  keywords: string[]
  priority?: 'HOT' | 'ATTENTION' | 'COLD' | 'SPAM'
  risk?: RiskLevel
  sentiment?: Sentiment
  awaitingReply?: boolean
  /** Restrict to activity within the last N days. */
  daysBack?: number
}

const QUERY_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Up to 6 short search terms (people, companies, topics) in the original language, plus an English translation when the term is not English. Exclude filter words like "urgent" or "unanswered" that are captured by the fields below.',
    },
    priority: { type: 'string', format: 'enum', enum: ['HOT', 'ATTENTION', 'COLD', 'SPAM'], description: 'Only when the query asks for urgency, e.g. "urgent", "high priority".' },
    risk: { type: 'string', format: 'enum', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], description: 'Only when the query asks about churn/at-risk clients.' },
    sentiment: { type: 'string', format: 'enum', enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'], description: 'Only when the query asks about tone, e.g. "angry clients".' },
    awaitingReply: { type: 'boolean', description: 'true when the query asks for threads waiting on the user, e.g. "unanswered".' },
    daysBack: { type: 'integer', description: 'Time window in days when the query mentions one, e.g. "last week" → 7.' },
  },
  required: ['keywords'],
}

const queryCache = new Map<string, { value: ParsedSearchQuery | null; at: number }>()
const QUERY_CACHE_TTL = 10 * 60_000
const QUERY_CACHE_MAX = 200

/**
 * Turn a natural-language inbox query into structured search intent.
 * Best-effort: returns null when no text provider is available or parsing
 * fails — the caller then runs plain keyword search (graceful degradation).
 */
export async function parseSearchQuery(q: string): Promise<ParsedSearchQuery | null> {
  const provider = getTextProvider()
  if (!provider) return null

  const key = q.trim().toLowerCase()
  const hit = queryCache.get(key)
  if (hit && Date.now() - hit.at < QUERY_CACHE_TTL) return hit.value

  let value: ParsedSearchQuery | null = null
  try {
    const raw = await provider.generateJson<Record<string, unknown>>({
      prompt: `Convert this inbox search query into structured filters for a client-conversation search engine. Query (any language): "${q.replace(/"/g, "'").slice(0, 200)}"\nOnly set filter fields the query explicitly implies. Return JSON matching the schema.`,
      schema: QUERY_SCHEMA,
      maxOutputTokens: 256,
    })
    const keywords = Array.isArray(raw.keywords)
      ? raw.keywords.map(String).map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 2).slice(0, 6)
      : []
    value = {
      keywords,
      priority: VALID_PRIORITY.has(String(raw.priority)) ? (raw.priority as ParsedSearchQuery['priority']) : undefined,
      risk: VALID_RISK.has(String(raw.risk)) ? (raw.risk as RiskLevel) : undefined,
      sentiment: VALID_SENTIMENT.has(String(raw.sentiment)) ? (raw.sentiment as Sentiment) : undefined,
      awaitingReply: typeof raw.awaitingReply === 'boolean' ? raw.awaitingReply : undefined,
      daysBack:
        typeof raw.daysBack === 'number' && Number.isFinite(raw.daysBack) && raw.daysBack > 0
          ? Math.min(365, Math.round(raw.daysBack))
          : undefined,
    }
  } catch (err) {
    // Never let query understanding break search — keyword path covers it.
    console.warn('[ai] parseSearchQuery failed, degrading to keyword search:', String(err))
    value = null
  }

  if (queryCache.size >= QUERY_CACHE_MAX) {
    const oldest = queryCache.keys().next().value
    if (oldest !== undefined) queryCache.delete(oldest)
  }
  queryCache.set(key, { value, at: Date.now() })
  return value
}

const VALID_PRIORITY = new Set<string>(['HOT', 'ATTENTION', 'COLD', 'SPAM'])

// ── Embeddings ──────────────────────────────────────────────────────────────

export interface EmbedResult {
  vectors: number[][]
  model: string
  dims: number
}

/** Embed texts with the configured provider; null when none is available. */
export async function embedTexts(texts: string[], taskType: EmbedTaskType): Promise<EmbedResult | null> {
  const provider = getEmbeddingProvider()
  if (!provider) return null
  const vectors = await provider.embed(texts, taskType)
  return { vectors, model: provider.embeddingModel, dims: provider.embeddingDims }
}

export { AiProviderError } from './types'
export type { DraftTone, DraftPayload, DraftOutcome } from '@/types'
