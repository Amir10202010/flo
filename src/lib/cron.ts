import type { NextRequest } from 'next/server'

/**
 * Authorize a cron / internal trigger request. Accepts either:
 *   - `Authorization: Bearer <CRON_SECRET>`   (Vercel Cron)
 *   - `x-worker-secret: <WORKER_SECRET>`       (manual / external scheduler)
 *
 * If neither secret is configured, only allow outside production (dev convenience).
 */
export function authorizeCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const workerSecret = process.env.WORKER_SECRET

  if (!cronSecret && !workerSecret) return process.env.NODE_ENV !== 'production'

  const auth = req.headers.get('authorization')
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true

  const header = req.headers.get('x-worker-secret')
  if (workerSecret && header === workerSecret) return true

  return false
}
