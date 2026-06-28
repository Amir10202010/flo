/**
 * One-off backfill: re-run the (improved) rule classifier over already-synced
 * Gmail threads so inbox categories reflect the new heuristics.
 *
 * It RE-FETCHES each thread from Gmail (`reclassifyGmailCategories`) so the full
 * signal set — Gmail label ids + the `List-Unsubscribe` header — is available.
 * Those headers are NOT persisted per thread, so a DB-only re-run can't see them
 * and would wrongly demote newsletters/promos to Primary. Re-fetching keeps the
 * bulk buckets correct while still applying the tightened CLIENTS heuristics.
 *
 * Only `rules`/legacy rows are touched — manual moves and AI-refined buckets are
 * preserved. Idempotent: safe to re-run.
 *
 * Run:
 *   npx tsx --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/reclassify-categories.ts
 *   (or: npm run reclassify:categories)
 */
import { prisma } from '@/lib/prisma'
import { reclassifyGmailCategories } from '@/services/gmail.service'

async function main() {
  const integrations = await prisma.integration.findMany({
    where: { type: 'GMAIL', isActive: true },
    select: { userId: true, email: true },
  })
  if (!integrations.length) {
    console.log('No active Gmail integrations — nothing to reclassify.')
    return
  }
  console.log(`Reclassifying ${integrations.length} Gmail mailbox(es) (re-fetching from Gmail)…`)

  let totalChanged = 0
  const allMoves: Record<string, number> = {}

  for (const integ of integrations) {
    const label = integ.email ?? integ.userId
    const res = await reclassifyGmailCategories(integ.userId, (scanned, total, changed) => {
      console.log(`  [${label}] …${scanned}/${total} (re-categorised ${changed})`)
    })
    totalChanged += res.changed
    for (const [k, n] of Object.entries(res.moves)) allMoves[k] = (allMoves[k] ?? 0) + n
    if (res.errors.length) {
      console.log(`  [${label}] ${res.errors.length} error(s); first: ${res.errors[0]}`)
    }
    console.log(`  [${label}] scanned ${res.scanned}, changed ${res.changed}.`)
  }

  console.log(`\nDone. total category changes: ${totalChanged}.`)
  if (Object.keys(allMoves).length) {
    console.log('Moves:')
    for (const [k, n] of Object.entries(allMoves).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${n}`)
    }
  }
}

main()
  .catch((e) => {
    console.error('RECLASSIFY FAILED:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
