import { getAuthUser, ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { ensurePlainText } from '@/lib/html'
import type { ConversationDetail } from '@/types'

type AnalysisShape = NonNullable<ConversationDetail['analysis']>
type MessageShape  = ConversationDetail['messages'][number]

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  const { id } = await params

  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      contact: { select: { name: true, email: true, telegramId: true } },
      messages: { orderBy: { sentAt: 'asc' } },
      analysis: true,
    },
  })

  // Return 404 for both missing and wrong-owner — avoids leaking IDs
  if (!conv || conv.userId !== user.id) return err('Not found', 404)

  const detail: ConversationDetail = {
    id: conv.id,
    channel: conv.channel as ConversationDetail['channel'],
    subject: conv.subject,
    status: conv.status as ConversationDetail['status'],
    priority: conv.priority as ConversationDetail['priority'],
    priorityScore: conv.priorityScore,
    lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
    lastAnalyzedAt: conv.lastAnalyzedAt?.toISOString() ?? null,
    contact: conv.contact,
    messages: conv.messages.map((m) => ({
      id: m.id,
      direction: m.direction as MessageShape['direction'],
      content: ensurePlainText(m.content),
      contentType: m.contentType as MessageShape['contentType'],
      sentAt: m.sentAt.toISOString(),
      isRead: m.isRead,
    })),
    analysis: conv.analysis
      ? {
          summary: conv.analysis.summary,
          riskLevel: conv.analysis.riskLevel as AnalysisShape['riskLevel'],
          riskReasons: conv.analysis.riskReasons,
          nextAction: conv.analysis.nextAction,
          lostReason: conv.analysis.lostReason,
          sentiment: conv.analysis.sentiment as AnalysisShape['sentiment'],
          updatedAt: conv.analysis.updatedAt.toISOString(),
        }
      : null,
  }

  return ok(detail)
}
