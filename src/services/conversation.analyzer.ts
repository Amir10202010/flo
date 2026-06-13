import { prisma } from '@/lib/prisma'
import { analyzeConversationContent } from './ai'
import { calculatePriority } from './priority.engine'
import type { AnalyzeResponse } from '@/types'

export async function analyzeConversation(
  conversationId: string,
  opts: { fallbackOnRetryable?: boolean } = {},
): Promise<AnalyzeResponse> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { sentAt: 'asc' }, take: 50 },
      contact: true,
    },
  })
  if (!conversation) throw new Error('Conversation not found')

  const { provider, ...analysis } = await analyzeConversationContent(
    {
      conversationId,
      channel: conversation.channel,
      contactName: conversation.contact.name,
      messages: conversation.messages.map((m) => ({
        direction: m.direction,
        content: m.content,
        sentAt: m.sentAt.toISOString(),
      })),
    },
    opts,
  )

  const fields = {
    summary: analysis.summary,
    riskLevel: analysis.riskLevel,
    riskReasons: analysis.riskReasons,
    nextAction: analysis.nextAction,
    lostReason: analysis.lostReason ?? null,
    sentiment: analysis.sentiment,
    // Provider tag lets the UI distinguish full AI analysis from the local
    // heuristic fallback (module honesty policy).
    analysisData: { provider },
  }

  await prisma.conversationAnalysis.upsert({
    where: { conversationId },
    create: { conversationId, ...fields },
    update: fields,
  })

  const priority = calculatePriority(
    conversation.messages,
    analysis,
    conversation.lastMessageAt ?? null,
  )

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      priority: priority.level,
      priorityScore: priority.score,
      lastAnalyzedAt: new Date(),
    },
  })

  return { analysis, priority }
}
