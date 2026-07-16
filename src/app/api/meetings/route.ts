import { type NextRequest } from 'next/server'
import { ok } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { logManualMeeting } from '@/services/meeting.service'

/**
 * Log a meeting that wasn't on the calendar (a call, an in-person chat) —
 * capture then works exactly like a detected meeting.
 *   POST /api/meetings  { "title"?: string, "startsAt"?: ISO }
 */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const body = (await req.json().catch(() => null)) as { title?: unknown; startsAt?: unknown } | null
  const startsAt = typeof body?.startsAt === 'string' ? new Date(body.startsAt) : undefined
  const meeting = await logManualMeeting(
    { userId: ctx.userId, organizationId: ctx.organization.id },
    {
      title: typeof body?.title === 'string' ? body.title : undefined,
      startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : undefined,
    },
  )
  return ok({ id: meeting.id }, 201)
}
