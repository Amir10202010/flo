import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { rateLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import {
  type ConversationStatus,
  type PriorityLevel,
  type ChannelEnum,
  type EmailCategory,
  type RiskLevel,
  type Sentiment,
} from '@prisma/client'
import { messagePreview } from '@/lib/html'
import { compactAgo } from '@/lib/time'
import { isEmailCategory } from '@/lib/categories'
import { buildWhere } from '@/services/search.service'
import type { ConversationListItem } from '@/types'

const VALID_STATUS = new Set(['ACTIVE', 'ARCHIVED', 'LOST'])
const VALID_PRIORITY = new Set(['HOT', 'ATTENTION', 'COLD', 'SPAM'])
const VALID_CHANNEL = new Set(['TELEGRAM', 'GMAIL'])
const VALID_RISK = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const VALID_SENTIMENT = new Set(['POSITIVE', 'NEUTRAL', 'NEGATIVE'])
const VALID_SORT = new Set(['priority', 'recent', 'oldest'])

/**
 * List conversations with server-side filtering + sorting that spans the WHOLE
 * mailbox (not just the rows already loaded in the inbox). Filters: status,
 * priority (at-least), channel, category, risk (at-least), sentiment, awaiting,
 * plus a day window and sort order. Reuses the shared `buildWhere`.
 */
export async function GET(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (!user) return error
  const limited = await rateLimit(user.id, 'mutate')
  if (limited) return limited

  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const priority = sp.get('priority')
  const channel = sp.get('channel')
  const category = sp.get('category')
  const risk = sp.get('risk')
  const sentiment = sp.get('sentiment')
  const awaitingParam = sp.get('awaiting')
  const sort = sp.get('sort') ?? 'priority'
  const daysBackParam = sp.get('daysBack')
  const limitParam = sp.get('limit')

  if (status && !VALID_STATUS.has(status)) return err('Invalid status', 400)
  if (priority && !VALID_PRIORITY.has(priority)) return err('Invalid priority', 400)
  if (channel && !VALID_CHANNEL.has(channel)) return err('Invalid channel', 400)
  if (category && !isEmailCategory(category)) return err('Invalid category', 400)
  if (risk && !VALID_RISK.has(risk)) return err('Invalid risk', 400)
  if (sentiment && !VALID_SENTIMENT.has(sentiment)) return err('Invalid sentiment', 400)
  if (!VALID_SORT.has(sort)) return err('Invalid sort', 400)

  const limit = limitParam ? Math.min(200, Math.max(1, parseInt(limitParam, 10) || 50)) : 50
  const daysBack = daysBackParam ? parseInt(daysBackParam, 10) : 0
  const sinceDate = daysBack > 0 ? new Date(Date.now() - daysBack * 86_400_000) : null
  const awaiting = awaitingParam === 'true' ? true : awaitingParam === 'false' ? false : undefined

  const where = buildWhere(user.id, {
    status: (status as ConversationStatus) || undefined,
    channel: (channel as ChannelEnum) || undefined,
    category: (category as EmailCategory) || undefined,
    priority: (priority as PriorityLevel) || undefined,
    risk: (risk as RiskLevel) || undefined,
    sentiment: (sentiment as Sentiment) || undefined,
    awaiting,
    sinceDate,
  })

  const orderBy =
    sort === 'recent'
      ? [{ lastMessageAt: 'desc' as const }]
      : sort === 'oldest'
        ? [{ lastMessageAt: 'asc' as const }]
        : [{ priorityScore: 'desc' as const }, { lastMessageAt: 'desc' as const }]

  const rows = await prisma.conversation.findMany({
    where,
    include: {
      contact: { select: { name: true, email: true } },
      analysis: { select: { nextAction: true } },
      messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { content: true } },
      draft: { select: { status: true } },
    },
    orderBy,
    take: limit,
  })

  const items: ConversationListItem[] = rows.map((c) => ({
    id: c.id,
    channel: c.channel as ConversationListItem['channel'],
    subject: c.subject,
    status: c.status as ConversationListItem['status'],
    priority: c.priority as ConversationListItem['priority'],
    priorityScore: c.priorityScore,
    category: c.category as ConversationListItem['category'],
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    contact: { name: c.contact.name, email: c.contact.email },
    lastMessage: c.messages[0] ? messagePreview(c.messages[0].content, 200) : null,
    unreadCount: 0,
    timeLabel: compactAgo(c.lastMessageAt),
    awaitingReply: c.awaitingReply,
    nextAction: c.analysis?.nextAction ?? null,
    hasDraft: c.draft?.status === 'READY',
  }))

  return ok(items)
}
