import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { enqueueGmailSync } from '@/services/jobs/queue'
import { kickJobQueue } from '@/services/jobs/kick'

// Allow the post-response `after()` drain to run up to the platform max.
export const maxDuration = 60

/**
 * Enqueue a Gmail sync for the organization's shared inbox and return immediately
 * (202). Any member can refresh the shared inbox; the sync runs under the
 * connecting account. The sync runs in the background — a post-response `after()`
 * kick starts draining it instantly, and the cron-driven /api/jobs/process drain
 * is the backstop. The client polls GET /api/jobs/[id] for the result.
 */
export async function POST() {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'sync')
  if (limited) return limited

  const integration = await prisma.integration.findFirst({
    where: { organizationId: ctx.organization.id, type: 'GMAIL', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  })
  if (!integration) {
    return NextResponse.json({ error: 'Gmail integration not found or inactive' }, { status: 400 })
  }

  const job = await enqueueGmailSync(integration.userId)
  kickJobQueue()
  return NextResponse.json({ jobId: job.id, status: 'queued' }, { status: 202 })
}
