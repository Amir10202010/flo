import { z } from 'zod'
import { getAuthUser, ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { sendGmailReply } from '@/services/gmail.service'

const BodySchema = z.object({
  body: z.string().trim().min(1, 'Message is empty').max(25000, 'Message too long'),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  const { id } = await params

  // Ownership check — never act on a conversation the user doesn't own.
  const conv = await prisma.conversation.findUnique({
    where: { id },
    select: { userId: true, channel: true },
  })
  if (!conv || conv.userId !== user.id) return err('Not found', 404)
  if (conv.channel !== 'GMAIL') return err('Replies are only supported for Gmail', 400)

  let parsed: z.infer<typeof BodySchema>
  try {
    parsed = BodySchema.parse(await req.json())
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? 'Invalid body' : 'Invalid request body'
    return err(message, 400)
  }

  try {
    const result = await sendGmailReply(user.id, id, parsed.body)
    return ok(result, 201)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to send reply'
    console.error(`[reply] conversation ${id}:`, e)
    return err(message, 500)
  }
}
