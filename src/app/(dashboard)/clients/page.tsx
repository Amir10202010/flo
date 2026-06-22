import type { Metadata } from 'next'
import { Activity, ShieldAlert, UserPlus, Users } from 'lucide-react'
import { requireOrgPage } from '@/lib/org'
import { getClientDirectory } from '@/services/clients.service'
import { Reveal } from '@/components/dashboard/Motion'
import StatCard from '@/components/dashboard/StatCard'
import ModulePill from '@/components/dashboard/ModulePill'
import ClientsTable from '@/components/dashboard/ClientsTable'
import DashboardEmpty from '@/components/dashboard/DashboardEmpty'

export const metadata: Metadata = { title: 'Clients — Velnox' }

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

          <Reveal delay={0.12}>
            <ClientsTable rows={data.rows} />
          </Reveal>
        </>
      )}
    </div>
  )
}
