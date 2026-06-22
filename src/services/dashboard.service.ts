import { formatHours, hoursSince, timeAgo, waitDuration } from '@/lib/time'
import type { PriorityLevel, RiskLevel, Sentiment } from '@/types'
import {
  average,
  contactActivityMap,
  dailyActiveConversations,
  engagementScore,
  isAwaitingReply,
  lastInboundAt,
  loadWorkspace,
  pctDelta,
  replyStats,
  type Workspace,
  type WorkspaceConversation,
} from './metrics.helpers'

/**
 * Read-models for the executive dashboard, the risk monitor and the insights
 * feed. Every number here is derived from real workspace data (conversations,
 * messages, AI analyses, sync jobs) — nothing is invented. All relative-time
 * strings are pre-formatted server-side so client widgets never touch Date.now().
 */

export type Tone = 'critical' | 'warning' | 'info' | 'positive'

export interface StatTrend {
  deltaPct: number | null
  /** Whether an increase is a good thing for this metric (null = neutral). */
  upIsGood: boolean | null
}

export interface ExecStats {
  conversations: { value: number; activeThisWeek: number; trend: StatTrend; spark: number[] }
  highPriority: { value: number; hot: number; attention: number }
  clientsAtRisk: { value: number; totalClients: number }
  unanswered: { value: number; overdue24h: number; oldestWait: string | null }
  followUps: { value: number; fromAi: number; goneQuiet: number }
  health: { score: number | null; topFactor: string | null }
}

export interface CommandItem {
  id: string
  href: string
  contactName: string
  contactEmail: string | null
  subject: string | null
  summary: string | null
  nextAction: string | null
  priority: PriorityLevel
  risk: RiskLevel | null
  sentiment: Sentiment | null
  /** How long the client has been waiting on a reply, e.g. "2d". */
  waiting: string | null
  reasons: string[]
  score: number
}

export interface RiskClientItem {
  contactId: string
  name: string
  email: string | null
  risk: Exclude<RiskLevel, 'LOW'>
  engagement: number
  reason: string
  waiting: string | null
  threads: number
  href: string
}

export interface RelationshipItem {
  contactId: string
  name: string
  email: string | null
  note: string
  href: string
  metric: number
}

export interface RelationshipHealth {
  strongest: RelationshipItem[]
  weakening: RelationshipItem[]
  opportunities: RelationshipItem[]
}

export interface TimelineEvent {
  id: string
  kind: 'email' | 'reply' | 'analysis' | 'risk' | 'sync'
  title: string
  detail: string | null
  timeAgo: string
  at: string
  href: string | null
}

export interface InsightItem {
  id: string
  tone: Tone
  icon: 'risk' | 'reply' | 'followup' | 'trend-up' | 'trend-down' | 'new' | 'check' | 'time'
  title: string
  description: string
  href: string | null
  cta: string | null
}

export interface DashboardData {
  hasIntegration: boolean
  hasData: boolean
  integrationEmail: string | null
  lastSyncAgo: string | null
  stats: ExecStats
  nextBestAction: CommandItem | null
  commandCenter: CommandItem[]
  riskClients: RiskClientItem[]
  relationships: RelationshipHealth
  timeline: TimelineEvent[]
  insights: InsightItem[]
}

const DAY_MS = 86_400_000

// ── Per-conversation facts (computed once, reused by every widget) ──────────

interface ConvFacts {
  conv: WorkspaceConversation
  awaiting: boolean
  waitHours: number
  highRisk: boolean
  risk: RiskLevel | null
}

function buildFacts(convs: WorkspaceConversation[], now: number): ConvFacts[] {
  return convs
    .filter((c) => c.status === 'ACTIVE')
    .map((c) => {
      const awaiting = isAwaitingReply(c)
      const inboundAt = lastInboundAt(c)
      const risk = (c.analysis?.riskLevel as RiskLevel | undefined) ?? null
      return {
        conv: c,
        awaiting,
        waitHours: awaiting && inboundAt ? (now - inboundAt.getTime()) / 3_600_000 : 0,
        highRisk: risk === 'HIGH' || risk === 'CRITICAL',
        risk,
      }
    })
}

// ── Executive stats ─────────────────────────────────────────────────────────

function buildStats(ws: Workspace, facts: ConvFacts[]): ExecStats {
  const { messages, now } = ws
  const active = facts

  // Active conversations: distinct threads with activity this week vs last week.
  const weekAgo = now - 7 * DAY_MS
  const twoWeeksAgo = now - 14 * DAY_MS
  const thisWeek = new Set<string>()
  const lastWeek = new Set<string>()
  for (const m of messages) {
    const t = m.sentAt.getTime()
    if (t >= weekAgo) thisWeek.add(m.conversationId)
    else if (t >= twoWeeksAgo) lastWeek.add(m.conversationId)
  }

  const hot = active.filter((f) => f.conv.priority === 'HOT').length
  const attention = active.filter((f) => f.conv.priority === 'ATTENTION').length

  const riskContactIds = new Set<string>()
  for (const f of active) {
    if (f.highRisk || f.waitHours >= 48) riskContactIds.add(f.conv.contact.id)
  }
  const totalClients = new Set(ws.conversations.map((c) => c.contact.id)).size

  const awaiting = active.filter((f) => f.awaiting)
  const overdue24h = awaiting.filter((f) => f.waitHours >= 24).length
  const oldest = awaiting.reduce<ConvFacts | null>(
    (acc, f) => (acc === null || f.waitHours > acc.waitHours ? f : acc),
    null,
  )

  // Follow-ups: AI suggested a next step, or your last outbound has gone 3+ days unanswered.
  const followUpIds = new Set<string>()
  let fromAi = 0
  let goneQuiet = 0
  for (const f of active) {
    const aiSuggests = Boolean(f.conv.analysis?.nextAction)
    const quiet =
      !f.awaiting &&
      f.conv.messages[0]?.direction === 'OUTBOUND' &&
      f.conv.lastMessageAt !== null &&
      hoursSince(f.conv.lastMessageAt, now) >= 72
    if (aiSuggests) fromAi++
    if (quiet) goneQuiet++
    if (aiSuggests || quiet) followUpIds.add(f.conv.id)
  }

  // Inbox health: start at 100, subtract weighted penalties from real ratios.
  let health: number | null = null
  let topFactor: string | null = null
  if (active.length > 0) {
    const analyzed = active.filter((f) => f.conv.analysis)
    const ratios = {
      overdue: overdue24h / active.length,
      unanswered: awaiting.length / active.length,
      risk: analyzed.length ? analyzed.filter((f) => f.highRisk).length / analyzed.length : 0,
      negative: analyzed.length
        ? analyzed.filter((f) => f.conv.analysis?.sentiment === 'NEGATIVE').length / analyzed.length
        : 0,
      stale:
        active.filter((f) => f.conv.lastMessageAt && hoursSince(f.conv.lastMessageAt, now) > 7 * 24).length /
        active.length,
    }
    const penalties: { label: string; value: number }[] = [
      { label: `${overdue24h} overdue ${overdue24h === 1 ? 'reply' : 'replies'}`, value: Math.min(30, ratios.overdue * 90) },
      { label: `${awaiting.length} unanswered`, value: Math.min(20, ratios.unanswered * 50) },
      {
        label: `${analyzed.filter((f) => f.highRisk).length} high-risk ${analyzed.filter((f) => f.highRisk).length === 1 ? 'thread' : 'threads'}`,
        value: Math.min(30, ratios.risk * 100),
      },
      { label: 'negative sentiment', value: Math.min(10, ratios.negative * 40) },
      { label: 'stale threads', value: Math.min(15, ratios.stale * 35) },
    ]
    health = Math.round(Math.max(4, 100 - penalties.reduce((a, p) => a + p.value, 0)))
    const top = penalties.reduce((a, p) => (p.value > a.value ? p : a))
    topFactor = top.value >= 5 ? top.label : null
  }

  return {
    conversations: {
      value: active.length,
      activeThisWeek: thisWeek.size,
      trend: { deltaPct: pctDelta(thisWeek.size, lastWeek.size), upIsGood: true },
      spark: dailyActiveConversations(messages, 14, now),
    },
    highPriority: { value: hot + attention, hot, attention },
    clientsAtRisk: { value: riskContactIds.size, totalClients },
    unanswered: {
      value: awaiting.length,
      overdue24h,
      oldestWait: oldest ? waitDuration(lastInboundAt(oldest.conv), now) : null,
    },
    followUps: { value: followUpIds.size, fromAi, goneQuiet },
    health: { score: health, topFactor },
  }
}

// ── AI command center ───────────────────────────────────────────────────────

function buildCommandItems(facts: ConvFacts[], now: number): CommandItem[] {
  const items: CommandItem[] = []

  for (const f of facts) {
    if (f.conv.priority === 'SPAM') continue
    const a = f.conv.analysis
    const needsAction = f.awaiting || f.highRisk || Boolean(a?.nextAction)
    if (!needsAction) continue

    const reasons: string[] = []
    const waiting = f.awaiting ? waitDuration(lastInboundAt(f.conv), now) : null
    if (f.awaiting) reasons.push(waiting ? `Awaiting your reply · ${waiting}` : 'Awaiting your reply')
    if (f.risk === 'CRITICAL') reasons.push('Critical churn risk')
    else if (f.risk === 'HIGH') reasons.push('High churn risk')
    if (a?.sentiment === 'NEGATIVE') reasons.push('Negative tone')
    if (!f.awaiting && a?.nextAction) reasons.push('AI follow-up suggested')

    const score =
      f.conv.priorityScore +
      (f.risk === 'CRITICAL' ? 35 : f.risk === 'HIGH' ? 25 : f.risk === 'MEDIUM' ? 10 : 0) +
      (f.awaiting ? Math.min(30, f.waitHours / 2) : 0) +
      (a?.nextAction ? 10 : 0)

    items.push({
      id: f.conv.id,
      href: `/inbox/${f.conv.id}`,
      contactName: f.conv.contact.name,
      contactEmail: f.conv.contact.email,
      subject: f.conv.subject,
      summary: a?.summary ? truncate(a.summary, 140) : null,
      nextAction: a?.nextAction ? truncate(a.nextAction, 120) : null,
      priority: f.conv.priority as PriorityLevel,
      risk: f.risk,
      sentiment: (a?.sentiment as Sentiment | undefined) ?? null,
      waiting,
      reasons: reasons.slice(0, 3),
      score: Math.round(score),
    })
  }

  return items.sort((a, b) => b.score - a.score).slice(0, 6)
}

// ── Client risk monitor ─────────────────────────────────────────────────────

function buildRiskClients(facts: ConvFacts[], ws: Workspace): RiskClientItem[] {
  const { messages, now } = ws
  const convToContact = new Map(facts.map((f) => [f.conv.id, f.conv.contact.id]))
  const activity = contactActivityMap(messages, convToContact, now)

  interface Agg {
    contact: WorkspaceConversation['contact']
    risk: Exclude<RiskLevel, 'LOW'> | null
    reasons: string[]
    worstWaitHours: number
    waitingConv: ConvFacts | null
    topConv: ConvFacts
    threads: number
  }

  const RANK: Record<string, number> = { MEDIUM: 1, HIGH: 2, CRITICAL: 3 }
  const byContact = new Map<string, Agg>()

  for (const f of facts) {
    let agg = byContact.get(f.conv.contact.id)
    if (!agg) {
      agg = { contact: f.conv.contact, risk: null, reasons: [], worstWaitHours: 0, waitingConv: null, topConv: f, threads: 0 }
      byContact.set(f.conv.contact.id, agg)
    }
    agg.threads++
    if (f.conv.priorityScore > agg.topConv.conv.priorityScore) agg.topConv = f

    if (f.risk && f.risk !== 'LOW' && (!agg.risk || RANK[f.risk] > RANK[agg.risk])) {
      agg.risk = f.risk as Exclude<RiskLevel, 'LOW'>
      if (f.conv.analysis?.riskReasons?.length) agg.reasons = f.conv.analysis.riskReasons
    }
    if (f.awaiting && f.waitHours > agg.worstWaitHours) {
      agg.worstWaitHours = f.waitHours
      agg.waitingConv = f
    }
  }

  const items: RiskClientItem[] = []
  for (const agg of byContact.values()) {
    // A client is "at risk" when AI flagged it, or a reply is 48h+ overdue.
    const overdueRisk = agg.worstWaitHours >= 48
    if (!agg.risk && !overdueRisk) continue

    const risk: Exclude<RiskLevel, 'LOW'> = agg.risk ?? 'MEDIUM'
    const act = activity.get(agg.contact.id)
    const reason =
      agg.reasons[0] ??
      (overdueRisk
        ? `No reply sent for ${waitDuration(new Date(ws.now - agg.worstWaitHours * 3_600_000), ws.now)}`
        : 'Elevated churn risk')

    items.push({
      contactId: agg.contact.id,
      name: agg.contact.name,
      email: agg.contact.email,
      risk,
      engagement: engagementScore(
        {
          lastActivityAt: act?.lastActivityAt ?? agg.topConv.conv.lastMessageAt,
          msgs28: act?.msgs28 ?? 0,
          inbound28: act?.inbound28 ?? 0,
          outbound28: act?.outbound28 ?? 0,
        },
        now,
      ),
      reason: truncate(reason, 90),
      waiting: agg.waitingConv ? waitDuration(lastInboundAt(agg.waitingConv.conv), now) : null,
      threads: agg.threads,
      href: `/inbox/${(agg.waitingConv ?? agg.topConv).conv.id}`,
    })
  }

  const RANK_FULL: Record<string, number> = { MEDIUM: 1, HIGH: 2, CRITICAL: 3 }
  return items
    .sort((a, b) => RANK_FULL[b.risk] - RANK_FULL[a.risk] || a.engagement - b.engagement)
    .slice(0, 6)
}

// ── Relationship health ─────────────────────────────────────────────────────

function buildRelationships(facts: ConvFacts[], ws: Workspace): RelationshipHealth {
  const { messages, now } = ws
  const convToContact = new Map(facts.map((f) => [f.conv.id, f.conv.contact.id]))
  const activity = contactActivityMap(messages, convToContact, now)

  interface CState {
    contact: WorkspaceConversation['contact']
    topConv: ConvFacts
    highRisk: boolean
    positive: boolean
    hotOrAttention: boolean
  }
  const byContact = new Map<string, CState>()
  for (const f of facts) {
    let s = byContact.get(f.conv.contact.id)
    if (!s) {
      s = { contact: f.conv.contact, topConv: f, highRisk: false, positive: false, hotOrAttention: false }
      byContact.set(f.conv.contact.id, s)
    }
    if (f.conv.priorityScore > s.topConv.conv.priorityScore) s.topConv = f
    if (f.highRisk) s.highRisk = true
    if (f.conv.analysis?.sentiment === 'POSITIVE') s.positive = true
    if (f.conv.priority === 'HOT' || f.conv.priority === 'ATTENTION') s.hotOrAttention = true
  }

  const strongest: RelationshipItem[] = []
  const weakening: RelationshipItem[] = []
  const opportunities: RelationshipItem[] = []

  for (const s of byContact.values()) {
    const act = activity.get(s.contact.id)
    const eng = engagementScore(
      {
        lastActivityAt: act?.lastActivityAt ?? s.topConv.conv.lastMessageAt,
        msgs28: act?.msgs28 ?? 0,
        inbound28: act?.inbound28 ?? 0,
        outbound28: act?.outbound28 ?? 0,
      },
      now,
    )
    const href = `/inbox/${s.topConv.conv.id}`
    const base = { contactId: s.contact.id, name: s.contact.name, email: s.contact.email, href }
    const lastAgo = timeAgo(act?.lastActivityAt ?? s.topConv.conv.lastMessageAt, now)

    // Weakening: activity halved between 14-day windows, or a long silence.
    if (act && act.prev14 >= 2 && act.last14 <= act.prev14 / 2) {
      const drop = Math.round((1 - act.last14 / act.prev14) * 100)
      weakening.push({ ...base, note: `Activity down ${drop}% over 2 weeks`, metric: drop })
      continue
    }
    const silentDays = act?.lastActivityAt ? (now - act.lastActivityAt.getTime()) / DAY_MS : null
    if (silentDays !== null && silentDays >= 10 && (act?.msgs28 ?? 0) > 0) {
      weakening.push({ ...base, note: `Quiet for ${Math.floor(silentDays)}d`, metric: Math.floor(silentDays) })
      continue
    }

    // New opportunities: fresh contact with positive tone or elevated priority.
    const contactAgeDays = (now - s.contact.createdAt.getTime()) / DAY_MS
    if (contactAgeDays <= 21 && !s.highRisk && (s.positive || s.hotOrAttention)) {
      opportunities.push({
        ...base,
        note: s.positive ? 'New contact · positive tone' : 'New contact · active thread',
        metric: eng,
      })
      continue
    }

    if (eng >= 50 && !s.highRisk) {
      strongest.push({ ...base, note: `${eng} engagement · active ${lastAgo ?? 'recently'}`, metric: eng })
    }
  }

  return {
    strongest: strongest.sort((a, b) => b.metric - a.metric).slice(0, 4),
    weakening: weakening.sort((a, b) => b.metric - a.metric).slice(0, 4),
    opportunities: opportunities.sort((a, b) => b.metric - a.metric).slice(0, 4),
  }
}

// ── Activity timeline ───────────────────────────────────────────────────────

function buildTimeline(ws: Workspace): TimelineEvent[] {
  const { conversations, messages, syncJobs, now } = ws
  const byId = new Map(conversations.map((c) => [c.id, c]))
  const events: { at: Date; e: Omit<TimelineEvent, 'timeAgo' | 'at'> & { at: Date } }[] = []

  // Message events (latest 10 of the window).
  for (const m of messages.slice(-10)) {
    const conv = byId.get(m.conversationId)
    if (!conv) continue
    const inbound = m.direction === 'INBOUND'
    events.push({
      at: m.sentAt,
      e: {
        id: `msg-${m.conversationId}-${m.sentAt.getTime()}`,
        kind: inbound ? 'email' : 'reply',
        title: inbound ? `New email from ${conv.contact.name}` : `You replied to ${conv.contact.name}`,
        detail: conv.subject ? truncate(conv.subject, 80) : null,
        href: `/inbox/${conv.id}`,
        at: m.sentAt,
      },
    })
  }

  // AI analysis + risk events.
  const analyzed = conversations
    .filter((c) => c.analysis)
    .sort((a, b) => b.analysis!.updatedAt.getTime() - a.analysis!.updatedAt.getTime())
    .slice(0, 6)
  for (const c of analyzed) {
    const a = c.analysis!
    const risky = a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL'
    events.push({
      at: a.updatedAt,
      e: {
        id: `ai-${c.id}`,
        kind: risky ? 'risk' : 'analysis',
        title: risky ? `Churn risk flagged · ${c.contact.name}` : `AI analyzed ${c.contact.name}`,
        detail: truncate(risky ? a.riskReasons[0] ?? a.summary : a.summary, 90),
        href: `/inbox/${c.id}`,
        at: a.updatedAt,
      },
    })
  }

  // Sync jobs.
  for (const j of syncJobs) {
    if (!j.finishedAt) continue
    const r = (j.result ?? {}) as { synced?: number; created?: number; updated?: number }
    const parts: string[] = []
    if (typeof r.synced === 'number') parts.push(`${r.synced} threads checked`)
    if (typeof r.created === 'number' && r.created > 0) parts.push(`${r.created} new`)
    events.push({
      at: j.finishedAt,
      e: {
        id: `sync-${j.id}`,
        kind: 'sync',
        title: 'Gmail sync completed',
        detail: parts.length ? parts.join(' · ') : null,
        href: null,
        at: j.finishedAt,
      },
    })
  }

  return events
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12)
    .map(({ e }) => ({ ...e, at: e.at.toISOString(), timeAgo: timeAgo(e.at, now) ?? '' }))
}

// ── Smart insights ──────────────────────────────────────────────────────────

function buildInsights(facts: ConvFacts[], ws: Workspace, stats: ExecStats): InsightItem[] {
  const { messages, now } = ws
  const out: InsightItem[] = []
  const plural = (n: number, s: string, p?: string) => (n === 1 ? s : p ?? `${s}s`)

  if (stats.clientsAtRisk.value > 0) {
    out.push({
      id: 'clients-at-risk',
      tone: 'critical',
      icon: 'risk',
      title: `${stats.clientsAtRisk.value} ${plural(stats.clientsAtRisk.value, 'client needs', 'clients need')} attention`,
      description: 'AI flagged elevated churn risk or replies overdue 48h+ across their threads.',
      href: '/risk',
      cta: 'Open Risk Monitor',
    })
  }

  const slippingDeals = facts.filter((f) => f.highRisk || f.conv.analysis?.lostReason).length
  if (slippingDeals > 0) {
    out.push({
      id: 'deals-slipping',
      tone: 'warning',
      icon: 'risk',
      title: `${slippingDeals} ${plural(slippingDeals, 'deal')} may be slipping`,
      description: 'High-risk signals detected in the latest AI analysis of these threads.',
      href: '/risk',
      cta: 'Review threads',
    })
  }

  const importantUnanswered = facts.filter(
    (f) => f.awaiting && (f.conv.priority === 'HOT' || f.conv.priority === 'ATTENTION'),
  ).length
  if (importantUnanswered > 0) {
    out.push({
      id: 'important-unanswered',
      tone: 'warning',
      icon: 'reply',
      title: `${importantUnanswered} important ${plural(importantUnanswered, 'email is', 'emails are')} waiting on you`,
      description: 'High-priority threads where the client sent the last message.',
      href: '/inbox',
      cta: 'Open Inbox',
    })
  }

  const overdue = facts
    .filter((f) => f.awaiting && f.waitHours >= 24)
    .sort((a, b) => b.waitHours - a.waitHours)[0]
  if (overdue) {
    const days = Math.floor(overdue.waitHours / 24)
    out.push({
      id: 'oldest-overdue',
      tone: 'warning',
      icon: 'time',
      title: `Reply to ${overdue.conv.contact.name} is ${days >= 1 ? `${days}d` : `${Math.floor(overdue.waitHours)}h`} overdue`,
      description: overdue.conv.subject ? `Re: ${truncate(overdue.conv.subject, 70)}` : 'The thread has been waiting since their last message.',
      href: `/inbox/${overdue.conv.id}`,
      cta: 'Reply now',
    })
  }

  // Response-time trend: replies made this week vs the week before.
  const { pairs } = replyStats(messages)
  const weekAgo = now - 7 * DAY_MS
  const twoWeeks = now - 14 * DAY_MS
  const cur = average(pairs.filter((p) => p.repliedAt.getTime() >= weekAgo).map((p) => p.hours))
  const prev = average(
    pairs.filter((p) => p.repliedAt.getTime() >= twoWeeks && p.repliedAt.getTime() < weekAgo).map((p) => p.hours),
  )
  if (cur !== null && prev !== null && prev > 0) {
    const delta = Math.round(((cur - prev) / prev) * 100)
    if (Math.abs(delta) >= 5) {
      const improved = delta < 0
      out.push({
        id: 'response-trend',
        tone: improved ? 'positive' : 'warning',
        icon: improved ? 'trend-up' : 'trend-down',
        title: `Response time ${improved ? 'improved' : 'slowed'} ${Math.abs(delta)}% this week`,
        description: `Average reply time is ${formatHours(cur)}, vs ${formatHours(prev)} last week.`,
        href: '/analytics',
        cta: 'See analytics',
      })
    }
  }

  if (stats.followUps.value > 0) {
    out.push({
      id: 'followups',
      tone: 'info',
      icon: 'followup',
      title: `${stats.followUps.value} ${plural(stats.followUps.value, 'follow-up')} suggested`,
      description:
        stats.followUps.goneQuiet > 0
          ? `${stats.followUps.fromAi} from AI next-steps · ${stats.followUps.goneQuiet} ${plural(stats.followUps.goneQuiet, 'thread')} gone quiet after your last email.`
          : 'AI suggested a concrete next step for these threads.',
      href: '/dashboard',
      cta: null,
    })
  }

  const newConvs = ws.conversations.filter((c) => c.createdAt.getTime() >= weekAgo).length
  if (newConvs > 0) {
    out.push({
      id: 'new-conversations',
      tone: 'info',
      icon: 'new',
      title: `${newConvs} new ${plural(newConvs, 'conversation')} this week`,
      description: 'Fresh threads synced from your inbox in the last 7 days.',
      href: '/inbox',
      cta: null,
    })
  }

  if (out.length === 0) {
    out.push({
      id: 'all-clear',
      tone: 'positive',
      icon: 'check',
      title: 'All caught up',
      description: 'No risks, overdue replies or pending follow-ups detected. Nice work.',
      href: null,
      cta: null,
    })
  }

  return out
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function getDashboardData(organizationId: string): Promise<DashboardData> {
  const ws = await loadWorkspace(organizationId)
  const facts = buildFacts(ws.conversations, ws.now)
  const stats = buildStats(ws, facts)
  const commandCenter = buildCommandItems(facts, ws.now)
  const meta = (ws.integration?.metadata ?? {}) as { email?: string }

  return {
    hasIntegration: Boolean(ws.integration),
    hasData: ws.conversations.length > 0,
    integrationEmail: meta.email ?? null,
    lastSyncAgo: timeAgo(ws.integration?.syncedAt, ws.now),
    stats,
    nextBestAction: commandCenter[0] ?? null,
    commandCenter: commandCenter.slice(1),
    riskClients: buildRiskClients(facts, ws),
    relationships: buildRelationships(facts, ws),
    timeline: buildTimeline(ws),
    insights: buildInsights(facts, ws, stats).slice(0, 5),
  }
}

// ── Risk monitor page ───────────────────────────────────────────────────────

export interface RiskThread {
  id: string
  href: string
  contactName: string
  contactEmail: string | null
  subject: string | null
  risk: RiskLevel | null
  priority: PriorityLevel
  summary: string | null
  reasons: string[]
  nextAction: string | null
  waiting: string | null
  lastActivityAgo: string | null
  sentiment: Sentiment | null
}

export interface RiskOverview {
  kpis: { atRiskClients: number; criticalThreads: number; overdueReplies: number; lostDeals: number }
  critical: RiskThread[]
  watchlist: RiskThread[]
  hasIntegration: boolean
  hasData: boolean
}

export async function getRiskOverview(organizationId: string): Promise<RiskOverview> {
  const ws = await loadWorkspace(organizationId)
  const facts = buildFacts(ws.conversations, ws.now)

  const toThread = (f: ConvFacts): RiskThread => ({
    id: f.conv.id,
    href: `/inbox/${f.conv.id}`,
    contactName: f.conv.contact.name,
    contactEmail: f.conv.contact.email,
    subject: f.conv.subject,
    risk: f.risk,
    priority: f.conv.priority as PriorityLevel,
    summary: f.conv.analysis?.summary ? truncate(f.conv.analysis.summary, 160) : null,
    reasons: (f.conv.analysis?.riskReasons ?? []).slice(0, 3),
    nextAction: f.conv.analysis?.nextAction ? truncate(f.conv.analysis.nextAction, 120) : null,
    waiting: f.awaiting ? waitDuration(lastInboundAt(f.conv), ws.now) : null,
    lastActivityAgo: timeAgo(f.conv.lastMessageAt, ws.now),
    sentiment: (f.conv.analysis?.sentiment as Sentiment | undefined) ?? null,
  })

  const critical = facts
    .filter((f) => f.risk === 'CRITICAL' || f.risk === 'HIGH')
    .sort((a, b) => (b.risk === 'CRITICAL' ? 1 : 0) - (a.risk === 'CRITICAL' ? 1 : 0) || b.waitHours - a.waitHours)
    .map(toThread)

  const watchlist = facts
    .filter((f) => f.risk === 'MEDIUM' || (!f.highRisk && f.waitHours >= 48))
    .sort((a, b) => b.waitHours - a.waitHours)
    .slice(0, 8)
    .map(toThread)

  const riskContactIds = new Set<string>()
  for (const f of facts) if (f.highRisk || f.waitHours >= 48) riskContactIds.add(f.conv.contact.id)

  const lostDeals = ws.conversations.filter((c) => c.status === 'LOST' || c.analysis?.lostReason).length

  return {
    kpis: {
      atRiskClients: riskContactIds.size,
      criticalThreads: facts.filter((f) => f.risk === 'CRITICAL').length,
      overdueReplies: facts.filter((f) => f.awaiting && f.waitHours >= 24).length,
      lostDeals,
    },
    critical,
    watchlist,
    hasIntegration: Boolean(ws.integration),
    hasData: ws.conversations.length > 0,
  }
}

// ── Insights page ───────────────────────────────────────────────────────────

export interface TrendInsight {
  id: string
  label: string
  value: string
  deltaPct: number | null
  upIsGood: boolean | null
  description: string
}

export interface InsightsFeed {
  today: InsightItem[]
  trends: TrendInsight[]
  hasIntegration: boolean
  hasData: boolean
}

export async function getInsightsFeed(organizationId: string): Promise<InsightsFeed> {
  const ws = await loadWorkspace(organizationId)
  const facts = buildFacts(ws.conversations, ws.now)
  const stats = buildStats(ws, facts)
  const { messages, now } = ws

  const weekAgo = now - 7 * DAY_MS
  const twoWeeks = now - 14 * DAY_MS
  const inWindow = (t: number, from: number, to: number) => t >= from && t < to

  const { pairs } = replyStats(messages)
  const curResp = average(pairs.filter((p) => p.repliedAt.getTime() >= weekAgo).map((p) => p.hours))
  const prevResp = average(
    pairs.filter((p) => inWindow(p.repliedAt.getTime(), twoWeeks, weekAgo)).map((p) => p.hours),
  )

  const inboundCur = messages.filter((m) => m.direction === 'INBOUND' && m.sentAt.getTime() >= weekAgo).length
  const inboundPrev = messages.filter(
    (m) => m.direction === 'INBOUND' && inWindow(m.sentAt.getTime(), twoWeeks, weekAgo),
  ).length
  const repliesCur = messages.filter((m) => m.direction === 'OUTBOUND' && m.sentAt.getTime() >= weekAgo).length
  const repliesPrev = messages.filter(
    (m) => m.direction === 'OUTBOUND' && inWindow(m.sentAt.getTime(), twoWeeks, weekAgo),
  ).length
  const newCur = ws.conversations.filter((c) => c.createdAt.getTime() >= weekAgo).length
  const newPrev = ws.conversations.filter((c) => inWindow(c.createdAt.getTime(), twoWeeks, weekAgo)).length

  const trends: TrendInsight[] = [
    {
      id: 'response-time',
      label: 'Avg response time',
      value: formatHours(curResp),
      deltaPct: curResp !== null && prevResp !== null && prevResp > 0 ? Math.round(((curResp - prevResp) / prevResp) * 100) : null,
      upIsGood: false,
      description: 'Time from a client email to your reply, last 7 days.',
    },
    {
      id: 'inbound-volume',
      label: 'Client emails received',
      value: String(inboundCur),
      deltaPct: pctDelta(inboundCur, inboundPrev),
      upIsGood: null,
      description: 'Inbound messages across all threads, last 7 days.',
    },
    {
      id: 'replies-sent',
      label: 'Replies sent',
      value: String(repliesCur),
      deltaPct: pctDelta(repliesCur, repliesPrev),
      upIsGood: true,
      description: 'Outbound messages you sent, last 7 days.',
    },
    {
      id: 'new-threads',
      label: 'New conversations',
      value: String(newCur),
      deltaPct: pctDelta(newCur, newPrev),
      upIsGood: true,
      description: 'Threads that appeared in your workspace this week.',
    },
  ]

  return {
    today: buildInsights(facts, ws, stats),
    trends,
    hasIntegration: Boolean(ws.integration),
    hasData: ws.conversations.length > 0,
  }
}

// ── Utils ───────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}
