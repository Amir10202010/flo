import { z } from 'zod'
import { ok, err, upgradeRequired } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { orgHasFeature } from '@/services/billing.service'
import { dismissDraft, generateReplyDraftForConversation } from '@/services/draft.service'

const BodySchema = z.object({
  tone: z.enum(['WARM', 'CONCISE', 'FORMAL', 'MATCH']).optional(),
  steer: z.string().trim().max(500).optional(),
})

/**
 * Generate an AI reply draft for a conversation. The draft is returned for the
 * user to review/edit before sending — it is NEVER sent here (that stays the
 * job of POST /reply). Interactive path → fallbackOnRetryable so a transient
 * quota blip still yields a usable (labelled) draft instead of an error.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'draft')
  if (limited) return limited

  const { id } = await params

  const conv = await prisma.conversation.findUnique({
    where: { id },
    select: { organizationId: true, channel: true },
  })
  if (!conv || conv.organizationId !== ctx.organization.id) return err('Not found', 404)
  if (conv.channel !== 'GMAIL') return err('Drafts are only supported for Gmail', 400)

  if (!(await orgHasFeature(ctx.organization.id, 'aiDrafts'))) {
    return upgradeRequired('Upgrade to Pro to use AI drafts')
  }

  let parsed: z.infer<typeof BodySchema>
  try {
    parsed = BodySchema.parse(await req.json().catch(() => ({})))
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? 'Invalid body' : 'Invalid request body'
    return err(message, 400)
  }

  try {
    const draft = await generateReplyDraftForConversation(ctx.organization.id, id, {
      tone: parsed.tone,
      steer: parsed.steer,
      fallbackOnRetryable: true,
    })
    return ok(draft)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate draft'
    console.error(`[draft] conversation ${id}:`, e)
    return err(message, 500)
  }
}

/** Dismiss a conversation's pending auto-draft (clears the "draft ready" badge). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error

  const { id } = await params
  const conv = await prisma.conversation.findUnique({ where: { id }, select: { organizationId: true } })
  if (!conv || conv.organizationId !== ctx.organization.id) return err('Not found', 404)

  await dismissDraft(id)
  return ok({ dismissed: true })
}
