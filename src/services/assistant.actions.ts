import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTextProvider } from './ai'
import { setAlertStatus } from './alert.service'
import { createReminder } from './reminder.service'
import { createContactNote } from './note.service'
import { enqueueMany } from './jobs/queue'
import { shortDate } from '@/lib/time'

/**
 * Agentic assistant actions.
 *
 * The LLM only *proposes* one action (in the answer schema); it never executes.
 * `parseAction` turns the raw model output into a strictly-typed, bounds-checked
 * action (or null), and `executeAction` runs it through normal, userId-scoped
 * service calls — so the model can't reach another user's data, can't send mail,
 * and can only do reversible things (queue review-before-send drafts, flip an
 * alert status, create a reminder). This split keeps the LLM out of the trust
 * boundary: parsing is pure and unit-tested; execution is ordinary authorized I/O.
 */

const MAX_BULK_DRAFTS = 10
const MAX_SNOOZE_DAYS = 30
const DEFAULT_SNOOZE_DAYS = 3
const MAX_REMINDER_AHEAD_MS = 366 * 86_400_000 // ~1 year guardrail on LLM date math

export type BulkDraftFilter = 'overdue_replies' | 'at_risk' | 'awaiting'
const BULK_FILTERS: BulkDraftFilter[] = ['overdue_replies', 'at_risk', 'awaiting']

export type TriageOp = 'resolve' | 'snooze' | 'acknowledge'
const TRIAGE_OPS: TriageOp[] = ['resolve', 'snooze', 'acknowledge']

export type AssistantAction =
  | { type: 'bulk_draft'; filter: BulkDraftFilter; summary: string }
  | { type: 'triage_alert'; conversationId: string; op: TriageOp; snoozeDays?: number; summary: string }
  | { type: 'create_reminder'; note: string; dueAt: string; conversationId?: string; contactName?: string; summary: string }
  | { type: 'create_note'; conversationId: string; body: string; summary: string }

export interface ActionResult {
  ok: boolean
  message: string
}

// ── Parsing / validation (pure, unit-tested) ─────────────────────────────────

/** Extract a conversation id from an `/inbox/<id>` href, or null. */
export function convIdFromHref(href: unknown): string | null {
  if (typeof href !== 'string') return null
  const m = href.match(/\/inbox\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

function clampSummary(s: string): string {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length <= 200 ? clean : `${clean.slice(0, 199).trimEnd()}…`
}

/**
 * Normalise a raw proposed action from the model into a typed AssistantAction,
 * or null if it's malformed / out of bounds. Pure: no I/O, deterministic.
 */
export function parseAction(raw: unknown, now: number = Date.now()): AssistantAction | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const summary = clampSummary(typeof o.summary === 'string' ? o.summary : '')
  if (!summary) return null
  const params = (o.params && typeof o.params === 'object' ? o.params : {}) as Record<string, unknown>

  switch (o.type) {
    case 'bulk_draft': {
      const filter = o.params && typeof params.filter === 'string' ? params.filter : ''
      if (!BULK_FILTERS.includes(filter as BulkDraftFilter)) return null
      return { type: 'bulk_draft', filter: filter as BulkDraftFilter, summary }
    }
    case 'triage_alert': {
      const conversationId = convIdFromHref(params.alertHref)
      if (!conversationId) return null
      const op = typeof params.op === 'string' ? params.op : ''
      if (!TRIAGE_OPS.includes(op as TriageOp)) return null
      const action: AssistantAction = { type: 'triage_alert', conversationId, op: op as TriageOp, summary }
      if (op === 'snooze') {
        const d = typeof params.snoozeDays === 'number' ? Math.round(params.snoozeDays) : DEFAULT_SNOOZE_DAYS
        action.snoozeDays = Math.max(1, Math.min(MAX_SNOOZE_DAYS, d))
      }
      return action
    }
    case 'create_reminder': {
      const note = typeof params.note === 'string' ? params.note.trim() : ''
      if (!note) return null
      const dueAtMs = typeof params.dueAt === 'string' ? Date.parse(params.dueAt) : NaN
      if (Number.isNaN(dueAtMs) || dueAtMs <= now || dueAtMs - now > MAX_REMINDER_AHEAD_MS) return null
      const conversationId = convIdFromHref(params.conversationHref) ?? undefined
      const contactRaw = typeof params.contactName === 'string' ? params.contactName.trim() : ''
      return {
        type: 'create_reminder',
        note: note.slice(0, 500),
        dueAt: new Date(dueAtMs).toISOString(),
        conversationId,
        contactName: contactRaw ? contactRaw.slice(0, 120) : undefined,
        summary,
      }
    }
    case 'create_note': {
      const conversationId = convIdFromHref(params.contactHref)
      if (!conversationId) return null
      const body = typeof params.body === 'string' ? params.body.trim() : ''
      if (!body) return null
      return { type: 'create_note', conversationId, body: body.slice(0, 2000), summary }
    }
    default:
      return null
  }
}

const ID_RE = /^[A-Za-z0-9_-]+$/

/**
 * Validate a NORMALISED action coming back from the confirm card (execute time).
 * Unlike parseAction (which reads the raw model `params` shape), this reads the
 * already-normalised AssistantAction the client echoes back. We never trust the
 * client: shape + bounds are re-checked here, and executeAction's DB calls are
 * userId-scoped, so a tampered id simply matches nothing.
 */
export function coerceAction(raw: unknown, now: number = Date.now()): AssistantAction | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const summary = typeof o.summary === 'string' ? clampSummary(o.summary) : ''

  switch (o.type) {
    case 'bulk_draft': {
      if (!BULK_FILTERS.includes(o.filter as BulkDraftFilter)) return null
      return { type: 'bulk_draft', filter: o.filter as BulkDraftFilter, summary }
    }
    case 'triage_alert': {
      const conversationId = typeof o.conversationId === 'string' ? o.conversationId : ''
      if (!ID_RE.test(conversationId) || !TRIAGE_OPS.includes(o.op as TriageOp)) return null
      const action: AssistantAction = { type: 'triage_alert', conversationId, op: o.op as TriageOp, summary }
      if (o.op === 'snooze') {
        const d = typeof o.snoozeDays === 'number' ? Math.round(o.snoozeDays) : DEFAULT_SNOOZE_DAYS
        action.snoozeDays = Math.max(1, Math.min(MAX_SNOOZE_DAYS, d))
      }
      return action
    }
    case 'create_reminder': {
      const note = typeof o.note === 'string' ? o.note.trim() : ''
      if (!note) return null
      const dueMs = typeof o.dueAt === 'string' ? Date.parse(o.dueAt) : NaN
      if (Number.isNaN(dueMs) || dueMs <= now || dueMs - now > MAX_REMINDER_AHEAD_MS) return null
      const conversationId =
        typeof o.conversationId === 'string' && ID_RE.test(o.conversationId) ? o.conversationId : undefined
      const contactName = typeof o.contactName === 'string' && o.contactName.trim() ? o.contactName.trim().slice(0, 120) : undefined
      return { type: 'create_reminder', note: note.slice(0, 500), dueAt: new Date(dueMs).toISOString(), conversationId, contactName, summary }
    }
    case 'create_note': {
      const conversationId = typeof o.conversationId === 'string' ? o.conversationId : ''
      const body = typeof o.body === 'string' ? o.body.trim() : ''
      if (!ID_RE.test(conversationId) || !body) return null
      return { type: 'create_note', conversationId, body: body.slice(0, 2000), summary }
    }
    default:
      return null
  }
}

// ── Execution (authorized, userId-scoped I/O) ────────────────────────────────

const DRAFT_WHERE: Record<BulkDraftFilter, Prisma.ConversationWhereInput> = {
  overdue_replies: { awaitingReply: true, priority: { in: ['HOT', 'ATTENTION'] }, draft: { is: null } },
  at_risk: { analysis: { riskLevel: { in: ['HIGH', 'CRITICAL'] } }, draft: { is: null } },
  awaiting: { awaitingReply: true, draft: { is: null } },
}

async function execBulkDraft(organizationId: string, actorId: string, filter: BulkDraftFilter): Promise<ActionResult> {
  if (!getTextProvider()) {
    return { ok: false, message: 'Drafting needs an AI key, and none is configured right now.' }
  }
  const convs = await prisma.conversation.findMany({
    where: { organizationId, status: 'ACTIVE', integration: { isActive: true }, ...DRAFT_WHERE[filter] },
    select: { id: true },
    orderBy: { priorityScore: 'desc' },
    take: MAX_BULK_DRAFTS,
  })
  if (!convs.length) return { ok: true, message: 'No matching threads need a draft right now.' }
  const n = await enqueueMany('GENERATE_DRAFT', convs.map((c) => ({ conversationId: c.id })), { userId: actorId })
  return {
    ok: true,
    message: `Drafting replies for ${n} thread${n === 1 ? '' : 's'} — each will show a “draft ready” badge in your inbox shortly. Nothing is sent automatically.`,
  }
}

async function execTriageAlert(
  organizationId: string,
  action: Extract<AssistantAction, { type: 'triage_alert' }>,
): Promise<ActionResult> {
  const alert = await prisma.riskAlert.findFirst({
    where: { organizationId, conversationId: action.conversationId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    orderBy: { lastSeenAt: 'desc' },
  })
  if (!alert) return { ok: false, message: 'No open alert is linked to that thread anymore.' }

  await setAlertStatus(organizationId, alert.id, action.op, { snoozeDays: action.snoozeDays })
  const verb =
    action.op === 'resolve'
      ? 'Resolved'
      : action.op === 'snooze'
        ? `Snoozed for ${action.snoozeDays ?? DEFAULT_SNOOZE_DAYS} day${(action.snoozeDays ?? DEFAULT_SNOOZE_DAYS) === 1 ? '' : 's'}`
        : 'Acknowledged'
  return { ok: true, message: `${verb}: ${alert.title}.` }
}

async function execCreateReminder(
  organizationId: string,
  actorId: string,
  action: Extract<AssistantAction, { type: 'create_reminder' }>,
): Promise<ActionResult> {
  const reminder = await createReminder(organizationId, actorId, {
    note: action.note,
    dueAt: new Date(action.dueAt),
    conversationId: action.conversationId ?? null,
    contactName: action.contactName ?? null,
  })
  return { ok: true, message: `Reminder set for ${shortDate(reminder.dueAt)}: “${reminder.note}”.` }
}

async function execCreateNote(
  organizationId: string,
  actorId: string,
  action: Extract<AssistantAction, { type: 'create_note' }>,
): Promise<ActionResult> {
  const conv = await prisma.conversation.findFirst({
    where: { id: action.conversationId, organizationId },
    select: { contactId: true, contact: { select: { name: true } } },
  })
  if (!conv) return { ok: false, message: 'That contact isn’t in your workspace anymore.' }

  const note = await createContactNote(organizationId, actorId, { contactId: conv.contactId, body: action.body, source: 'assistant' })
  if (!note) return { ok: false, message: 'Couldn’t save the note.' }
  const preview = action.body.length > 80 ? `${action.body.slice(0, 79).trimEnd()}…` : action.body
  return { ok: true, message: `Note saved for ${conv.contact.name}: “${preview}”.` }
}

/** Run a validated action through authorized, org-scoped services. `actorId` is
 * the acting member (authorship); `organizationId` is the tenant boundary. */
export async function executeAction(
  organizationId: string,
  actorId: string,
  action: AssistantAction,
): Promise<ActionResult> {
  switch (action.type) {
    case 'bulk_draft':
      return execBulkDraft(organizationId, actorId, action.filter)
    case 'triage_alert':
      return execTriageAlert(organizationId, action)
    case 'create_reminder':
      return execCreateReminder(organizationId, actorId, action)
    case 'create_note':
      return execCreateNote(organizationId, actorId, action)
  }
}
