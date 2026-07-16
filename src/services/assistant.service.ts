import type { Reminder } from '@prisma/client'
import { getTextProvider } from './ai'
import { AiProviderError, type AiJsonSchema } from './ai/types'
import { getDashboardData, type DashboardData } from './dashboard.service'
import { parseAction, type AssistantAction } from './assistant.actions'
import { listReminders } from './reminder.service'
import { listRecentNotes, type RecentNote } from './note.service'
import { recallKnowledge, EMPTY_RECALL, type KnowledgeRecall } from './knowledge.recall'
import type { NodeChip } from './graph.service'
import { shortDate } from '@/lib/time'

/**
 * Workspace Q&A assistant — the conversational layer behind /assistant.
 *
 * Answers are GROUNDED: the model only sees a compact briefing derived from the
 * same dashboard read-model the user already looks at (stats, urgent threads,
 * at-risk clients, relationships, recent activity), so it never invents data.
 * Returned source links are validated against a whitelist of hrefs we actually
 * provided, so the assistant can't hallucinate a thread URL.
 *
 * Degrades gracefully: with no API key (or on a non-retryable provider error)
 * it falls back to a deterministic local answer built from the same briefing,
 * tagged `mode: 'local'` so the UI can be honest about it.
 */

export interface AssistantSource {
  label: string
  href: string
}

export interface AssistantAnswer {
  answer: string
  sources: AssistantSource[]
  followUps: string[]
  mode: 'gemini' | 'local'
  /** true when the answer came from the offline heuristic instead of the AI. */
  degraded: boolean
  hasIntegration: boolean
  hasData: boolean
  /**
   * An action the assistant proposes to take (drafts, alert triage, reminder),
   * pending the user's explicit confirmation. Never executed here; only the AI
   * path proposes (offline mode answers in text only).
   */
  proposedAction: AssistantAction | null
  /**
   * When `degraded`, WHY we fell back to the offline answer — so the UI can be
   * honest (a 429 is "rate-limited", NOT "connect a Gemini key"). null on the
   * full AI path and on the no-integration/no-data short-circuits (whose answer
   * text already explains itself).
   */
  degradedReason: DegradedReason
  /**
   * Knowledge-base nodes the question touched (matched entities + their
   * strongest connections) — powers the chat's knowledge rail. Server-derived
   * from the graph, never model output.
   */
  related: NodeChip[]
}

export type DegradedReason = null | 'no-key' | 'rate-limited' | 'unavailable' | 'error'

/** Classify a failed AI call into a user-facing degradation reason. */
export function degradedReasonFor(err: unknown): Exclude<DegradedReason, null> {
  if (err instanceof AiProviderError) {
    if (err.kind === 'rate_limit') return 'rate-limited'
    if (err.kind === 'unavailable') return 'unavailable'
  }
  return 'error'
}

const ANSWER_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    answer: {
      type: 'string',
      description:
        'A concise, direct answer (1–4 short paragraphs or a short bullet list using "- " lines). Ground every claim in the BRIEFING. If the briefing lacks the info, say so plainly. Reply in the same language as the question.',
    },
    sources: {
      type: 'array',
      description:
        'Up to 4 threads or pages referenced in the answer. Use ONLY hrefs that appear verbatim in the briefing. Empty array when nothing specific is referenced.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Short human label, e.g. the client name or page name.' },
          href: { type: 'string', description: 'An href copied verbatim from the briefing (e.g. /inbox/abc or /clients).' },
        },
        required: ['label', 'href'],
      },
    },
    followUps: {
      type: 'array',
      description: 'Up to 3 short, useful follow-up questions the user might ask next, in the question’s language.',
      items: { type: 'string' },
    },
    proposedAction: {
      type: 'object',
      description:
        'OPTIONAL. Include ONLY when the user is clearly asking you to DO one of these: draft replies in bulk, follow up on someone going cold, set a follow-up reminder, or save a note about a contact. Omit entirely for informational questions. This is a PROPOSAL the user must confirm — it is never executed automatically.',
      properties: {
        type: { type: 'string', enum: ['bulk_draft', 'triage_alert', 'create_reminder', 'create_note'] },
        summary: {
          type: 'string',
          description:
            'One short sentence stating exactly what will happen if confirmed, e.g. "Draft replies to your 4 overdue threads." In the question’s language.',
        },
        params: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              enum: ['overdue_replies', 'at_risk', 'awaiting'],
              description: 'bulk_draft only: which threads to draft for.',
            },
            alertHref: {
              type: 'string',
              description: 'triage_alert only: the /inbox/<id> href (verbatim from the briefing) of the at-risk thread.',
            },
            op: {
              type: 'string',
              enum: ['resolve', 'snooze', 'acknowledge'],
              description: 'triage_alert only: what to do with the alert.',
            },
            snoozeDays: { type: 'number', description: 'triage_alert snooze only: number of days (default 3).' },
            note: { type: 'string', description: 'create_reminder only: what to be reminded about.' },
            dueAt: {
              type: 'string',
              description:
                'create_reminder only: ISO 8601 datetime in the FUTURE, computed from the "Current time" in the briefing.',
            },
            conversationHref: {
              type: 'string',
              description: 'create_reminder only: optional /inbox/<id> href (verbatim from briefing) the reminder relates to.',
            },
            contactHref: {
              type: 'string',
              description: 'create_note only: /inbox/<id> href (verbatim from briefing) of the person the note is about.',
            },
            body: { type: 'string', description: 'create_note only: the note text to save about that contact.' },
          },
        },
      },
      required: ['type', 'summary'],
    },
  },
  required: ['answer', 'sources', 'followUps'],
}

const STATIC_SOURCES: { href: string; label: string }[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/dashboard?tab=trends', label: 'Trends' },
  { href: '/clients', label: 'Contacts' },
  { href: '/settings', label: 'Settings' },
]

/** Build the href → label whitelist the model is allowed to cite. */
function buildSourceMap(data: DashboardData, recall: KnowledgeRecall): Map<string, string> {
  const map = new Map<string, string>()
  for (const s of STATIC_SOURCES) map.set(s.href, s.label)
  for (const s of recall.sourceEntries) if (!map.has(s.href)) map.set(s.href, s.label)

  const note = (href: string, label: string) => {
    if (href && !map.has(href)) map.set(href, label)
  }

  if (data.nextBestAction) {
    note(data.nextBestAction.href, threadLabel(data.nextBestAction.contactName, data.nextBestAction.subject))
  }
  for (const c of data.commandCenter) note(c.href, threadLabel(c.contactName, c.subject))
  for (const r of data.riskClients) note(r.href, `${r.name} · ${r.risk.toLowerCase()} risk`)
  for (const group of [data.relationships.strongest, data.relationships.weakening, data.relationships.opportunities]) {
    for (const r of group) note(r.href, r.name)
  }
  for (const t of data.timeline) if (t.href) note(t.href, t.title)
  return map
}

function threadLabel(name: string, subject: string | null): string {
  return subject ? `${name} · ${subject}` : name
}

function clamp(s: string, max: number): string {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}

/** Compact, model-facing snapshot of the workspace. */
function buildBriefing(
  data: DashboardData,
  reminders: Reminder[],
  notes: RecentNote[],
  recall: KnowledgeRecall,
  now: number,
): string {
  const lines: string[] = []
  const s = data.stats

  lines.push(`WORKSPACE BRIEFING${data.integrationEmail ? ` for ${data.integrationEmail}` : ''}`)
  lines.push(`Current time: ${new Date(now).toISOString()}`)
  lines.push(`Last Gmail sync: ${data.lastSyncAgo ?? 'never'}`)
  lines.push('')
  lines.push('KEY METRICS')
  lines.push(`- Active conversations: ${s.conversations.value} (${s.conversations.activeThisWeek} active this week)`)
  lines.push(`- High priority: ${s.highPriority.value} (${s.highPriority.hot} hot, ${s.highPriority.attention} attention)`)
  lines.push(`- Clients at risk: ${s.clientsAtRisk.value} of ${s.clientsAtRisk.totalClients} total clients`)
  lines.push(
    `- Awaiting your reply: ${s.unanswered.value}` +
      ` (${s.unanswered.overdue24h} overdue 24h+${s.unanswered.oldestWait ? `, oldest waiting ${s.unanswered.oldestWait}` : ''})`,
  )
  lines.push(`- Suggested follow-ups: ${s.followUps.value} (${s.followUps.fromAi} from AI, ${s.followUps.goneQuiet} gone quiet)`)
  if (s.health.score !== null) {
    lines.push(`- Inbox health: ${s.health.score}/100${s.health.topFactor ? ` (biggest drag: ${s.health.topFactor})` : ''}`)
  }

  const actions = [data.nextBestAction, ...data.commandCenter].filter(Boolean) as NonNullable<DashboardData['nextBestAction']>[]
  if (actions.length) {
    lines.push('')
    lines.push('MOST URGENT THREADS (act on these first)')
    actions.slice(0, 6).forEach((c, i) => {
      lines.push(`${i + 1}. ${threadLabel(c.contactName, c.subject)} [${c.href}]`)
      if (c.reasons.length) lines.push(`   why: ${c.reasons.join('; ')}`)
      if (c.waiting) lines.push(`   waiting: ${c.waiting}`)
      if (c.nextAction) lines.push(`   suggested next step: ${clamp(c.nextAction, 140)}`)
      else if (c.summary) lines.push(`   summary: ${clamp(c.summary, 140)}`)
    })
  }

  if (data.riskClients.length) {
    lines.push('')
    lines.push('CLIENTS AT RISK')
    for (const r of data.riskClients) {
      lines.push(
        `- ${r.name} (${r.risk} risk, engagement ${r.engagement}/100${r.waiting ? `, reply ${r.waiting} overdue` : ''}): ${r.reason} [${r.href}]`,
      )
    }
  }

  const { strongest, weakening, opportunities } = data.relationships
  if (strongest.length || weakening.length || opportunities.length) {
    lines.push('')
    lines.push('RELATIONSHIPS')
    if (strongest.length) lines.push(`- Strongest: ${strongest.map((r) => `${r.name} (${r.note})`).join('; ')}`)
    if (weakening.length) lines.push(`- Weakening: ${weakening.map((r) => `${r.name} (${r.note}) [${r.href}]`).join('; ')}`)
    if (opportunities.length) lines.push(`- New opportunities: ${opportunities.map((r) => `${r.name} (${r.note}) [${r.href}]`).join('; ')}`)
  }

  if (data.timeline.length) {
    lines.push('')
    lines.push('RECENT ACTIVITY')
    for (const t of data.timeline.slice(0, 8)) {
      lines.push(`- ${t.timeAgo}: ${t.title}${t.detail ? ` — ${t.detail}` : ''}`)
    }
  }

  if (reminders.length) {
    lines.push('')
    lines.push('YOUR REMINDERS (pending follow-ups you set)')
    for (const r of reminders.slice(0, 10)) {
      const due = r.dueAt.getTime() <= now ? 'DUE NOW' : `due ${shortDate(r.dueAt)}`
      const ref = r.conversationId ? ` [/inbox/${r.conversationId}]` : r.contactName ? ` (${r.contactName})` : ''
      lines.push(`- ${due}: ${r.note}${ref}`)
    }
  }

  if (notes.length) {
    lines.push('')
    lines.push('NOTES YOU SAVED ABOUT CONTACTS')
    for (const n of notes.slice(0, 10)) {
      lines.push(`- ${n.contactName} (${shortDate(n.createdAt)}): ${clamp(n.body, 160)}`)
    }
  }

  if (recall.briefingLines.length) {
    lines.push('')
    lines.push('KNOWLEDGE (the question mentions these — connections and recorded facts from the knowledge base)')
    lines.push(...recall.briefingLines)
  }

  return lines.join('\n')
}

function buildPrompt(question: string, briefing: string): string {
  return `You are Velnox's AI inbox assistant for one person managing their own email. You answer questions about their contacts, email threads and follow-ups.

Rules:
- Answer ONLY from the BRIEFING below. It is the live, real state of their inbox. Never invent contacts, numbers, threads or events.
- If the briefing does not contain enough to answer, say so honestly and suggest what they could do (e.g. sync, open a page).
- Be concise and specific. Prefer naming real contacts/threads from the briefing over generic advice.
- When you reference a thread or page, add it to "sources" using an href copied verbatim from the briefing (the [/...] tokens).
- The KNOWLEDGE section (when present) is the user's knowledge base: connections between people, companies and topics, plus recorded decisions/action items/risks. Prefer it for "who/what/relationship/history" questions, and cite its [/knowledge?...] hrefs when you rely on it.
- You can DO four things when (and only when) the user clearly asks you to act: draft replies in bulk (bulk_draft), follow up on someone going cold (triage_alert), set a follow-up reminder (create_reminder), or save a note about a contact (create_note — put the note text in params.body and the person's /inbox href in params.contactHref). In that case fill "proposedAction" — it is a PROPOSAL the user confirms, never auto-executed. For any informational question, OMIT proposedAction. Use only hrefs and the "Current time" from the briefing for action params.
- Reply in the SAME LANGUAGE as the question.

BRIEFING:
${briefing}

QUESTION: ${question.replace(/\s+/g, ' ').trim()}

Return JSON matching the provided schema.`
}

function validateSources(raw: unknown, allowed: Map<string, string>): AssistantSource[] {
  if (!Array.isArray(raw)) return []
  const out: AssistantSource[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const href = String((item as Record<string, unknown>).href ?? '').trim()
    if (!allowed.has(href) || seen.has(href)) continue
    seen.add(href)
    const rawLabel = String((item as Record<string, unknown>).label ?? '').trim()
    out.push({ href, label: rawLabel || allowed.get(href)! })
    if (out.length >= 4) break
  }
  return out
}

function validateFollowUps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => clamp(String(x ?? ''), 90))
    .filter((s) => s.length >= 4)
    .slice(0, 3)
}

/**
 * Parse + sanity-check a proposed action. Beyond parseAction's shape/bounds
 * checks, any thread the action references must be one we actually surfaced in
 * the briefing (in `allowed`), so the model can't act on a fabricated thread.
 * Returns null when there is no valid, grounded action to propose.
 */
function validateProposedAction(raw: unknown, allowed: Map<string, string>, now: number): AssistantAction | null {
  const action = parseAction(raw, now)
  if (!action) return null
  const refId =
    action.type === 'triage_alert' || action.type === 'create_note'
      ? action.conversationId
      : action.type === 'create_reminder'
        ? action.conversationId
        : null
  if (refId && !allowed.has(`/inbox/${refId}`)) return null
  return action
}

// ── Local (offline) fallback ────────────────────────────────────────────────

const DEFAULT_FOLLOWUPS = [
  'Who should I follow up with today?',
  'Who’s going cold?',
  'What changed this week?',
]

/**
 * Deterministic answer from the briefing when no AI provider is available.
 * Light keyword routing keeps it genuinely useful (not a canned message).
 */
function localAnswer(
  question: string,
  data: DashboardData,
  recall: KnowledgeRecall,
): { answer: string; sources: AssistantSource[]; followUps: string[] } {
  const q = question.toLowerCase()
  const s = data.stats
  const sources: AssistantSource[] = []
  const push = (href: string, label: string) => {
    if (href && !sources.some((x) => x.href === href)) sources.push({ href, label })
  }

  // The question named things the knowledge base knows → answer from memory.
  if (recall.briefingLines.length) {
    const lines = ['Here’s what your knowledge base has on that:']
    for (const l of recall.briefingLines.slice(0, 10)) lines.push(l.replace(/ \[\/[^\]]*\]/g, ''))
    for (const src of recall.sourceEntries.slice(0, 3)) push(src.href, src.label)
    return { answer: lines.join('\n'), sources: sources.slice(0, 4), followUps: DEFAULT_FOLLOWUPS }
  }

  const asksRisk = /(risk|churn|losing|at[- ]risk|cold|quiet|slipping|угроз|риск|тер|молч)/.test(q)
  const asksFollowUp = /(follow|reply|respond|waiting|unanswer|overdue|today|next|ответ|след|ждут|ждет|просроч)/.test(q)
  const asksTrend = /(week|change|trend|pipeline|how am i|progress|недел|измен|трен|динам)/.test(q)

  const lines: string[] = []

  if (asksRisk && data.riskClients.length) {
    lines.push(`${data.riskClients.length} client${data.riskClients.length === 1 ? '' : 's'} need attention right now:`)
    for (const r of data.riskClients.slice(0, 5)) {
      lines.push(`- ${r.name} (${r.risk.toLowerCase()} risk)${r.waiting ? `, reply ${r.waiting} overdue` : ''} — ${r.reason}`)
      push(r.href, `${r.name} · ${r.risk.toLowerCase()} risk`)
    }
  } else if (asksFollowUp && (data.nextBestAction || data.commandCenter.length)) {
    const actions = [data.nextBestAction, ...data.commandCenter].filter(Boolean) as NonNullable<DashboardData['nextBestAction']>[]
    lines.push(`Your most urgent threads to act on:`)
    for (const c of actions.slice(0, 5)) {
      const why = c.reasons[0] ?? c.nextAction ?? 'Needs a reply'
      lines.push(`- ${c.contactName}${c.waiting ? ` (waiting ${c.waiting})` : ''} — ${clamp(why, 110)}`)
      push(c.href, threadLabel(c.contactName, c.subject))
    }
  } else if (asksTrend) {
    lines.push(`This week's snapshot:`)
    lines.push(`- ${s.conversations.activeThisWeek} active conversation${s.conversations.activeThisWeek === 1 ? '' : 's'}, ${s.highPriority.value} high priority.`)
    lines.push(`- ${s.unanswered.value} awaiting your reply (${s.unanswered.overdue24h} overdue 24h+).`)
    lines.push(`- ${s.clientsAtRisk.value} of ${s.clientsAtRisk.totalClients} contacts going cold.`)
    if (s.health.score !== null) lines.push(`- Inbox health is ${s.health.score}/100${s.health.topFactor ? ` (biggest drag: ${s.health.topFactor})` : ''}.`)
    push('/dashboard', 'Dashboard')
  } else {
    // General status overview.
    lines.push(`Here's where things stand:`)
    lines.push(`- ${s.conversations.value} active conversations, ${s.unanswered.value} awaiting your reply.`)
    lines.push(`- ${s.clientsAtRisk.value} contact${s.clientsAtRisk.value === 1 ? '' : 's'} going cold, ${s.followUps.value} follow-up${s.followUps.value === 1 ? '' : 's'} suggested.`)
    if (data.nextBestAction) {
      const a = data.nextBestAction
      lines.push(`- Top priority: ${a.contactName}${a.waiting ? ` (waiting ${a.waiting})` : ''} — ${clamp(a.reasons[0] ?? a.nextAction ?? 'review thread', 110)}.`)
      push(a.href, threadLabel(a.contactName, a.subject))
    }
    if (s.health.score !== null) lines.push(`- Inbox health: ${s.health.score}/100.`)
    push('/dashboard', 'Dashboard')
  }

  return { answer: lines.join('\n'), sources: sources.slice(0, 4), followUps: DEFAULT_FOLLOWUPS }
}

// ── Public entry point ──────────────────────────────────────────────────────

export async function answerWorkspaceQuestion(
  organizationId: string,
  question: string,
  userId?: string,
): Promise<AssistantAnswer> {
  const data = await getDashboardData(organizationId)
  const base = { hasIntegration: data.hasIntegration, hasData: data.hasData, proposedAction: null, degradedReason: null, related: [] as NodeChip[] }

  // Empty workspace — short-circuit with an honest, actionable message.
  if (!data.hasIntegration) {
    return {
      answer:
        'No mailbox is connected yet, so I have nothing to answer from. Connect your Gmail in Settings → Connections and run a sync — then I can answer questions about your clients, threads and pipeline.',
      sources: [{ href: '/settings?tab=connections', label: 'Connect Gmail' }],
      followUps: DEFAULT_FOLLOWUPS,
      mode: 'local',
      degraded: true,
      ...base,
    }
  }
  if (!data.hasData) {
    return {
      answer:
        'Your mailbox is connected but no conversations have synced yet. Run a Gmail sync (Command Palette → “Sync Gmail now”) and ask me again once your threads are in.',
      sources: [{ href: '/dashboard', label: 'Dashboard' }],
      followUps: DEFAULT_FOLLOWUPS,
      mode: 'local',
      degraded: true,
      ...base,
    }
  }

  const reminders = await listReminders(organizationId)
  const notes = await listRecentNotes(organizationId)
  // Knowledge recall: what does the graph know about the things the question
  // names? Best-effort — an empty recall changes nothing.
  const recall = userId ? await recallKnowledge(userId, question) : EMPTY_RECALL
  base.related = recall.related

  const provider = getTextProvider()
  // Reason we'd show offline output: no key, or (set in catch) a failed call.
  let degradedReason: Exclude<DegradedReason, null> = provider ? 'error' : 'no-key'
  if (provider) {
    try {
      const now = Date.now()
      const briefing = buildBriefing(data, reminders, notes, recall, now)
      const allowed = buildSourceMap(data, recall)
      const raw = await provider.generateJson<Record<string, unknown>>({
        prompt: buildPrompt(question, briefing),
        schema: ANSWER_SCHEMA,
        maxOutputTokens: 900,
      })
      const answer = clamp(String(raw.answer ?? ''), 2000)
      if (answer) {
        const followUps = validateFollowUps(raw.followUps)
        return {
          answer,
          sources: validateSources(raw.sources, allowed),
          followUps: followUps.length ? followUps : DEFAULT_FOLLOWUPS,
          mode: 'gemini',
          degraded: false,
          ...base,
          proposedAction: validateProposedAction(raw.proposedAction, allowed, now),
        }
      }
      // Empty model output — fall through to the local answer (reason 'error').
    } catch (err) {
      degradedReason = degradedReasonFor(err)
      if (err instanceof AiProviderError && err.retryable) {
        // Quota/transient: don't fail the request, degrade to the local answer.
        console.warn('[assistant] provider rate-limited/unavailable, using local answer:', err.message)
      } else {
        console.warn('[assistant] provider failed, using local answer:', String(err))
      }
    }
  }

  const local = localAnswer(question, data, recall)
  return { ...local, mode: 'local', degraded: true, ...base, degradedReason }
}
