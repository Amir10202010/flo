import { Prisma } from '@prisma/client'
import { getAuthUser, ok, err } from '@/lib/api'
import { rateLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { ensurePlainText } from '@/lib/html'
import { summarizeThread } from '@/services/ai'
import type { ThreadSummary } from '@/types'

type CachedSummary = ThreadSummary & { hash: string; provider: string; at: string }

/**
 * "Catch me up" — structured summary of a thread, cached in
 * ConversationAnalysis.analysisData.threadSummary keyed by a message-count/last-id
 * hash so repeat opens don't re-spend the model. Recomputed when the thread changes.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthUser()
  if (!user) return error
  const limited = await rateLimit(user.id, 'summarize')
  if (limited) return limited

  const { id } = await params

  const conv = await prisma.conversation.findFirst({
    where: { id, userId: user.id },
    select: {
      channel: true,
      contact: { select: { name: true } },
      analysis: { select: { id: true, analysisData: true } },
      messages: { orderBy: { sentAt: 'asc' }, select: { id: true, direction: true, content: true } },
    },
  })
  if (!conv) return err('Not found', 404)
  if (!conv.messages.length) return err('Nothing to summarize', 400)

  const hash = `${conv.messages.length}:${conv.messages[conv.messages.length - 1]?.id ?? ''}`
  const data = (conv.analysis?.analysisData ?? {}) as Record<string, unknown>
  const cached = data.threadSummary as CachedSummary | undefined
  if (cached && cached.hash === hash) {
    return ok({ tldr: cached.tldr, keyPoints: cached.keyPoints, openItems: cached.openItems, provider: cached.provider, cached: true })
  }

  try {
    const result = await summarizeThread({
      channel: conv.channel,
      contactName: conv.contact.name,
      messages: conv.messages.map((m) => ({ direction: m.direction, content: ensurePlainText(m.content) })),
    })

    // Cache only when an analysis row exists (analysisData lives there).
    if (conv.analysis) {
      const next: CachedSummary = { ...result, hash, at: new Date().toISOString() }
      await prisma.conversationAnalysis.update({
        where: { id: conv.analysis.id },
        data: { analysisData: { ...data, threadSummary: next } as unknown as Prisma.InputJsonValue },
      })
    }

    return ok({ tldr: result.tldr, keyPoints: result.keyPoints, openItems: result.openItems, provider: result.provider, cached: false })
  } catch (e) {
    console.error(`[summarize] conversation ${id}:`, e)
    return err(e instanceof Error ? e.message : 'Failed to summarize', 500)
  }
}
