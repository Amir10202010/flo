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
  /** Collapse key — see Job.dedupeKey + the partial unique index. */
  dedupeKey?: string
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
      dedupeKey: opts.dedupeKey ?? null,
    },
  })
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

/**
 * Enqueue a job that collapses onto any existing PENDING job with the same
 * `dedupeKey`. Race-free: the partial unique index (WHERE status = 'PENDING')
 * means a concurrent enqueue loses the INSERT with P2002, which we catch and
 * resolve to the winner — so a webhook/push burst can't pile up duplicates.
 */
export async function enqueueDeduped(
  type: JobType,
  payload: Record<string, unknown>,
  dedupeKey: string,
  opts: EnqueueOptions = {},
): Promise<Job> {
  const existing = await prisma.job.findFirst({ where: { dedupeKey, status: 'PENDING' } })
  if (existing) return existing
  try {
    return await enqueue(type, payload, { ...opts, dedupeKey })
  } catch (e) {
    if (isUniqueViolation(e)) {
      const winner = await prisma.job.findFirst({ where: { dedupeKey, status: 'PENDING' } })
      if (winner) return winner
    }
    throw e
  }
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

/**
 * Bulk-enqueue jobs of one type in a single round trip. When `dedupeKeyFor` is
 * given, rows carry a dedupeKey and `skipDuplicates` collapses them against any
 * existing PENDING job with the same key (via the partial unique index) — so a
 * re-run can't double-queue analysis/embeds for the same conversation.
 */
export async function enqueueMany(
  type: JobType,
  payloads: Record<string, unknown>[],
  opts: EnqueueOptions = {},
  dedupeKeyFor?: (payload: Record<string, unknown>) => string,
): Promise<number> {
  if (!payloads.length) return 0
  const res = await prisma.job.createMany({
    data: payloads.map((payload) => ({
      type,
      payload: payload as Prisma.InputJsonValue,
      userId: opts.userId ?? null,
      runAfter: opts.runAfter ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 3,
      dedupeKey: dedupeKeyFor?.(payload) ?? null,
    })),
    skipDuplicates: true,
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
  const dedupeKey = `GMAIL_SYNC:${userId}`
  const pending = await prisma.job.findFirst({ where: { dedupeKey, status: 'PENDING' } })
  if (pending) {
    // Pull a future-scheduled backoff retry forward: an explicit trigger
    // (connect, manual sync, push) should run now, not after the remaining
    // backoff, or the UI polls a job that isn't even eligible yet.
    if (pending.runAfter > new Date()) {
      return prisma.job.update({ where: { id: pending.id }, data: { runAfter: new Date() } })
    }
    return pending
  }
  return enqueueDeduped('GMAIL_SYNC', { userId }, dedupeKey, { userId })
}

/**
 * Enqueue a workspace risk-alert scan, collapsing onto an existing PENDING
 * scan for the user — a scan is a full recomputation, so one pending job
 * covers any number of triggers.
 */
export async function enqueueScanRiskAlerts(organizationId: string): Promise<Job> {
  return enqueueDeduped('SCAN_RISK_ALERTS', { organizationId }, `SCAN_RISK_ALERTS:${organizationId}`)
}

/**
 * Enqueue an urgent-alert notification pass for the user, collapsing onto an
 * existing PENDING job — notifyNewAlerts recomputes the full set, so one
 * pending job covers any number of scans that finished close together.
 */
export async function enqueueNotifyAlerts(organizationId: string): Promise<Job> {
  return enqueueDeduped('NOTIFY_ALERTS', { organizationId }, `NOTIFY_ALERTS:${organizationId}`)
}

/**
 * Enqueue the per-user daily maintenance pass (safety sync, alert scan, embed
 * + draft backfill, watch renewal, weekly digest). The cron enqueues one of
 * these per integration instead of doing the work inline, so a single cron tick
 * stays O(1) regardless of how many mailboxes exist.
 */
export async function enqueueGmailMaintenance(userId: string): Promise<Job> {
  return enqueueDeduped('GMAIL_MAINTENANCE', { userId }, `GMAIL_MAINTENANCE:${userId}`, { userId })
}

/**
 * Bulk-enqueue GMAIL_MAINTENANCE for many users in ONE round trip. The daily
 * cron uses this so a single tick stays cheap regardless of mailbox count;
 * `skipDuplicates` + the partial unique index collapse against existing PENDING
 * maintenance jobs, so overlapping cron runs never pile up.
 */
export async function enqueueMaintenanceForUsers(userIds: string[]): Promise<number> {
  if (!userIds.length) return 0
  const res = await prisma.job.createMany({
    data: userIds.map((userId) => ({
      type: 'GMAIL_MAINTENANCE' as JobType,
      payload: { userId } as Prisma.InputJsonValue,
      userId,
      dedupeKey: `GMAIL_MAINTENANCE:${userId}`,
    })),
    skipDuplicates: true,
  })
  return res.count
}

/**
 * Enqueue an embedding refresh for one conversation, deduped on the
 * conversation id (embedConversation itself is also hash-idempotent, so a
 * duplicate slipping through costs one no-op job, not a wrong result).
 */
export async function enqueueEmbedConversation(conversationId: string): Promise<Job> {
  return enqueueDeduped('EMBED_CONVERSATION', { conversationId }, `EMBED_CONVERSATION:${conversationId}`)
}

/**
 * Enqueue an auto-draft generation for one conversation, deduped on the
 * conversation id (a pending draft job already covers the latest state; the
 * handler re-checks awaiting + provider, so a stray duplicate is a cheap no-op).
 */
export async function enqueueGenerateDraft(conversationId: string): Promise<Job> {
  return enqueueDeduped('GENERATE_DRAFT', { conversationId }, `GENERATE_DRAFT:${conversationId}`)
}
