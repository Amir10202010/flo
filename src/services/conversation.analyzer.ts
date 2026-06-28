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

  // AI category enhancement (never a single point of failure): only refine when
  // a real AI model ran and the user hasn't manually set the category. The model
  // corrects either an unsure PRIMARY OR a low-confidence rule bucket (a wording
  // false-positive the heuristics were not sure about) — but never a confident
  // rule bucket, a prior AI decision, or a manual move. Once AI sets it, the
  // `ai` source makes the decision sticky (it won't fight itself next analysis).
  const CATEGORY_CONFIDENCE_FLOOR = 0.6
  const ruleWasUnsure =
    conversation.category === 'PRIMARY' ||
    (conversation.categorySource !== 'ai' &&
      (conversation.categoryConfidence == null ||
        conversation.categoryConfidence < CATEGORY_CONFIDENCE_FLOOR))
  const refineCategory =
    provider === 'gemini' &&
    analysis.category &&
    analysis.category !== conversation.category &&
    conversation.categorySource !== 'manual' &&
    ruleWasUnsure

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      priority: priority.level,
      priorityScore: priority.score,
      lastAnalyzedAt: new Date(),
      ...(refineCategory ? { category: analysis.category, categorySource: 'ai', categoryConfidence: null } : {}),
    },
  })

  return { analysis, priority }
}
