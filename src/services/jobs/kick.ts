import { after } from 'next/server'
import { drainFor } from './runner'

/**
 * Fire-and-forget queue drain that runs AFTER the HTTP response is sent, via
 * Next.js `after()` (backed by Vercel background execution). It lets a freshly
 * enqueued job start processing immediately — without waiting for the next
 * external cron tick — so the first Gmail sync feels instant instead of hanging
 * until /api/jobs/process is called.
 *
 * Work runs inside the same invocation and is bounded by the route's
 * `maxDuration`, so keep `budgetMs` under it. Anything not finished within the
 * budget is mopped up by the cron-driven /api/jobs/process drain. Concurrent
 * drains are safe: claimNext() uses SELECT … FOR UPDATE SKIP LOCKED, so the
 * kick and the cron never process the same job twice.
 *
 * Must be called from within a request scope (a Route Handler), since `after()`
 * registers the callback against the current request.
 */
export function kickJobQueue(budgetMs = 50_000): void {
  after(async () => {
    try {
      await drainFor(budgetMs)
    } catch (e) {
      console.error('[jobs] kickJobQueue drain failed:', e)
    }
  })
}
