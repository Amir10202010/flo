import { prisma } from '@/lib/prisma'
import { analyzeConversation as callGemini } from './gemini.service'
import { calculatePriority } from './priority.engine'
import type { AnalyzeResponse } from '@/types'

export async function analyzeConversation(conversationId: string): Promise<AnalyzeResponse> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { sentAt: 'asc' }, take: 50 },
      contact: true,
    },
  })
  if (!conversation) throw new Error('Conversation not found')

  const analysis = await callGemini({
    conversationId,
    channel: conversation.channel,
    contactName: conversation.contact.name,
    messages: conversation.messages.map((m) => ({
      direction: m.direction,
      content: m.content,
      sentAt: m.sentAt.toISOString(),
    })),
  })

  await prisma.conversationAnalysis.upsert({
    where: { conversationId },
    create: {
      conversationId,
      summary: analysis.summary,
      riskLevel: analysis.riskLevel,
      riskReasons: analysis.riskReasons,
      nextAction: analysis.nextAction,
      lostReason: analysis.lostReason ?? null,
      sentiment: analysis.sentiment,
    },
    update: {
      summary: analysis.summary,
      riskLevel: analysis.riskLevel,
      riskReasons: analysis.riskReasons,
      nextAction: analysis.nextAction,
      lostReason: analysis.lostReason ?? null,
      sentiment: analysis.sentiment,
    },
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
