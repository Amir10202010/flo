/**
 * Idempotent backfill: build the knowledge graph from already-synced
 * conversations, so /graph isn't empty for existing users before their next
 * Gmail sync (which would extract incrementally via the EXTRACT_GRAPH_ENTITIES
 * job). Safe to re-run — extractGraphEntities upserts and bumps `weight` rather
 * than duplicating rows.
 *
 * The deterministic company step always runs; AI topic extraction runs only
 * when a text provider is configured (GEMINI_API_KEY). Transient rate-limit
 * errors degrade to "no topics this round" (fallbackOnRetryable) instead of
 * aborting, and AI-backed runs are lightly throttled to respect the free tier.
 *
 * Run:
 *   npx tsx --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/backfill-graph.ts
 *   (or: npm run backfill:graph)
 */
import { prisma } from '@/lib/prisma'
import { extractGraphEntities } from '@/services/knowledge.extract'
import { getTextProvider } from '@/services/ai'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const hasAi = Boolean(getTextProvider())
  const conversations = await prisma.conversation.findMany({
    select: { id: true },
    orderBy: { lastMessageAt: 'desc' },
  })

  console.log(
    `Backfilling knowledge graph over ${conversations.length} conversation(s) — ${
      hasAi ? 'company + AI topics' : 'company edges only (no AI provider)'
    } …`,
  )

  let processed = 0
  let companies = 0
  let topics = 0
  let skippedAi = 0
  let failed = 0

  for (const { id } of conversations) {
    try {
      // fallbackOnRetryable: a free-tier 429 shouldn't abort the whole backfill —
      // store the deterministic company edge and skip topics for this one.
      const res = await extractGraphEntities(id, { fallbackOnRetryable: true })
      if (res.company) companies++
      topics += res.topics
      if (res.skipped === 'no-ai-provider') skippedAi++
    } catch (e) {
      failed++
      console.warn(`  ! ${id}: ${e instanceof Error ? e.message : String(e)}`)
    }
    processed++
    if (processed % 25 === 0) {
      console.log(`  … ${processed}/${conversations.length} (companies ${companies}, topics ${topics})`)
    }
    // Light throttle so the free-tier embedding/generation quota isn't hammered.
    if (hasAi) await sleep(350)
  }

  console.log(
    `Done. processed: ${processed}, company edges: ${companies}, topics stored: ${topics}, ai-skipped: ${skippedAi}, failed: ${failed}.`,
  )
}

main()
  .catch((e) => {
    console.error('BACKFILL FAILED:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
