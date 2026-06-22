import { prisma } from '@/lib/prisma'
import { timeAgo } from '@/lib/time'
import type { RiskLevel, Sentiment } from '@/types'
import { contactActivityMap, engagementScore, isAwaitingReply, loadWorkspace } from './metrics.helpers'

/**
 * Read-model for the /clients directory. One row per contact, aggregated from
 * that contact's conversations, AI analyses and 28-day message activity.
 */

export interface ClientRow {
  id: string
  name: string
  email: string | null
  channel: 'GMAIL' | 'TELEGRAM'
  threads: number
  engagement: number
  risk: RiskLevel | null
  sentiment: Sentiment | null
  awaitingReply: boolean
  isNew: boolean
  lastActivityAt: string | null
  lastActivityAgo: string | null
  href: string | null
  noteCount: number
}

export interface ClientDirectory {
  rows: ClientRow[]
  totals: { clients: number; activeWeek: number; atRisk: number; newThisMonth: number }
  hasIntegration: boolean
  hasData: boolean
}

const DAY_MS = 86_400_000
const RISK_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }

export async function getClientDirectory(organizationId: string): Promise<ClientDirectory> {
  const ws = await loadWorkspace(organizationId)
  const { conversations, messages, now } = ws

  const convToContact = new Map(conversations.map((c) => [c.id, c.contact.id]))
  const activity = contactActivityMap(messages, convToContact, now)

  interface Agg {
    contact: (typeof conversations)[number]['contact']
    channel: 'GMAIL' | 'TELEGRAM'
    threads: number
    risk: RiskLevel | null
    sentiment: Sentiment | null
    sentimentAt: number
    awaiting: boolean
    lastMessageAt: Date | null
    topConvId: string | null
    topScore: number
  }

  const byContact = new Map<string, Agg>()
  for (const c of conversations) {
    let agg = byContact.get(c.contact.id)
    if (!agg) {
      agg = {
        contact: c.contact,
        channel: c.channel as 'GMAIL' | 'TELEGRAM',
        threads: 0,
        risk: null,
        sentiment: null,
        sentimentAt: 0,
        awaiting: false,
        lastMessageAt: null,
        topConvId: null,
        topScore: -1,
      }
      byContact.set(c.contact.id, agg)
    }
    agg.threads++
    if (c.priorityScore > agg.topScore) {
      agg.topScore = c.priorityScore
      agg.topConvId = c.id
    }
    if (c.lastMessageAt && (!agg.lastMessageAt || c.lastMessageAt > agg.lastMessageAt)) {
      agg.lastMessageAt = c.lastMessageAt
    }
    if (c.status === 'ACTIVE' && isAwaitingReply(c)) agg.awaiting = true
    const r = c.analysis?.riskLevel as RiskLevel | undefined
    if (r && (!agg.risk || RISK_RANK[r] > RISK_RANK[agg.risk])) agg.risk = r
    // Sentiment: take the most recently analyzed thread's tone.
    if (c.analysis && c.analysis.updatedAt.getTime() > agg.sentimentAt) {
      agg.sentiment = c.analysis.sentiment as Sentiment
      agg.sentimentAt = c.analysis.updatedAt.getTime()
    }
  }

  // Note counts per contact — one grouped query (kept sequential after
  // loadWorkspace to respect the small connection pool).
  const noteGroups = await prisma.contactNote.groupBy({
    by: ['contactId'],
    where: { organizationId },
    _count: { _all: true },
  })
  const noteCountByContact = new Map(noteGroups.map((g) => [g.contactId, g._count._all]))

  const weekAgo = now - 7 * DAY_MS
  const monthAgo = now - 30 * DAY_MS

  const rows: ClientRow[] = [...byContact.values()].map((agg) => {
    const act = activity.get(agg.contact.id)
    const lastAt = act?.lastActivityAt ?? agg.lastMessageAt
    return {
      id: agg.contact.id,
      name: agg.contact.name,
      email: agg.contact.email,
      channel: agg.channel,
      threads: agg.threads,
      engagement: engagementScore(
        {
          lastActivityAt: lastAt,
          msgs28: act?.msgs28 ?? 0,
          inbound28: act?.inbound28 ?? 0,
          outbound28: act?.outbound28 ?? 0,
        },
        now,
      ),
      risk: agg.risk,
      sentiment: agg.sentiment,
      awaitingReply: agg.awaiting,
      isNew: agg.contact.createdAt.getTime() >= monthAgo,
      lastActivityAt: lastAt?.toISOString() ?? null,
      lastActivityAgo: timeAgo(lastAt, now),
      href: agg.topConvId ? `/inbox/${agg.topConvId}` : null,
      noteCount: noteCountByContact.get(agg.contact.id) ?? 0,
    }
  })

  rows.sort((a, b) => b.engagement - a.engagement)

  return {
    rows,
    totals: {
      clients: rows.length,
      activeWeek: rows.filter((r) => r.lastActivityAt && new Date(r.lastActivityAt).getTime() >= weekAgo).length,
      atRisk: rows.filter((r) => r.risk === 'HIGH' || r.risk === 'CRITICAL').length,
      newThisMonth: rows.filter((r) => r.isNew).length,
    },
    hasIntegration: Boolean(ws.integration),
    hasData: conversations.length > 0,
  }
}
