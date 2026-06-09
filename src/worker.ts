/**
 * Standalone sync/ingestion worker.
 *
 * Long-running process for always-on hosts (Railway / Render / Fly). It polls
 * the Postgres job queue and processes jobs until interrupted. On Vercel, prefer
 * the cron-driven drain at /api/jobs/process instead of running this.
 *
 * Run with:  npm run worker
 */
import { processOne } from '@/services/jobs/runner'
import { prisma } from '@/lib/prisma'

const IDLE_DELAY_MS = 2_000

let stopping = false

async function loop() {
  console.log('[worker] started — polling job queue')
  while (!stopping) {
    let processedSomething = false
    try {
      processedSomething = await processOne()
    } catch (e) {
      console.error('[worker] unexpected error:', e)
    }
    // Back off only when idle; drain bursts as fast as possible.
    if (!processedSomething) {
      await new Promise((r) => setTimeout(r, IDLE_DELAY_MS))
    }
  }
  await prisma.$disconnect()
  console.log('[worker] stopped')
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`[worker] received ${sig}, shutting down…`)
    stopping = true
  })
}

loop().catch((e) => {
  console.error('[worker] fatal:', e)
  process.exit(1)
})
