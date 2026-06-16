import { prisma } from '@/lib/prisma'
import { ensurePlainText } from '@/lib/html'
import { generateReplyDraft } from './ai'
import type { DraftOutcome, DraftTone } from '@/types'

/**
 * Reply-draft orchestration: assembles conversation context (thread + AI
 * analysis + contact) and, for the MATCH tone, a sample of the user's own
 * recent sent messages, then calls the provider-agnostic `generateReplyDraft`.
 *
 * Used by both the interactive draft API and the background GENERATE_DRAFT job
 * (Phase 3). All queries run sequentially — the runtime Prisma pool is small
 * (see CLAUDE.md), so no Promise.all fan-out in this request path.
 */

const STYLE_TTL = 10 * 60_000
const styleCache = new Map<string, { samples: string[]; at: number }>()

/** HTML→text + drop trailing quoted reply history, so prompts stay on-signal. */
function textOf(content: string): string {
  return ensurePlainText(content)
    .split('\n')
    .filter((l) => {
      const t = l.trim()
      return !t.startsWith('>') && !/^On .{3,120} wrote:$/.test(t)
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Up to 5 of the user's most recent OUTBOUND message bodies, as voice samples
 * for the MATCH tone. Cached briefly per user; never persisted — they are only
 * the user's own writing, used transiently in the prompt.
 */
export async function collectStyleSamples(userId: string): Promise<string[]> {
  const hit = styleCache.get(userId)
  if (hit && Date.now() - hit.at < STYLE_TTL) return hit.samples

  const msgs = await prisma.message.findMany({
    where: { direction: 'OUTBOUND', conversation: { userId } },
    orderBy: { sentAt: 'desc' },
    take: 12,
    select: { content: true },
  })
  const samples = msgs
    .map((m) => textOf(m.content).replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 20)
    .slice(0, 5)

  styleCache.set(userId, { samples, at: Date.now() })
  return samples
}

/**
 * Generate a reply draft for one conversation. Ownership is enforced by scoping
 * the lookup to `userId`. Throws if the conversation isn't found/owned.
 */
export async function generateReplyDraftForConversation(
  userId: string,
  conversationId: string,
  opts: { tone?: DraftTone; steer?: string; fallbackOnRetryable?: boolean } = {},
): Promise<DraftOutcome> {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      channel: true,
      contact: { select: { name: true } },
      analysis: { select: { summary: true, nextAction: true } },
      messages: {
        orderBy: { sentAt: 'asc' },
        select: { direction: true, content: true },
      },
    },
  })
  if (!conv) throw new Error('Conversation not found')

  const tone = opts.tone ?? 'WARM'
  const styleSamples = tone === 'MATCH' ? await collectStyleSamples(userId) : undefined

  return generateReplyDraft(
    {
      channel: conv.channel,
      contactName: conv.contact.name,
      messages: conv.messages.map((m) => ({ direction: m.direction, content: textOf(m.content) })),
      analysisSummary: conv.analysis?.summary,
      nextAction: conv.analysis?.nextAction ?? undefined,
      tone,
      steer: opts.steer,
      styleSamples,
      mode: 'reply',
    },
    { fallbackOnRetryable: opts.fallbackOnRetryable },
  )
}
