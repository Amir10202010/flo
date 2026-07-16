import { AiProviderError, type AiJsonSchema } from './types'
import { getTextProvider } from './index'

/**
 * Knowledge-extraction AI entry points — one generateJson call per source
 * object (conversation / note / meeting transcript), returning topics plus
 * structured facts (decisions, action items, risks) and mentioned companies.
 *
 * Everything follows the provider contract used across `src/services/ai`:
 * provider-gated (no key → empty result), retryable errors rethrown so job
 * backoff does rate-limit pacing, unless `fallbackOnRetryable` is set (final
 * attempt) where the call degrades to an empty result instead of failing.
 *
 * Honesty rules baked into every prompt:
 *  - facts must be explicitly present in the text (empty arrays are good),
 *  - people are only "mentioned" when they match the provided contact list,
 *  - existing topics are reused instead of minting near-duplicates.
 */

// ── Shared shapes ────────────────────────────────────────────────────────────

export interface ExtractedTopic {
  /** Human-readable topic label, e.g. "Q3 renewal", "onboarding". */
  name: string
  /** Lowercased normalized dedupe key. Advisory only — the graph layer
   *  re-derives the authoritative key from `name` at upsert time. */
  canonicalKey: string
}

export interface ExtractedFacts {
  /** Explicit decisions made ("agreed to start with the monthly plan"). */
  decisions: string[]
  /** Concrete action items / commitments ("send the contract by Friday"). */
  actionItems: string[]
  /** Explicit risks or concerns raised ("worried about the integration timeline"). */
  risks: string[]
}

export interface ConversationKnowledge extends ExtractedFacts {
  topics: ExtractedTopic[]
  /** Company/organization names discussed, other than the contact's own employer. */
  companies: string[]
}

export interface NoteKnowledge extends ExtractedFacts {
  topics: ExtractedTopic[]
  companies: string[]
  /** Names copied EXACTLY from the provided contact list (never invented). */
  mentionedContacts: string[]
}

export interface MeetingKnowledge extends ExtractedFacts {
  /** 2–4 sentence meeting summary. */
  summary: string
  topics: ExtractedTopic[]
  companies: string[]
  /** Suggested follow-ups after this meeting ("email the revised quote"). */
  followUps: string[]
}

export interface MeetingBrief {
  /** 2–4 sentence "walk in prepared" paragraph. */
  brief: string
  /** 2–5 concrete talking points. */
  talkingPoints: string[]
}

export const EMPTY_FACTS: ExtractedFacts = { decisions: [], actionItems: [], risks: [] }
export const EMPTY_CONVERSATION_KNOWLEDGE: ConversationKnowledge = { ...EMPTY_FACTS, topics: [], companies: [] }
export const EMPTY_NOTE_KNOWLEDGE: NoteKnowledge = { ...EMPTY_FACTS, topics: [], companies: [], mentionedContacts: [] }
export const EMPTY_MEETING_KNOWLEDGE: MeetingKnowledge = { ...EMPTY_FACTS, summary: '', topics: [], companies: [], followUps: [] }

// ── Payloads ─────────────────────────────────────────────────────────────────

export interface ConversationKnowledgePayload {
  subject: string | null
  contactName: string
  messages: { direction: 'INBOUND' | 'OUTBOUND'; content: string }[]
  /** The user's existing top topics (by weight) — the model reuses a matching
   *  one instead of minting near-duplicate wording. */
  existingTopics: { name: string; canonicalKey: string }[]
}

export interface NoteKnowledgePayload {
  title: string
  body: string
  existingTopics: { name: string; canonicalKey: string }[]
  /** The user's contacts (names, most recently active first, capped) — the ONLY
   *  people the model may report as mentioned. */
  contactNames: string[]
}

export interface MeetingKnowledgePayload {
  title: string
  startsAt: string
  attendeeNames: string[]
  /** Pasted transcript or typed meeting notes. */
  transcript: string
  existingTopics: { name: string; canonicalKey: string }[]
}

export interface MeetingBriefPayload {
  title: string
  startsAt: string
  /** Pre-formatted context lines built by meeting.service from real workspace
   *  data (attendees + relationship state + recent threads + open items). */
  contextLines: string[]
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const TOPIC_ITEMS: AiJsonSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'A short, reusable topic label (1–3 words), e.g. "Q3 renewal", "pricing", "onboarding". Prefer a concrete business subject over generic filler like "email" or "meeting".',
      },
      canonicalKey: {
        type: 'string',
        description: 'The topic lowercased with punctuation stripped and spaces collapsed, e.g. "q3 renewal".',
      },
    },
    required: ['name', 'canonicalKey'],
  },
  description: 'Distinct business topics. Fewer is better than forcing the maximum.',
}

const FACT_PROPS: Record<string, AiJsonSchema> = {
  decisions: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Decisions EXPLICITLY made or agreed in the text, one short sentence each ("Agreed to start with the monthly plan"). Empty array when none — do NOT invent.',
  },
  actionItems: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Concrete commitments or to-dos EXPLICITLY stated, one short sentence each, naming who does what ("Send the revised quote by Friday"). Empty array when none.',
  },
  risks: {
    type: 'array',
    items: { type: 'string' },
    description:
      'Risks, blockers or concerns EXPLICITLY raised ("Worried the integration slips past Q3"). Empty array when none.',
  },
}

const COMPANIES_PROP: AiJsonSchema = {
  type: 'array',
  items: { type: 'string' },
  description:
    'Company/organization names substantively discussed (proper names only, e.g. "Acme"). Exclude email providers, tools mentioned in passing, and the sender’s own signature company. Empty array when none.',
}

const CONVERSATION_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    topics: TOPIC_ITEMS,
    companies: COMPANIES_PROP,
    ...FACT_PROPS,
  },
  required: ['topics', 'decisions', 'actionItems', 'risks'],
}

const NOTE_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    topics: TOPIC_ITEMS,
    companies: COMPANIES_PROP,
    mentionedContacts: {
      type: 'array',
      items: { type: 'string' },
      description:
        'People from the provided CONTACTS list who are mentioned in the note. Copy names EXACTLY as they appear in the list. Never include a name that is not in the list.',
    },
    ...FACT_PROPS,
  },
  required: ['topics', 'mentionedContacts', 'decisions', 'actionItems', 'risks'],
}

const MEETING_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: '2–4 sentence summary of what the meeting covered and where things landed.',
    },
    topics: TOPIC_ITEMS,
    companies: COMPANIES_PROP,
    followUps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Up to 4 concrete suggested follow-ups after this meeting ("Email the revised quote"). Empty when none.',
    },
    ...FACT_PROPS,
  },
  required: ['summary', 'topics', 'decisions', 'actionItems', 'risks'],
}

const BRIEF_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    brief: {
      type: 'string',
      description:
        '2–4 sentences that get the user walking into the meeting prepared: who they are meeting, where the relationship stands, what matters right now. Grounded ONLY in the provided context.',
    },
    talkingPoints: {
      type: 'array',
      items: { type: 'string' },
      description: '2–5 short, concrete talking points or questions worth raising, grounded in the context.',
    },
  },
  required: ['brief', 'talkingPoints'],
}

// ── Validation helpers ───────────────────────────────────────────────────────

/** Advisory topic-key normalization. The AUTHORITATIVE key is re-derived by
 *  graph.service's normalizer at upsert time; this is a reasonable hint. */
function advisoryTopicKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanTopics(raw: unknown, max: number): ExtractedTopic[] {
  const list = Array.isArray(raw) ? raw : []
  const out: ExtractedTopic[] = []
  const seen = new Set<string>()
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const name = String((item as Record<string, unknown>).name ?? '').trim()
    if (!name || name.length > 60) continue
    const key = advisoryTopicKey(name)
    if (key.length < 2 || seen.has(key)) continue
    seen.add(key)
    out.push({ name, canonicalKey: key })
    if (out.length >= max) break
  }
  return out
}

function cleanStrings(raw: unknown, max: number, maxLen = 220): string[] {
  const list = Array.isArray(raw) ? raw : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const text = String(item ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (text.length < 3) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text.length > maxLen ? `${text.slice(0, maxLen - 1).trimEnd()}…` : text)
    if (out.length >= max) break
  }
  return out
}

function cleanFacts(raw: Record<string, unknown>): ExtractedFacts {
  return {
    decisions: cleanStrings(raw.decisions, 5),
    actionItems: cleanStrings(raw.actionItems, 6),
    risks: cleanStrings(raw.risks, 4),
  }
}

function existingTopicsBlock(existing: { name: string; canonicalKey: string }[]): string {
  if (!existing.length) return ''
  return `\n\nEXISTING TOPICS (reuse the EXACT name + key of one of these when the text is about the same thing — do NOT invent near-duplicate wording like "pricing" vs "price"):\n${existing
    .map((t) => `- ${t.name} (${t.canonicalKey})`)
    .join('\n')}`
}

const FACTS_RULES = `Rules for decisions / actionItems / risks:
- Include ONLY what is EXPLICITLY present in the text. Empty arrays are the correct answer when nothing qualifies.
- One short, self-contained sentence each, naming who/what — it will be read months later without the source.
- Respond in the SAME LANGUAGE as the source text.`

// ── Conversation flavor ──────────────────────────────────────────────────────

function buildConversationPrompt(p: ConversationKnowledgePayload): string {
  const thread = p.messages
    .map((m) => {
      const role = m.direction === 'INBOUND' ? `THEM (${p.contactName})` : 'ME'
      const body = m.content.length > 500 ? m.content.slice(0, 500) + '…' : m.content
      return `${role}: ${body}`
    })
    .join('\n\n')

  return `Extract knowledge from this ${p.subject ? `email thread "${p.subject}"` : 'email thread'} with "${p.contactName}", for a relationship knowledge base.

Return:
- topics: 1–3 distinct, reusable topic labels — the subjects a salesperson would file this conversation under (projects, products, deals, requests). Ignore pleasantries and signatures.
- companies: other companies substantively discussed (not the contact's own employer, not email providers).
- decisions / actionItems / risks: structured facts.

${FACTS_RULES}${existingTopicsBlock(p.existingTopics)}

CONVERSATION:
${thread}

Return a JSON object matching the schema.`
}

/**
 * One-call knowledge extraction for a conversation (supersedes the v1
 * topics-only extraction — same free-tier cost, four times the memory).
 */
export async function extractConversationKnowledge(
  payload: ConversationKnowledgePayload,
  opts: { fallbackOnRetryable?: boolean } = {},
): Promise<ConversationKnowledge> {
  const provider = getTextProvider()
  if (!provider || !payload.messages.length) return EMPTY_CONVERSATION_KNOWLEDGE

  try {
    const raw = await provider.generateJson<Record<string, unknown>>({
      prompt: buildConversationPrompt(payload),
      schema: CONVERSATION_SCHEMA,
      maxOutputTokens: 700,
    })
    return {
      topics: cleanTopics(raw.topics, 3),
      companies: cleanStrings(raw.companies, 3, 80),
      ...cleanFacts(raw),
    }
  } catch (err) {
    if (err instanceof AiProviderError && err.retryable && !opts.fallbackOnRetryable) throw err
    console.warn(`[ai] ${provider.name} conversation knowledge extraction failed (${String(err)}); skipping this round`)
    return EMPTY_CONVERSATION_KNOWLEDGE
  }
}

// ── Note flavor ──────────────────────────────────────────────────────────────

function buildNotePrompt(p: NoteKnowledgePayload): string {
  const contacts = p.contactNames.length
    ? `\n\nCONTACTS (the ONLY people you may report in mentionedContacts — copy names EXACTLY):\n${p.contactNames.map((n) => `- ${n}`).join('\n')}`
    : '\n\nCONTACTS: (none — mentionedContacts must be an empty array)'
  const body = p.body.length > 6000 ? p.body.slice(0, 6000) + '…' : p.body

  return `Extract knowledge from this personal note${p.title ? ` titled "${p.title}"` : ''}, for a relationship knowledge base.

Return:
- topics: 1–4 distinct, reusable topic labels the note is about.
- companies: companies/organizations substantively mentioned.
- mentionedContacts: people from the CONTACTS list who appear in the note (match names loosely — "John" matches "John Smith" if unambiguous — but OUTPUT the exact listed name).
- decisions / actionItems / risks: structured facts.

${FACTS_RULES}${existingTopicsBlock(p.existingTopics)}${contacts}

NOTE:
${body}

Return a JSON object matching the schema.`
}

export async function extractNoteKnowledge(
  payload: NoteKnowledgePayload,
  opts: { fallbackOnRetryable?: boolean } = {},
): Promise<NoteKnowledge> {
  const provider = getTextProvider()
  if (!provider || !payload.body.trim()) return EMPTY_NOTE_KNOWLEDGE

  try {
    const raw = await provider.generateJson<Record<string, unknown>>({
      prompt: buildNotePrompt(payload),
      schema: NOTE_SCHEMA,
      maxOutputTokens: 700,
    })
    // Names not present in the provided list are dropped outright (post-model
    // whitelist — the resolver in knowledge.extract re-validates against ids).
    const allowed = new Set(payload.contactNames.map((n) => n.trim().toLowerCase()))
    const mentioned = cleanStrings(raw.mentionedContacts, 6, 80).filter((n) => allowed.has(n.trim().toLowerCase()))
    return {
      topics: cleanTopics(raw.topics, 4),
      companies: cleanStrings(raw.companies, 3, 80),
      mentionedContacts: mentioned,
      ...cleanFacts(raw),
    }
  } catch (err) {
    if (err instanceof AiProviderError && err.retryable && !opts.fallbackOnRetryable) throw err
    console.warn(`[ai] ${provider.name} note knowledge extraction failed (${String(err)}); skipping this round`)
    return EMPTY_NOTE_KNOWLEDGE
  }
}

// ── Meeting flavor ───────────────────────────────────────────────────────────

function buildMeetingPrompt(p: MeetingKnowledgePayload): string {
  const transcript = p.transcript.length > 9000 ? p.transcript.slice(0, 9000) + '…' : p.transcript
  const attendees = p.attendeeNames.length ? `\nAttendees: ${p.attendeeNames.join(', ')}` : ''

  return `Extract knowledge from this meeting transcript / meeting notes, for a relationship knowledge base.

Meeting: "${p.title}" on ${p.startsAt}.${attendees}

Return:
- summary: 2–4 sentences — what was covered and where things landed.
- topics: 1–5 distinct, reusable topic labels the meeting was about.
- companies: companies/organizations substantively discussed.
- decisions / actionItems / risks: structured facts.
- followUps: up to 4 concrete suggested next steps for ME (the user), based only on what was said.

${FACTS_RULES}${existingTopicsBlock(p.existingTopics)}

TRANSCRIPT / NOTES:
${transcript}

Return a JSON object matching the schema.`
}

export async function extractMeetingKnowledge(
  payload: MeetingKnowledgePayload,
  opts: { fallbackOnRetryable?: boolean } = {},
): Promise<MeetingKnowledge> {
  const provider = getTextProvider()
  if (!provider || !payload.transcript.trim()) return EMPTY_MEETING_KNOWLEDGE

  try {
    const raw = await provider.generateJson<Record<string, unknown>>({
      prompt: buildMeetingPrompt(payload),
      schema: MEETING_SCHEMA,
      maxOutputTokens: 1100,
    })
    const summary = String(raw.summary ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    return {
      summary: summary.length > 900 ? `${summary.slice(0, 899).trimEnd()}…` : summary,
      topics: cleanTopics(raw.topics, 5),
      companies: cleanStrings(raw.companies, 4, 80),
      followUps: cleanStrings(raw.followUps, 4),
      ...cleanFacts(raw),
    }
  } catch (err) {
    if (err instanceof AiProviderError && err.retryable && !opts.fallbackOnRetryable) throw err
    console.warn(`[ai] ${provider.name} meeting knowledge extraction failed (${String(err)}); skipping this round`)
    return EMPTY_MEETING_KNOWLEDGE
  }
}

// ── Pre-meeting brief ────────────────────────────────────────────────────────

function buildBriefPrompt(p: MeetingBriefPayload): string {
  return `You are Velnox's AI inbox assistant. Write a pre-meeting brief for the user's upcoming meeting "${p.title}" (${p.startsAt}).

Ground EVERYTHING in the CONTEXT below — it is the real state of the user's relationships. Never invent facts, names or history. If context is thin, keep the brief short and say what's known.
Reply in the language the context is predominantly written in.

CONTEXT:
${p.contextLines.join('\n')}

Return a JSON object matching the schema (brief, talkingPoints).`
}

/**
 * AI paragraph + talking points for the pre-meeting brief. Returns null when
 * no provider is configured or the call fails non-retryably — the brief page
 * still renders its deterministic sections (attendees, threads, open items).
 */
export async function generateMeetingBrief(
  payload: MeetingBriefPayload,
  opts: { fallbackOnRetryable?: boolean } = {},
): Promise<MeetingBrief | null> {
  const provider = getTextProvider()
  if (!provider || !payload.contextLines.length) return null

  try {
    const raw = await provider.generateJson<Record<string, unknown>>({
      prompt: buildBriefPrompt(payload),
      schema: BRIEF_SCHEMA,
      maxOutputTokens: 600,
    })
    const brief = String(raw.brief ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!brief) return null
    return {
      brief: brief.length > 800 ? `${brief.slice(0, 799).trimEnd()}…` : brief,
      talkingPoints: cleanStrings(raw.talkingPoints, 5),
    }
  } catch (err) {
    if (err instanceof AiProviderError && err.retryable && !opts.fallbackOnRetryable) throw err
    console.warn(`[ai] ${provider.name} meeting brief failed (${String(err)}); brief omitted`)
    return null
  }
}
