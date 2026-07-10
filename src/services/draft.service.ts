import { prisma } from '@/lib/prisma'
import { ensurePlainText } from '@/lib/html'
import { generateReplyDraft, getTextProvider } from './ai'
import { autoDraftsRemaining } from './billing.service'
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
export async function collectStyleSamples(organizationId: string): Promise<string[]> {
  const hit = styleCache.get(organizationId)
  if (hit && Date.now() - hit.at < STYLE_TTL) return hit.samples

  const msgs = await prisma.message.findMany({
    where: { direction: 'OUTBOUND', conversation: { organizationId } },
    orderBy: { sentAt: 'desc' },
    take: 12,
    select: { content: true },
  })
  const samples = msgs
    .map((m) => textOf(m.content).replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 20)
    .slice(0, 5)

  styleCache.set(organizationId, { samples, at: Date.now() })
  return samples
}

/**
 * Generate a reply draft for one conversation. Ownership is enforced by scoping
 * the lookup to `organizationId`. Throws if the conversation isn't found/owned.
 */
export async function generateReplyDraftForConversation(
  organizationId: string,
  conversationId: string,
  opts: { tone?: DraftTone; steer?: string; fallbackOnRetryable?: boolean } = {},
): Promise<DraftOutcome> {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
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
  const styleSamples = tone === 'MATCH' ? await collectStyleSamples(organizationId) : undefined

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

// ── Auto-draft persistence (background GENERATE_DRAFT job) ───────────────────

/**
 * Generate and store an auto-draft for an urgent awaiting thread. Skipped when:
 * there's no AI text provider (we don't pre-bake offline templates), the thread
 * is no longer awaiting a reply, or generation falls back to the local template.
 * Retryable provider errors propagate so the job queue backs off and retries.
 */
export async function upsertAutoDraft(
  conversationId: string,
): Promise<{ generated: boolean; reason?: string }> {
  if (!getTextProvider()) return { generated: false, reason: 'no-provider' }

  // System-generated: derive the org (ownership) and author from the thread.
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      organizationId: true,
      userId: true,
      messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { id: true, direction: true } },
    },
  })
  if (!conv) return { generated: false, reason: 'not-found' }
  if (!conv.organizationId) return { generated: false, reason: 'no-org' }
  // Free gets a taste — a capped number of auto-drafts per month; paid is
  // unlimited. 0 remaining (cap hit, or a plan with no allowance) skips.
  if ((await autoDraftsRemaining(conv.organizationId)) <= 0) return { generated: false, reason: 'quota' }

  const latest = conv.messages[0]
  if (!latest || latest.direction !== 'INBOUND') return { generated: false, reason: 'not-awaiting' }

  // fallbackOnRetryable:false → 429/transient rethrows (job retries); a
  // non-retryable failure yields a local draft, which we deliberately drop.
  const draft = await generateReplyDraftForConversation(conv.organizationId, conversationId, { tone: 'WARM' })
  if (draft.provider === 'local') return { generated: false, reason: 'provider-fell-back' }

  const data = {
    userId: conv.userId,
    organizationId: conv.organizationId,
    body: draft.body,
    tone: 'WARM',
    provider: draft.provider,
    basedOnMessageId: latest.id,
    status: 'READY',
  }
  await prisma.conversationDraft.upsert({
    where: { conversationId },
    create: { conversationId, ...data },
    update: data,
  })
  return { generated: true }
}

/** The latest READY auto-draft for a conversation (owner-scoped), or null. */
export async function getReadyDraft(
  organizationId: string,
  conversationId: string,
): Promise<{ body: string; provider: string } | null> {
  const d = await prisma.conversationDraft.findFirst({
    where: { conversationId, organizationId, status: 'READY' },
    select: { body: true, provider: true },
  })
  return d ? { body: d.body, provider: d.provider } : null
}

/** Mark a conversation's pending draft as consumed (user opened/edited it). */
export async function dismissDraft(conversationId: string): Promise<void> {
  await prisma.conversationDraft.updateMany({ where: { conversationId }, data: { status: 'DISMISSED' } })
}

/** Mark a conversation's pending draft as sent (a reply went out). */
export async function markDraftSent(conversationId: string): Promise<void> {
  await prisma.conversationDraft.updateMany({ where: { conversationId }, data: { status: 'SENT' } })
}
