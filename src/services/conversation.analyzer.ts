import { prisma } from '@/lib/prisma'
import { analyzeConversation as aiAnalyze } from './gemini.service'
import { calculatePriority } from './priority.engine'

export async function analyzeConversation(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { sentAt: 'asc' }, take: 50 }, contact: true, analysis: true },
  })
  if (!conversation) throw new Error('Conversation not found')

  const analysis = await aiAnalyze({
    conversationId,
    contactName: conversation.contact?.name ?? 'Unknown',
    messages: conversation.messages.map((message) => ({
      direction: message.direction,
      content: message.content,
      sentAt: message.sentAt.toISOString(),
    })),
  })

  // Upsert analysis if Prisma available
  try {
    await prisma.conversationAnalysis.upsert({
      where: { conversationId },
      create: {
        conversationId,
        summary: analysis.summary,
        riskLevel: analysis.riskLevel,
        riskReasons: analysis.riskReasons,
        nextAction: analysis.nextAction,
        lostReason: analysis.lostReason ?? undefined,
        sentiment: analysis.sentiment,
      },
      update: {
        summary: analysis.summary,
        riskLevel: analysis.riskLevel,
        riskReasons: analysis.riskReasons,
        nextAction: analysis.nextAction,
        lostReason: analysis.lostReason ?? undefined,
        sentiment: analysis.sentiment,
      },
    })
  } catch (e) {
    // ignore in placeholder
  }

  const priority = calculatePriority(conversation.messages, analysis, conversation.lastMessageAt ?? null)

  await prisma.conversation.update({ where: { id: conversationId }, data: { priority: priority.level, priorityScore: priority.score } })

  return { analysis, priority }
}
