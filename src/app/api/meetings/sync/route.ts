import { ok } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { enqueueCalendarSync } from '@/services/jobs/queue'
import { kickJobQueue } from '@/services/jobs/kick'

/**
 * Refresh meetings from Google Calendar now (the hourly cron covers steady
 * state). Returns the job id for polling via /api/jobs/:id.
 */
export async function POST() {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const job = await enqueueCalendarSync(ctx.userId)
  kickJobQueue()
  return ok({ jobId: job.id }, 202)
}
