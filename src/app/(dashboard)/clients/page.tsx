import type { Metadata } from 'next'
import { Activity, ShieldAlert, UserPlus, Users } from 'lucide-react'
import { requireOrgPage } from '@/lib/org'
import { getClientDirectory, type ClientRow } from '@/services/clients.service'
import type { RelationshipHealth as RelData, RelationshipItem } from '@/services/dashboard.service'
import { Reveal } from '@/components/dashboard/Motion'
import StatCard from '@/components/dashboard/StatCard'
import ModulePill from '@/components/dashboard/ModulePill'
import ClientsTable from '@/components/dashboard/ClientsTable'
import RelationshipHealth from '@/components/dashboard/RelationshipHealth'
import DashboardEmpty from '@/components/dashboard/DashboardEmpty'

export const metadata: Metadata = { title: 'Clients — Velnox' }

/** The 3-bucket Relationship Health read, derived from the directory rows we
 * already load (no extra query) — relocated here from the dashboard. */
function buildRelationships(rows: ClientRow[]): RelData {
  const item = (r: ClientRow, note: string): RelationshipItem => ({
    contactId: r.id,
    name: r.name,
    email: r.email,
    note,
    href: r.href ?? '/clients',
    metric: r.engagement,
  })
  const withThreads = rows.filter((r) => r.threads > 0)
  // rows arrive sorted by engagement desc, so the top slice is the strongest.
  const strongest = withThreads
    .filter((r) => r.risk !== 'HIGH' && r.risk !== 'CRITICAL')
    .slice(0, 4)
    .map((r) => item(r, `${r.threads} thread${r.threads === 1 ? '' : 's'} · active ${r.lastActivityAgo ?? 'recently'}`))
  const weakening = [...withThreads]
    .filter((r) => r.engagement < 45 || r.risk === 'HIGH' || r.risk === 'CRITICAL')
    .sort((a, b) => a.engagement - b.engagement)
    .slice(0, 4)
    .map((r) =>
      item(r, r.risk === 'HIGH' || r.risk === 'CRITICAL' ? 'flagged at risk · reach out' : `cooling off · last seen ${r.lastActivityAgo ?? 'a while ago'}`),
    )
  const opportunities = rows
    .filter((r) => r.isNew)
    .slice(0, 4)
    .map((r) => item(r, r.sentiment === 'POSITIVE' ? 'new contact · positive tone' : 'new contact · worth a hello'))
  return { strongest, weakening, opportunities }
}

export default async function ClientsPage() {
  const ctx = await requireOrgPage()

  const data = await getClientDirectory(ctx.organization.id)

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Clients
              </h1>
              <ModulePill status="live" />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Every contact in your workspace, scored by real engagement and AI risk.
            </p>
          </div>
        </div>
      </Reveal>

      {!data.hasData ? (
        <DashboardEmpty hasIntegration={data.hasIntegration} />
      ) : (
        <>
          <div className="kpi-grid" style={{ marginBottom: 14 }}>
            <StatCard label="Total clients" icon={<Users size={12} />} value={String(data.totals.clients)} sub="Across connected channels" delay={0} />
            <StatCard
              label="Active this week"
              icon={<Activity size={12} />}
              value={String(data.totals.activeWeek)}
              sub="Contacts with message activity in 7 days"
              delay={0.05}
            />
            <StatCard
              label="At risk"
              icon={<ShieldAlert size={12} />}
              value={String(data.totals.atRisk)}
              sub="High or critical AI risk level"
              tone={data.totals.atRisk > 0 ? 'critical' : 'success'}
              delay={0.1}
            />
            <StatCard
              label="New this month"
              icon={<UserPlus size={12} />}
              value={String(data.totals.newThisMonth)}
              sub="First seen in the last 30 days"
              delay={0.15}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <Reveal delay={0.1}>
              <RelationshipHealth data={buildRelationships(data.rows)} />
            </Reveal>
          </div>

          <Reveal delay={0.16}>
            <ClientsTable rows={data.rows} />
          </Reveal>
        </>
      )}
    </div>
  )
}
