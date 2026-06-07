import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { type ConversationStatus, type PriorityLevel, type ChannelEnum } from '@prisma/client'
import type { ConversationListItem } from '@/types'

const VALID_STATUS = new Set(['ACTIVE', 'ARCHIVED', 'LOST'])
const VALID_PRIORITY = new Set(['HOT', 'ATTENTION', 'COLD', 'SPAM'])
const VALID_CHANNEL = new Set(['TELEGRAM', 'GMAIL'])

export async function GET(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const priority = sp.get('priority')
  const channel = sp.get('channel')
  const limitParam = sp.get('limit')

  if (status && !VALID_STATUS.has(status)) return err('Invalid status', 400)
  if (priority && !VALID_PRIORITY.has(priority)) return err('Invalid priority', 400)
  if (channel && !VALID_CHANNEL.has(channel)) return err('Invalid channel', 400)

  const limit = limitParam
    ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50))
    : 50

  const rows = await prisma.conversation.findMany({
    where: {
      userId: user.id,
      ...(status   ? { status:   status   as ConversationStatus } : {}),
      ...(priority ? { priority: priority as PriorityLevel } : {}),
      ...(channel  ? { channel:  channel  as ChannelEnum } : {}),
    },
    include: {
      contact: { select: { name: true, email: true } },
      // Only the latest message for the preview snippet
      messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { content: true } },
    },
    orderBy: [{ priorityScore: 'desc' }, { lastMessageAt: 'desc' }],
    take: limit,
  })

  const items: ConversationListItem[] = rows.map((c) => ({
    id: c.id,
    channel: c.channel as ConversationListItem['channel'],
    subject: c.subject,
    status: c.status as ConversationListItem['status'],
    priority: c.priority as ConversationListItem['priority'],
    priorityScore: c.priorityScore,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    contact: { name: c.contact.name, email: c.contact.email },
    lastMessage: c.messages[0]?.content.slice(0, 200) ?? null,
    unreadCount: 0,
  }))

  return ok(items)
}
