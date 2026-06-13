import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { embedTexts, getEmbeddingProvider } from './ai'

/**
 * Conversation embeddings for semantic search.
 *
 * One vector per conversation, built from subject + contact + recent messages
 * + AI summary, stored as a packed Float32Array (Bytes). contentHash makes
 * re-embedding idempotent: unchanged conversations are skipped, so EMBED jobs
 * are safe to enqueue aggressively (post-sync, post-analysis, backfill).
 */

const MAX_MESSAGES = 6
const MAX_CHARS_PER_MESSAGE = 400

export function vectorToBuffer(vector: number[]): Buffer {
  return Buffer.from(new Float32Array(vector).buffer)
}

export function bufferToVector(buf: Buffer): Float32Array {
  // Slice to a fresh ArrayBuffer view — Node Buffers can share pooled memory.
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
}

function buildEmbeddingText(input: {
  subject: string | null
  contactName: string
  contactEmail: string | null
  summary: string | null
  messages: { direction: string; content: string }[]
}): string {
  const lines = [
    `Contact: ${input.contactName}${input.contactEmail ? ` <${input.contactEmail}>` : ''}`,
    input.subject ? `Subject: ${input.subject}` : null,
    input.summary ? `Summary: ${input.summary}` : null,
    ...input.messages.map((m) => {
      const role = m.direction === 'INBOUND' ? 'Client' : 'Me'
      const body = m.content.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS_PER_MESSAGE)
      return body ? `${role}: ${body}` : null
    }),
  ]
  return lines.filter(Boolean).join('\n')
}

export type EmbedConversationResult =
  | { status: 'updated'; model: string }
  | { status: 'unchanged' }
  | { status: 'skipped'; reason: 'no-provider' | 'not-found' | 'empty' }

/** Compute and persist the embedding for one conversation (idempotent). */
export async function embedConversation(conversationId: string): Promise<EmbedConversationResult> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      subject: true,
      contact: { select: { name: true, email: true } },
      analysis: { select: { summary: true } },
      messages: {
        orderBy: { sentAt: 'desc' },
        take: MAX_MESSAGES,
        select: { direction: true, content: true },
      },
    },
  })
  if (!conv) return { status: 'skipped', reason: 'not-found' }

  const text = buildEmbeddingText({
    subject: conv.subject,
    contactName: conv.contact.name,
    contactEmail: conv.contact.email,
    summary: conv.analysis?.summary ?? null,
    messages: [...conv.messages].reverse(),
  })
  if (!text.trim()) return { status: 'skipped', reason: 'empty' }

  const provider = getEmbeddingProvider()
  if (!provider) return { status: 'skipped', reason: 'no-provider' }

  const contentHash = createHash('sha256').update(text).digest('hex')

  // Hash check BEFORE the network call — unchanged conversations cost zero quota.
  // Re-embed when the content OR the embedding model changed.
  const existing = await prisma.conversationEmbedding.findUnique({
    where: { conversationId },
    select: { contentHash: true, model: true },
  })
  if (existing && existing.contentHash === contentHash && existing.model === provider.embeddingModel) {
    return { status: 'unchanged' }
  }

  const result = await embedTexts([text], 'document')
  if (!result) return { status: 'skipped', reason: 'no-provider' }

  const vector = vectorToBuffer(result.vectors[0])
  await prisma.conversationEmbedding.upsert({
    where: { conversationId },
    create: { conversationId, model: result.model, dims: result.dims, vector, contentHash },
    update: { model: result.model, dims: result.dims, vector, contentHash },
  })
  return { status: 'updated', model: result.model }
}

/**
 * Conversation IDs (for this user) that have no embedding yet — backfill
 * candidates. Bounded so a single cron tick enqueues a sane batch.
 */
export async function findUnembeddedConversationIds(userId: string, limit = 50): Promise<string[]> {
  const rows = await prisma.conversation.findMany({
    where: { userId, integration: { isActive: true }, embedding: null },
    select: { id: true },
    orderBy: { lastMessageAt: 'desc' },
    take: limit,
  })
  return rows.map((r) => r.id)
}
