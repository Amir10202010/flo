import { prisma } from '@/lib/prisma'
import { dayKey, shortDate, daysAgoDate } from '@/lib/time'

/**
 * Shared data layer for the workspace metrics services
 * (dashboard.service / analytics.service / clients.service).
 *
 * One `loadWorkspace()` call fetches everything the dashboards derive from:
 *   - active integration (sync status, account email)
 *   - conversations + contact + AI analysis + latest message direction
 *   - 35 days of message events (direction + timestamp only — cheap rows)
 *   - recent completed sync jobs (for the activity timeline)
 *
 * Everything else is pure derivation — no extra queries per widget.
 */

export type Dir = 'INBOUND' | 'OUTBOUND'

export interface MsgEvent {
  conversationId: string
  direction: Dir
  sentAt: Date
}

export async function loadWorkspace(organizationId: string) {
  const since = daysAgoDate(35)

  // The runtime pool is intentionally small (Supabase transaction pooler —
  // see DATABASE_URL's connection_limit). Queries run SEQUENTIALLY on purpose:
  // a Promise.all() here makes the extra queries sit in Prisma's pool queue,
  // and under concurrent page renders those waiters exceed pool_timeout
  // (P2024: "Timed out fetching a new connection from the connection pool").
  // Short sequential queries borrow at most one connection per request.
  //
  // Org-scoped (shared inbox): every member sees the org's connected mailboxes,
  // conversations and sync history. `ownerIds` is the set of users whose Gmail
  // sync jobs feed this org (used for the activity timeline below).
  const integrations = await prisma.integration.findMany({
    where: { organizationId, isActive: true },
    select: { userId: true, type: true, metadata: true, syncedAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const integration = integrations[0] ?? null
  const ownerIds = [...new Set(integrations.map((i) => i.userId))]

  const conversations = await prisma.conversation.findMany({
    where: { organizationId, integration: { isActive: true } },
    select: {
      id: true,
      subject: true,
      status: true,
      priority: true,
      priorityScore: true,
      lastMessageAt: true,
      createdAt: true,
      channel: true,
      contact: { select: { id: true, name: true, email: true, createdAt: true } },
      analysis: {
        select: {
          summary: true,
          riskLevel: true,
          riskReasons: true,
          nextAction: true,
          lostReason: true,
          sentiment: true,
          updatedAt: true,
        },
      },
      messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { direction: true, sentAt: true } },
    },
    orderBy: [{ priorityScore: 'desc' }, { lastMessageAt: 'desc' }],
    take: 400,
  })

  // Message events by conversation id — hits @@index([conversationId, sentAt])
  // directly instead of joining through user → integration. Fetched newest-first
  // so the row cap keeps the most recent window, then reversed to chronological
  // order (consumers like the timeline expect ascending sentAt).
  let messages: MsgEvent[] = []
  if (conversations.length > 0) {
    const rows = await prisma.message.findMany({
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        sentAt: { gte: since },
      },
      select: { conversationId: true, direction: true, sentAt: true },
      orderBy: { sentAt: 'desc' },
      take: 4000,
    })
    messages = rows.reverse().map((m) => ({ ...m, direction: m.direction as Dir }))
  }

  const syncJobs = ownerIds.length
    ? await prisma.job.findMany({
        where: { userId: { in: ownerIds }, type: 'GMAIL_SYNC', status: 'COMPLETED' },
        orderBy: { finishedAt: 'desc' },
        take: 3,
        select: { id: true, finishedAt: true, result: true },
      })
    : []

  return { integration, conversations, messages, syncJobs, now: Date.now() }
}

export type Workspace = Awaited<ReturnType<typeof loadWorkspace>>
export type WorkspaceConversation = Workspace['conversations'][number]

// ── Pure derivations ────────────────────────────────────────────────────────

/** Per-day inbound/outbound counts for the trailing `days` window (today inclusive). */
export function dailyVolume(msgs: MsgEvent[], days: number, now = Date.now()) {
  const buckets = new Map<string, { date: string; label: string; inbound: number; outbound: number }>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000)
    buckets.set(dayKey(d), { date: dayKey(d), label: shortDate(d), inbound: 0, outbound: 0 })
  }
  for (const m of msgs) {
    const b = buckets.get(dayKey(m.sentAt))
    if (!b) continue
    if (m.direction === 'INBOUND') b.inbound++
    else b.outbound++
  }
  return [...buckets.values()]
}

/** Distinct conversations with any activity per day — the "active threads" sparkline. */
export function dailyActiveConversations(msgs: MsgEvent[], days: number, now = Date.now()): number[] {
  const buckets = new Map<string, Set<string>>()
  const order: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(new Date(now - i * 86_400_000))
    buckets.set(key, new Set())
    order.push(key)
  }
  for (const m of msgs) {
    buckets.get(dayKey(m.sentAt))?.add(m.conversationId)
  }
  return order.map((k) => buckets.get(k)!.size)
}

export interface ReplyPair {
  hours: number
  repliedAt: Date
}

export interface ReplyStats {
  /** Each inbound "burst" that received an outbound reply, with the wait in hours. */
  pairs: ReplyPair[]
  /** Inbound bursts (within the window) still waiting for a reply. */
  unansweredBursts: number
}

/**
 * Walk each conversation chronologically; the first inbound message of a burst
 * starts a timer that the next outbound reply stops. Waits over 7 days are
 * treated as outliers and dropped from averages.
 */
export function replyStats(msgs: MsgEvent[]): ReplyStats {
  const byConv = new Map<string, MsgEvent[]>()
  for (const m of msgs) {
    const arr = byConv.get(m.conversationId)
    if (arr) arr.push(m)
    else byConv.set(m.conversationId, [m])
  }

  const pairs: ReplyPair[] = []
  let unansweredBursts = 0

  for (const arr of byConv.values()) {
    arr.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
    let burstStart: Date | null = null
    for (const m of arr) {
      if (m.direction === 'INBOUND') {
        if (!burstStart) burstStart = m.sentAt
      } else if (burstStart) {
        const hours = (m.sentAt.getTime() - burstStart.getTime()) / 3_600_000
        if (hours >= 0 && hours <= 7 * 24) pairs.push({ hours, repliedAt: m.sentAt })
        burstStart = null
      }
    }
    if (burstStart) unansweredBursts++
  }

  return { pairs, unansweredBursts }
}

export function average(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export interface EngagementInput {
  lastActivityAt: Date | null
  msgs28: number
  inbound28: number
  outbound28: number
}

/**
 * Engagement 0–100 from real activity: recency (40) + frequency (35) +
 * two-way balance (25). A contact with a same-week, multi-message, two-way
 * thread lands 70+; a one-sided cold thread decays toward 0.
 */
export function engagementScore(e: EngagementInput, now = Date.now()): number {
  if (!e.lastActivityAt) return 0
  if (e.msgs28 === 0) return 6 // historical contact, silent for the whole window
  const days = (now - e.lastActivityAt.getTime()) / 86_400_000
  const recency = Math.max(0, 1 - days / 14) * 40
  const frequency = Math.min(1, e.msgs28 / 12) * 35
  const balance = (1 - Math.abs(e.inbound28 - e.outbound28) / e.msgs28) * 25
  return Math.round(Math.min(100, Math.max(2, recency + frequency + balance)))
}

/** Aggregate per-contact message activity over the last 28 / split 14-day windows. */
export interface ContactActivity {
  msgs28: number
  inbound28: number
  outbound28: number
  last14: number
  prev14: number
  lastActivityAt: Date | null
}

export function contactActivityMap(
  msgs: MsgEvent[],
  convToContact: Map<string, string>,
  now = Date.now(),
): Map<string, ContactActivity> {
  const since28 = now - 28 * 86_400_000
  const since14 = now - 14 * 86_400_000
  const map = new Map<string, ContactActivity>()

  for (const m of msgs) {
    const contactId = convToContact.get(m.conversationId)
    if (!contactId) continue
    let a = map.get(contactId)
    if (!a) {
      a = { msgs28: 0, inbound28: 0, outbound28: 0, last14: 0, prev14: 0, lastActivityAt: null }
      map.set(contactId, a)
    }
    const t = m.sentAt.getTime()
    if (!a.lastActivityAt || t > a.lastActivityAt.getTime()) a.lastActivityAt = m.sentAt
    if (t >= since28) {
      a.msgs28++
      if (m.direction === 'INBOUND') a.inbound28++
      else a.outbound28++
      if (t >= since14) a.last14++
      else a.prev14++
    }
  }
  return map
}

/** True when the conversation's latest message is inbound — the client is waiting on you. */
export function isAwaitingReply(conv: WorkspaceConversation): boolean {
  return conv.messages[0]?.direction === 'INBOUND'
}

export function lastInboundAt(conv: WorkspaceConversation): Date | null {
  return isAwaitingReply(conv) ? conv.messages[0]?.sentAt ?? null : null
}
