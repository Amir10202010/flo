import { z } from 'zod'
import { ok, err, upgradeRequired } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { orgHasFeature } from '@/services/billing.service'
import { generateReplyDraft } from '@/services/ai'
import { collectStyleSamples } from '@/services/draft.service'

const BodySchema = z.object({
  instruction: z.string().trim().min(1, 'Describe what to say').max(1000),
  tone: z.enum(['WARM', 'CONCISE', 'FORMAL', 'MATCH']).optional(),
  to: z.string().trim().max(200).optional(),
})

/**
 * Smart Compose — turn a one-line instruction into a full new-email draft
 * (subject + body) for review. Never sends (that's POST /api/compose/send).
 */
export async function POST(req: Request) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'composeDraft')
  if (limited) return limited

  if (!(await orgHasFeature(ctx.organization.id, 'aiDrafts'))) {
    return upgradeRequired('Upgrade to Pro to use Smart Compose')
  }

  let parsed: z.infer<typeof BodySchema>
  try {
    parsed = BodySchema.parse(await req.json())
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? 'Invalid body' : 'Invalid request body'
    return err(message, 400)
  }

  const tone = parsed.tone ?? 'WARM'
  const styleSamples = tone === 'MATCH' ? await collectStyleSamples(ctx.organization.id) : undefined

  try {
    const draft = await generateReplyDraft(
      {
        channel: 'GMAIL',
        contactName: parsed.to ?? '',
        messages: [],
        tone,
        steer: parsed.instruction,
        styleSamples,
        mode: 'compose',
      },
      { fallbackOnRetryable: true },
    )
    return ok(draft)
  } catch (e) {
    console.error('[compose/draft] failed:', e)
    return err(e instanceof Error ? e.message : 'Failed to draft', 500)
  }
}
