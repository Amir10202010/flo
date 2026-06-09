import { NextRequest, NextResponse } from 'next/server'
import { drain } from '@/services/jobs/runner'
import { authorizeCron } from '@/lib/cron'

// This endpoint must not be statically optimized — it has side effects.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron-driven queue drain. Intended to be called by Vercel Cron (configured in
 * vercel.json) every minute, or by any scheduler. Protected by a shared secret
 * (CRON_SECRET / WORKER_SECRET) — see authorizeCron.
 */
async function handle(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const processed = await drain(25)
  return NextResponse.json({ processed })
}

// Vercel Cron issues GET requests; allow POST too for manual triggering.
export async function GET(req: NextRequest) {
  return handle(req)
}
export async function POST(req: NextRequest) {
  return handle(req)
}
