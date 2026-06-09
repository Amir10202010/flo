import { claimNext, completeJob, failJob } from './queue'
import { handleJob } from './handlers'

/**
 * Claim and process a single job. Returns true if a job was processed, false if
 * the queue was empty. Shared by the standalone worker (src/worker.ts) and the
 * cron-driven HTTP drain (/api/jobs/process).
 */
export async function processOne(): Promise<boolean> {
  const job = await claimNext()
  if (!job) return false

  try {
    const result = await handleJob(job)
    await completeJob(job.id, result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[jobs] ${job.type} ${job.id} failed (attempt ${job.attempts}):`, message)
    await failJob(job, message)
  }
  return true
}

/** Drain up to `max` jobs, stopping early when the queue empties. */
export async function drain(max = 25): Promise<number> {
  let processed = 0
  while (processed < max) {
    const did = await processOne()
    if (!did) break
    processed++
  }
  return processed
}
