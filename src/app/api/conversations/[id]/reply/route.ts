import { z } from 'zod'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { sendGmailReply } from '@/services/gmail.service'

const BodySchema = z.object({
  body: z.string().trim().min(1, 'Message is empty').max(25000, 'Message too long'),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Replying to a shared thread requires write access (VIEWER is read-only).
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'reply')
  if (limited) return limited

  const { id } = await params

  // Ownership check — never act on a conversation outside the active org.
  const conv = await prisma.conversation.findUnique({
    where: { id },
    select: { organizationId: true, channel: true },
  })
  if (!conv || conv.organizationId !== ctx.organization.id) return err('Not found', 404)
  if (conv.channel !== 'GMAIL') return err('Replies are only supported for Gmail', 400)

  let parsed: z.infer<typeof BodySchema>
  try {
    parsed = BodySchema.parse(await req.json())
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? 'Invalid body' : 'Invalid request body'
    return err(message, 400)
  }

  try {
    const result = await sendGmailReply(ctx.organization.id, id, parsed.body)
    return ok(result, 201)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to send reply'
    console.error(`[reply] conversation ${id}:`, e)
    return err(message, 500)
  }
}
