import { NextRequest, NextResponse } from 'next/server'
import { drainFor } from '@/services/jobs/runner'
import { authorizeCron } from '@/lib/cron'

// This endpoint must not be statically optimized — it has side effects.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron-driven queue drain. Intended to be called by any scheduler — the daily
 * Vercel Cron backstop (vercel.json) or an external per-minute cron (e.g.
 * cron-job.org) hitting it with `x-worker-secret`. Protected by a shared secret
 * (CRON_SECRET / WORKER_SECRET) — see authorizeCron. Drains as much of the
 * backlog as fits in the invocation budget so a single tick clears more than a
 * fixed batch.
 */
async function handle(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const processed = await drainFor(50_000)
  return NextResponse.json({ processed })
}

// Vercel Cron issues GET requests; allow POST too for manual triggering.
export async function GET(req: NextRequest) {
  return handle(req)
}
export async function POST(req: NextRequest) {
  return handle(req)
}
