import { formatHours, shortDate, weekdayName } from '@/lib/time'
import { PRIORITY_META } from '@/lib/priority'
import {
  average,
  dailyVolume,
  loadWorkspace,
  pctDelta,
  replyStats,
  type MsgEvent,
} from './metrics.helpers'

/**
 * Read-model for the /analytics page. Everything is derived from the last
 * 30–35 days of real message events plus current conversation/analysis state.
 */

export interface AnalyticsData {
  rangeLabel: string
  hasIntegration: boolean
  hasData: boolean
  kpis: {
    avgResponse: { value: string; deltaPct: number | null; upIsGood: boolean }
    answered: { pct: number | null; replied: number; waiting: number }
    volume: { total: number; inbound: number; outbound: number; deltaPct: number | null }
    busiest: { day: string | null; count: number }
  }
  volumeSeries: { label: string; inbound: number; outbound: number }[]
  responseWeekly: { label: string; hours: number | null }[]
  priorityDist: { label: string; value: number; color: string }[]
  riskDist: { label: string; value: number; color: string }[]
  sentimentDist: { label: string; value: number; color: string }[]
  heatmap: { rows: string[]; cols: string[]; cells: number[][]; max: number }
  topContacts: { name: string; count: number }[]
}

const DAY_MS = 86_400_000

const PRIORITY_COLORS: Record<string, string> = {
  HOT: '#DC2B55',
  ATTENTION: '#C2620A',
  COLD: '#4F5CF4',
  SPAM: '#8D93BE',
}
const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#DC2B55',
  HIGH: '#E0593B',
  MEDIUM: '#C2620A',
  LOW: '#16A06B',
}
const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: '#16A06B',
  NEUTRAL: '#8D93BE',
  NEGATIVE: '#DC2B55',
}

export async function getAnalyticsData(userId: string): Promise<AnalyticsData> {
  const ws = await loadWorkspace(userId)
  const { conversations, messages, now } = ws

  const since30 = now - 30 * DAY_MS
  const msgs30 = messages.filter((m) => m.sentAt.getTime() >= since30)
  const inbound30 = msgs30.filter((m) => m.direction === 'INBOUND')
  const outbound30 = msgs30.filter((m) => m.direction === 'OUTBOUND')

  // ── Response time: this week vs last week ─────────────────────────────────
  const { pairs, unansweredBursts } = replyStats(messages)
  const weekAgo = now - 7 * DAY_MS
  const twoWeeks = now - 14 * DAY_MS
  const cur = average(pairs.filter((p) => p.repliedAt.getTime() >= weekAgo).map((p) => p.hours))
  const prev = average(
    pairs.filter((p) => p.repliedAt.getTime() >= twoWeeks && p.repliedAt.getTime() < weekAgo).map((p) => p.hours),
  )

  // ── Answered rate: inbound bursts that received a reply ───────────────────
  const replied = pairs.length
  const answeredPct = replied + unansweredBursts > 0 ? Math.round((replied / (replied + unansweredBursts)) * 100) : null

  // ── Volume: last 7 days vs the 7 before ───────────────────────────────────
  const vol7 = msgs30.filter((m) => m.sentAt.getTime() >= weekAgo).length
  const volPrev7 = messages.filter((m) => m.sentAt.getTime() >= twoWeeks && m.sentAt.getTime() < weekAgo).length

  // ── Busiest weekday (inbound, 30d) ────────────────────────────────────────
  const byDay = new Map<string, number>()
  for (const m of inbound30) {
    const d = weekdayName(m.sentAt)
    byDay.set(d, (byDay.get(d) ?? 0) + 1)
  }
  const busiest = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0] ?? null

  // ── Weekly response-time buckets (4 × 7d, oldest → newest) ────────────────
  const responseWeekly = [3, 2, 1, 0].map((weeksBack) => {
    const from = now - (weeksBack + 1) * 7 * DAY_MS
    const to = now - weeksBack * 7 * DAY_MS
    const bucket = pairs.filter((p) => p.repliedAt.getTime() >= from && p.repliedAt.getTime() < to)
    return {
      label: weeksBack === 0 ? 'This wk' : weeksBack === 1 ? 'Last wk' : shortDate(new Date(from)),
      hours: average(bucket.map((p) => p.hours)),
    }
  })

  // ── Distributions from current state ──────────────────────────────────────
  const active = conversations.filter((c) => c.status === 'ACTIVE')
  const priorityDist = (['HOT', 'ATTENTION', 'COLD', 'SPAM'] as const)
    .map((p) => ({
      label: PRIORITY_META[p].label,
      value: active.filter((c) => c.priority === p).length,
      color: PRIORITY_COLORS[p],
    }))
    .filter((d) => d.value > 0)

  const analyzed = active.filter((c) => c.analysis)
  const riskDist = (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const)
    .map((r) => ({
      label: r.charAt(0) + r.slice(1).toLowerCase(),
      value: analyzed.filter((c) => c.analysis!.riskLevel === r).length,
      color: RISK_COLORS[r],
    }))
    .filter((d) => d.value > 0)

  const sentimentDist = (['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const)
    .map((s) => ({
      label: s.charAt(0) + s.slice(1).toLowerCase(),
      value: analyzed.filter((c) => c.analysis!.sentiment === s).length,
      color: SENTIMENT_COLORS[s],
    }))
    .filter((d) => d.value > 0)

  // ── Heatmap: when clients email you (weekday × 4h block, inbound 30d) ─────
  const heatmap = buildHeatmap(inbound30)

  // ── Top contacts by inbound volume ────────────────────────────────────────
  const convToName = new Map(conversations.map((c) => [c.id, c.contact.name]))
  const byContact = new Map<string, number>()
  for (const m of inbound30) {
    const name = convToName.get(m.conversationId)
    if (!name) continue
    byContact.set(name, (byContact.get(name) ?? 0) + 1)
  }
  const topContacts = [...byContact.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  return {
    rangeLabel: 'Last 30 days',
    hasIntegration: Boolean(ws.integration),
    hasData: conversations.length > 0,
    kpis: {
      avgResponse: {
        value: formatHours(cur),
        deltaPct: cur !== null && prev !== null && prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null,
        upIsGood: false,
      },
      answered: { pct: answeredPct, replied, waiting: unansweredBursts },
      volume: {
        total: msgs30.length,
        inbound: inbound30.length,
        outbound: outbound30.length,
        deltaPct: pctDelta(vol7, volPrev7),
      },
      busiest: { day: busiest?.[0] ?? null, count: busiest?.[1] ?? 0 },
    },
    volumeSeries: dailyVolume(msgs30, 30, now).map(({ label, inbound, outbound }) => ({ label, inbound, outbound })),
    responseWeekly,
    priorityDist,
    riskDist,
    sentimentDist,
    heatmap,
    topContacts,
  }
}

function buildHeatmap(inbound: MsgEvent[]) {
  // Rows Mon..Sun, columns 4-hour blocks.
  const rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const cols = ['00', '04', '08', '12', '16', '20']
  const cells: number[][] = rows.map(() => cols.map(() => 0))

  for (const m of inbound) {
    const jsDay = m.sentAt.getDay() // 0 = Sun
    const row = jsDay === 0 ? 6 : jsDay - 1
    const col = Math.min(5, Math.floor(m.sentAt.getHours() / 4))
    cells[row][col]++
  }
  const max = Math.max(0, ...cells.flat())
  return { rows, cols, cells, max }
}
