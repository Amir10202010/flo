import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Flame, Inbox, Mail, MessagesSquare, ShieldAlert, Target } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getDashboardData, type DashboardData } from '@/services/dashboard.service'
import { longDate } from '@/lib/time'
import { Reveal } from '@/components/dashboard/Motion'
import StatCard from '@/components/dashboard/StatCard'
import HealthScoreCard from '@/components/dashboard/HealthRing'
import CommandCenter from '@/components/dashboard/CommandCenter'
import RiskMonitor from '@/components/dashboard/RiskMonitor'
import SmartInsights from '@/components/dashboard/SmartInsights'
import ActivityTimeline from '@/components/dashboard/ActivityTimeline'
import RelationshipHealth from '@/components/dashboard/RelationshipHealth'
import DashboardEmpty from '@/components/dashboard/DashboardEmpty'
import MetricsUnavailable from '@/components/dashboard/MetricsUnavailable'
import { DashboardBodySkeleton } from '@/components/dashboard/Skeletons'

export const metadata: Metadata = { title: 'Dashboard — Velnox' }

function SyncChip({ connected, lastSyncAgo }: { connected: boolean; lastSyncAgo: string | null }) {
  if (!connected) {
    return (
      <Link
        href="/integrations"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--attention)',
          background: 'var(--attention-dim)',
          border: '1px solid var(--attention-border)',
          borderRadius: 100,
          padding: '6px 13px',
          textDecoration: 'none',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--attention)' }} />
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
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--success)',
        background: 'var(--success-dim)',
        border: '1px solid var(--success-border)',
        borderRadius: 100,
        padding: '6px 13px',
        whiteSpace: 'nowrap',
      }}
    >
      <span className="animate-pulse-s" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
      {lastSyncAgo ? `Synced ${lastSyncAgo}` : 'First sync queued'}
    </span>
  )
}

/**
 * Data section, streamed inside <Suspense> so the page header paints
 * immediately. A metrics/DB failure degrades to <MetricsUnavailable>
 * instead of crashing the whole route.
 */
async function DashboardBody({ userId }: { userId: string }) {
  let data: DashboardData
  try {
    data = await getDashboardData(userId)
  } catch (err) {
    console.error('[dashboard] failed to load metrics:', err)
    return <MetricsUnavailable />
  }

  if (!data.hasData) {
    return <DashboardEmpty hasIntegration={data.hasIntegration} />
  }

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

      {/* Executive overview */}
      <div className="exec-grid" style={{ marginBottom: 14 }}>
        <HealthScoreCard score={s.health.score} topFactor={s.health.topFactor} delay={0} />
        <StatCard
          label="Conversations"
          icon={<MessagesSquare size={12} />}
          value={String(s.conversations.value)}
          sub={`${s.conversations.activeThisWeek} active this week`}
          trend={{ deltaPct: s.conversations.trend.deltaPct, upIsGood: s.conversations.trend.upIsGood }}
          spark={s.conversations.spark}
          delay={0.04}
        />
        <StatCard
          label="High Priority"
          icon={<Flame size={12} />}
          value={String(s.highPriority.value)}
          sub={`${s.highPriority.hot} hot · ${s.highPriority.attention} attention`}
          tone={s.highPriority.hot > 0 ? 'critical' : s.highPriority.value > 0 ? 'warning' : 'default'}
          delay={0.08}
        />
        <StatCard
          label="Unanswered"
          icon={<Mail size={12} />}
          value={String(s.unanswered.value)}
          sub={
            s.unanswered.value === 0
              ? 'Inbox zero on replies'
              : s.unanswered.oldestWait
                ? `${s.unanswered.overdue24h} overdue · oldest ${s.unanswered.oldestWait}`
                : `${s.unanswered.overdue24h} overdue 24h+`
          }
          tone={s.unanswered.overdue24h > 0 ? 'warning' : 'default'}
          delay={0.12}
        />
        <StatCard
          label="Clients at Risk"
          icon={<ShieldAlert size={12} />}
          value={String(s.clientsAtRisk.value)}
          sub={`of ${s.clientsAtRisk.totalClients} tracked clients`}
          tone={s.clientsAtRisk.value > 0 ? 'critical' : 'success'}
          delay={0.16}
        />
        <StatCard
          label="Follow-ups"
          icon={<Target size={12} />}
          value={String(s.followUps.value)}
          sub={`${s.followUps.fromAi} AI next-steps · ${s.followUps.goneQuiet} gone quiet`}
          delay={0.2}
        />
      </div>

      {/* Command center + right rail */}
      <div className="dash-main-grid" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <Reveal delay={0.1}>
            <CommandCenter hero={data.nextBestAction} items={data.commandCenter} />
          </Reveal>
          <Reveal delay={0.18}>
            <RiskMonitor items={data.riskClients} />
          </Reveal>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <Reveal delay={0.14}>
            <SmartInsights insights={data.insights} />
          </Reveal>
          <Reveal delay={0.22}>
            <ActivityTimeline events={data.timeline} />
          </Reveal>
        </div>
      </div>

      {/* Relationship health */}
      <Reveal delay={0.26}>
        <RelationshipHealth data={data.relationships} />
      </Reveal>
    </>
  )
}

export default async function DashboardPage() {
  // Header data comes from middleware-forwarded headers (no DB round-trip),
  // so the shell renders instantly while DashboardBody streams in.
  const user = await getCurrentUser()
  if (!user) redirect('/login')

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
            <h1 style={{ margin: '0 0 5px', fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
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

      <Suspense fallback={<DashboardBodySkeleton />}>
        <DashboardBody userId={user.id} />
      </Suspense>
    </div>
  )
}
