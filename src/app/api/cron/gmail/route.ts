import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeCron } from '@/lib/cron'
import { enqueueMaintenanceForUsers } from '@/services/jobs/queue'
import { kickJobQueue } from '@/services/jobs/kick'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Page size for the integration fan-out — one bulk enqueue per page.
const PAGE = 1000

/**
 * Daily maintenance fan-out (Vercel Cron + external scheduler).
 *
 * Previously this did all per-user work (sync, alert scan, embed/draft backfill,
 * watch renewal, weekly digest) INLINE in a per-integration loop — O(N) in a
 * single 60s invocation, which timed out before reaching the tail at scale.
 *
 * Now it does three cheap things and returns:
 *   1. Prune terminal jobs + stale rate-limit rows (bounded table growth).
 *   2. Page through active Gmail integrations and bulk-enqueue ONE
 *      GMAIL_MAINTENANCE job per user (createMany per page, deduped).
 *   3. Kick the queue so draining starts immediately.
 *
 * The actual per-user work runs on the durable queue (runGmailMaintenance),
 * bounded and drained across many worker / jobs-process / kick invocations.
 * Secret-protected (authorizeCron).
 */
async function handle(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const errors: string[] = []

  // Retention: prune terminal jobs so the durable queue table doesn't grow
  // without bound — every sync/analyze/embed/draft leaves a COMPLETED row.
  let prunedJobs = 0
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const pruned = await prisma.job.deleteMany({
      where: { status: { in: ['COMPLETED', 'FAILED'] }, finishedAt: { lt: cutoff } },
    })
    prunedJobs = pruned.count
  } catch (e) {
    errors.push(`job-prune: ${String(e)}`)
  }

  // Prune stale rate-limit counter rows (one per identity+route window).
  try {
    const rlCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: rlCutoff } } })
  } catch (e) {
    errors.push(`ratelimit-prune: ${String(e)}`)
  }

  // Page through active Gmail integrations; bulk-enqueue a maintenance job per
  // user. One createMany per page keeps the cron cheap at any scale.
  let integrations = 0
  let maintenanceQueued = 0
  let cursor: string | undefined
  try {
    for (;;) {
      const batch = await prisma.integration.findMany({
        where: { type: 'GMAIL', isActive: true },
        select: { id: true, userId: true },
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })
      if (!batch.length) break
      integrations += batch.length
      maintenanceQueued += await enqueueMaintenanceForUsers(batch.map((b) => b.userId))
      if (batch.length < PAGE) break
      cursor = batch[batch.length - 1].id
    }
  } catch (e) {
    errors.push(`enqueue-maintenance: ${String(e)}`)
  }

  // Start draining immediately (post-response); the worker / jobs-process cron
  // mop up the rest. Safe to overlap — claimNext uses FOR UPDATE SKIP LOCKED.
  kickJobQueue()

  return NextResponse.json({ integrations, maintenanceQueued, prunedJobs, errors })
}

export async function GET(req: NextRequest) {
  return handle(req)
}
export async function POST(req: NextRequest) {
  return handle(req)
}
