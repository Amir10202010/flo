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
      ORDER BY "runAfter" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *;
  `)
  return rows[0] ?? null
}

/**
 * Recover jobs orphaned in RUNNING — claimed by an invocation that was killed
 * (serverless timeout / crash) before it could complete or fail them. Since
 * claimNext only picks PENDING, such rows would otherwise sit RUNNING forever.
 *
 * A job stuck longer than `staleAfterMs` is requeued as PENDING for another
 * attempt, or parked as FAILED once it has exhausted maxAttempts. Cheap and
 * idempotent — called at the top of every drain.
 */
export async function reapStuckJobs(staleAfterMs = 5 * 60_000): Promise<number> {
  const cutoff = new Date(Date.now() - staleAfterMs)

  // Exhausted → terminal FAILED.
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "Job"
    SET status = 'FAILED'::"JobStatus",
        error = 'stuck in RUNNING (invocation killed before completion)',
        "finishedAt" = now(),
        "updatedAt" = now()
    WHERE status = 'RUNNING'::"JobStatus"
      AND "startedAt" < ${cutoff}
      AND attempts >= "maxAttempts";
  `)

  // Still has attempts left → requeue.
  const requeued = await prisma.$executeRaw(Prisma.sql`
    UPDATE "Job"
    SET status = 'PENDING'::"JobStatus",
        "runAfter" = now(),
        "updatedAt" = now()
    WHERE status = 'RUNNING'::"JobStatus"
      AND "startedAt" < ${cutoff}
      AND attempts < "maxAttempts";
  `)

  return requeued
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

/** Bulk-enqueue jobs of one type in a single round trip. */
export async function enqueueMany(
  type: JobType,
  payloads: Record<string, unknown>[],
  opts: EnqueueOptions = {},
): Promise<number> {
  if (!payloads.length) return 0
  const res = await prisma.job.createMany({
    data: payloads.map((payload) => ({
      type,
      payload: payload as Prisma.InputJsonValue,
      userId: opts.userId ?? null,
      runAfter: opts.runAfter ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 3,
    })),
  })
  return res.count
}

/**
 * Enqueue a Gmail sync for a user, collapsing onto an existing PENDING job to
 * avoid piling up duplicates (rapid push notifications + manual Sync). A RUNNING
 * job is NOT reused — mail that arrives mid-sync must trigger a fresh follow-up,
 * so the steady state is at most one RUNNING + one PENDING per user.
 *
 * If the existing PENDING job is a backoff retry scheduled in the future, pull
 * it forward: an explicit trigger (connect, manual sync, push) should run now,
 * not after the remaining backoff — otherwise the UI polls a job that is not
 * even eligible to run and times out.
 */
export async function enqueueGmailSync(userId: string): Promise<Job> {
  const pending = await prisma.job.findFirst({
    where: { type: 'GMAIL_SYNC', userId, status: 'PENDING' },
  })
  if (pending) {
    if (pending.runAfter > new Date()) {
      return prisma.job.update({ where: { id: pending.id }, data: { runAfter: new Date() } })
    }
    return pending
  }
  return enqueue('GMAIL_SYNC', { userId }, { userId })
}

/**
 * Enqueue a workspace risk-alert scan, collapsing onto an existing PENDING
 * scan for the user — a scan is a full recomputation, so one pending job
 * covers any number of triggers.
 */
export async function enqueueScanRiskAlerts(userId: string): Promise<Job> {
  const pending = await prisma.job.findFirst({
    where: { type: 'SCAN_RISK_ALERTS', userId, status: 'PENDING' },
  })
  if (pending) return pending
  return enqueue('SCAN_RISK_ALERTS', { userId }, { userId })
}

/**
 * Enqueue an embedding refresh for one conversation, deduped on the
 * conversation id (embedConversation itself is also hash-idempotent, so a
 * duplicate slipping through costs one no-op job, not a wrong result).
 */
export async function enqueueEmbedConversation(userId: string, conversationId: string): Promise<Job> {
  const pending = await prisma.job.findFirst({
    where: {
      type: 'EMBED_CONVERSATION',
      status: 'PENDING',
      payload: { path: ['conversationId'], equals: conversationId },
    },
  })
  if (pending) return pending
  return enqueue('EMBED_CONVERSATION', { conversationId }, { userId })
}

/**
 * Enqueue an auto-draft generation for one conversation, deduped on the
 * conversation id (a pending draft job already covers the latest state; the
 * handler re-checks awaiting + provider, so a stray duplicate is a cheap no-op).
 */
export async function enqueueGenerateDraft(userId: string, conversationId: string): Promise<Job> {
  const pending = await prisma.job.findFirst({
    where: {
      type: 'GENERATE_DRAFT',
      status: 'PENDING',
      payload: { path: ['conversationId'], equals: conversationId },
    },
  })
  if (pending) return pending
  return enqueue('GENERATE_DRAFT', { conversationId }, { userId })
}
