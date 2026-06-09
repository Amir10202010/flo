import { Prisma, type Job, type JobType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Durable Postgres-backed job queue.
 *
 * Jobs are claimed atomically with SELECT ... FOR UPDATE SKIP LOCKED so that
 * multiple worker instances (or the cron drain endpoint running concurrently)
 * never process the same job twice. This is the clean seam behind which the
 * sync/ingestion worker lives — it could later be reimplemented in Go against
 * the same table without touching the web/API tier.
 */

type EnqueueOptions = {
  userId?: string
  runAfter?: Date
  maxAttempts?: number
}

export async function enqueue(
  type: JobType,
  payload: Record<string, unknown>,
  opts: EnqueueOptions = {},
): Promise<Job> {
  return prisma.job.create({
    data: {
      type,
      payload: payload as Prisma.InputJsonValue,
      userId: opts.userId ?? null,
      runAfter: opts.runAfter ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 3,
    },
  })
}

/**
 * Atomically claim the next runnable job, marking it RUNNING and incrementing
 * attempts. Returns null when the queue is empty.
 */
export async function claimNext(): Promise<Job | null> {
  const rows = await prisma.$queryRaw<Job[]>(Prisma.sql`
    UPDATE "Job"
    SET status = 'RUNNING'::"JobStatus",
        "startedAt" = now(),
        attempts = attempts + 1,
        "updatedAt" = now()
    WHERE id = (
      SELECT id FROM "Job"
      WHERE status = 'PENDING'::"JobStatus" AND "runAfter" <= now()
      ORDER BY "runAfter" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *;
  `)
  return rows[0] ?? null
}

export async function completeJob(id: string, result: unknown): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      result: (result ?? null) as Prisma.InputJsonValue,
      error: null,
      finishedAt: new Date(),
    },
  })
}

/**
 * Mark a failed attempt. Retries with exponential backoff until maxAttempts,
 * after which the job is parked as FAILED.
 */
export async function failJob(job: Job, error: string): Promise<void> {
  const exhausted = job.attempts >= job.maxAttempts
  const backoffMs = Math.min(5 * 60_000, 2 ** job.attempts * 1_000) // cap 5 min
  await prisma.job.update({
    where: { id: job.id },
    data: exhausted
      ? { status: 'FAILED', error, finishedAt: new Date() }
      : { status: 'PENDING', error, runAfter: new Date(Date.now() + backoffMs) },
  })
}

export async function getJob(id: string): Promise<Job | null> {
  return prisma.job.findUnique({ where: { id } })
}

/**
 * Enqueue a Gmail sync for a user, collapsing onto an existing PENDING job to
 * avoid piling up duplicates (rapid push notifications + manual Sync). A RUNNING
 * job is NOT reused — mail that arrives mid-sync must trigger a fresh follow-up,
 * so the steady state is at most one RUNNING + one PENDING per user.
 */
export async function enqueueGmailSync(userId: string): Promise<Job> {
  const pending = await prisma.job.findFirst({
    where: { type: 'GMAIL_SYNC', userId, status: 'PENDING' },
  })
  if (pending) return pending
  return enqueue('GMAIL_SYNC', { userId }, { userId })
}
