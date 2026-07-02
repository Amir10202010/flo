import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Flame, Inbox, Mail, ShieldAlert } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import { getDashboardData, type DashboardData } from '@/services/dashboard.service'
import { getWorkspaceSchema } from '@/services/workspace/workspace.service'
import { resolveTerm } from '@/lib/workspace/terminology'
import IndustryPulse from '@/components/workspace/IndustryPulse'
import { longDate } from '@/lib/time'
import { Reveal } from '@/components/dashboard/Motion'
import StatCard from '@/components/dashboard/StatCard'
import CommandCenter from '@/components/dashboard/CommandCenter'
import SmartInsights from '@/components/dashboard/SmartInsights'
import RemindersCard from '@/components/dashboard/RemindersCard'
import DashboardEmpty from '@/components/dashboard/DashboardEmpty'
import MetricsUnavailable from '@/components/dashboard/MetricsUnavailable'
import { DashboardBodySkeleton } from '@/components/dashboard/Skeletons'
import TrendsBody from './TrendsBody'

export const metadata: Metadata = { title: 'Dashboard — Velnox' }

function SyncChip({ connected, lastSyncAgo }: { connected: boolean; lastSyncAgo: string | null }) {
  if (!connected) {
    return (
      <Link
        href="/settings?tab=connections"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--attention)',
          textDecoration: 'none',
        }}
      >
        <Mail size={13} />
        Connect Gmail
      </Link>
    )
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 12.5,
        fontWeight: 500,
        color: 'var(--text-muted)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
      {lastSyncAgo ? `Synced ${lastSyncAgo}` : 'First sync queued'}
    </span>
  )
}

/**
 * Data section, streamed inside <Suspense> so the page header paints
 * immediately. A metrics/DB failure degrades to <MetricsUnavailable>
 * instead of crashing the whole route.
 */
async function DashboardBody({ organizationId }: { organizationId: string }) {
  let data: DashboardData
  try {
    data = await getDashboardData(organizationId)
  } catch (err) {
    console.error('[dashboard] failed to load metrics:', err)
    return <MetricsUnavailable />
  }

  if (!data.hasData) {
    return <DashboardEmpty hasIntegration={data.hasIntegration} />
  }

  // Adaptive layer: industry widgets + the org's own terminology. Sequential
  // after the metrics fetch (small pool); a failure only hides the strip.
  const schema = await getWorkspaceSchema(organizationId).catch(() => null)
  const contactTerm = resolveTerm(schema?.terminology, 'contact')

  const s = data.stats

  return (
    <>
      {/* Workspace status row */}
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <SyncChip connected={data.hasIntegration} lastSyncAgo={data.lastSyncAgo} />
          {data.integrationEmail && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data.integrationEmail}</span>
          )}
        </div>
      </Reveal>

      {/* Triage KPIs — three numbers that matter, each a button into the filtered inbox */}
      <div className="dash-kpi3" style={{ marginBottom: 14 }}>
        <StatCard
          label="Unanswered"
          icon={<Mail size={13} />}
          value={String(s.unanswered.value)}
          sub={
            s.unanswered.value === 0
              ? 'Inbox zero on replies'
              : s.unanswered.oldestWait
                ? `${s.unanswered.overdue24h} overdue · oldest ${s.unanswered.oldestWait}`
                : `${s.unanswered.overdue24h} overdue 24h+`
          }
          tone={s.unanswered.overdue24h > 0 ? 'warning' : 'default'}
          href="/inbox?f=AWAITING"
          delay={0}
        />
        <StatCard
          label={`${contactTerm.plural} at risk`}
          icon={<ShieldAlert size={13} />}
          value={String(s.clientsAtRisk.value)}
          sub={`of ${s.clientsAtRisk.totalClients} tracked ${contactTerm.plural.toLowerCase()}`}
          tone={s.clientsAtRisk.value > 0 ? 'critical' : 'success'}
          href="/inbox?risk=HIGH"
          delay={0.05}
        />
        <StatCard
          label="Urgent"
          icon={<Flame size={13} />}
          value={String(s.highPriority.hot)}
          sub={
            s.highPriority.attention > 0
              ? `${s.highPriority.attention} more high priority`
              : 'Top-priority threads'
          }
          tone={s.highPriority.hot > 0 ? 'critical' : 'default'}
          href="/inbox?f=HOT"
          delay={0.1}
        />
      </div>

      {/* Industry pulse — the workspace's own objects, from its schema */}
      {schema && schema.dashboard.length > 0 && (
        <Reveal delay={0.11}>
          <div style={{ marginBottom: 14 }}>
            <IndustryPulse schema={schema} organizationId={organizationId} />
          </div>
        </Reveal>
      )}

      {/* The act-now queue takes the floor; awareness widgets sit in the rail */}
      <div className="dash-main-grid">
        <div style={{ minWidth: 0 }}>
          <Reveal delay={0.12}>
            <CommandCenter hero={data.nextBestAction} items={data.commandCenter} />
          </Reveal>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <Reveal delay={0.16}>
            <SmartInsights insights={data.insights} />
          </Reveal>
          <RemindersCard />
        </div>
      </div>
    </>
  )
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  // Header data comes from middleware-forwarded headers (no DB round-trip),
  // so the shell renders instantly while the body streams in.
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const ctx = await getOrgContext()
  if (!ctx) redirect('/onboarding')

  // URL-driven tabs so each tab fetches only its own read-model (the connection
  // pool is small — see CLAUDE.md — so we never load both Today + Trends at once).
  const tab = (await searchParams).tab === 'trends' ? 'trends' : 'today'

  const firstName =
    (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    (user.user_metadata?.name as string | undefined)?.split(' ')[0] ??
    null

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      {/* Header — static, never blocked by metrics */}
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title" style={{ margin: '0 0 5px' }}>
              {firstName ? `Good to see you, ${firstName}` : 'Your workspace'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{longDate(new Date())}</p>
          </div>
          <Link href="/inbox" className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>
            <Inbox size={14} />
            Open Inbox
          </Link>
        </div>
      </Reveal>

      <div className="dash-tabs">
        <Link href="/dashboard" className="dash-tab" data-active={tab === 'today'}>Today</Link>
        <Link href="/dashboard?tab=trends" className="dash-tab" data-active={tab === 'trends'}>Trends</Link>
      </div>

      <Suspense fallback={<DashboardBodySkeleton />}>
        {tab === 'trends' ? (
          <TrendsBody organizationId={ctx.organization.id} />
        ) : (
          <DashboardBody organizationId={ctx.organization.id} />
        )}
      </Suspense>
    </div>
  )
}
