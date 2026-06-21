import { z } from 'zod'
import { getAuthUser, ok, err } from '@/lib/api'
import { rateLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { sanitizeMessageHtml } from '@/lib/sanitize-email'
import { sendGmailMessage } from '@/services/gmail.service'

const BodySchema = z.object({
  to: z.string().trim().email('Enter a valid recipient email'),
  subject: z.string().trim().max(300).optional(),
  body: z.string().trim().min(1, 'Message is empty').max(25000),
})

/**
 * Send a brand-new email through the user's connected Gmail. Plain-text body is
 * rendered to safe HTML for the multipart/alternative message.
 */
export async function POST(req: Request) {
  const { user, error } = await getAuthUser()
  if (!user) return error
  const limited = await rateLimit(user.id, 'composeSend')
  if (limited) return limited

  let parsed: z.infer<typeof BodySchema>
  try {
    parsed = BodySchema.parse(await req.json())
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? 'Invalid body' : 'Invalid request body'
    return err(message, 400)
  }

  const integration = await prisma.integration.findFirst({
    where: { userId: user.id, type: 'GMAIL', isActive: true },
  })
  if (!integration) return err('No active Gmail integration', 400)

  try {
    const subject = parsed.subject?.trim() || '(no subject)'
    const result = await sendGmailMessage(integration, {
      to: parsed.to,
      subject,
      html: sanitizeMessageHtml(parsed.body),
      text: parsed.body,
    })
    return ok(result, 201)
  } catch (e) {
    console.error('[compose/send] failed:', e)
    return err(e instanceof Error ? e.message : 'Failed to send', 500)
  }
}
