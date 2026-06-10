/**
 * One-off smoke test for the metrics read-models against the live database.
 * Simulates three dashboard pages rendering concurrently (the scenario that
 * used to exhaust the connection pool with P2024).
 *
 * Run:  npx tsx --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/smoke-dashboard.ts
 */
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/services/dashboard.service'
import { getAnalyticsData } from '@/services/analytics.service'
import { getClientDirectory } from '@/services/clients.service'

async function main() {
  const user = await prisma.user.findFirst({ select: { id: true, email: true } })
  if (!user) {
    console.log('No users in DB — nothing to smoke test.')
    return
  }
  console.log(`Testing as ${user.email} …`)

  const t0 = Date.now()
  const [dash, ana, clients] = await Promise.all([
    getDashboardData(user.id),
    getAnalyticsData(user.id),
    getClientDirectory(user.id),
  ])
  const ms = Date.now() - t0

  console.log(
    `OK in ${ms}ms — conversations=${dash.stats.conversations.value}, health=${dash.stats.health.score}, ` +
      `insights=${dash.insights.length}, timeline=${dash.timeline.length}, ` +
      `volume30d=${ana.kpis.volume.total}, clients=${clients.totals.clients}`,
  )
}

main()
  .catch((e) => {
    console.error('SMOKE FAILED:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
