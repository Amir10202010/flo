import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import {
  CalendarClock,
  ChartColumn,
  ChartLine,
  ChartPie,
  Clock,
  Flame,
  HeartPulse,
  Mail,
  Radar,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getAnalyticsData } from '@/services/analytics.service'
import { Reveal } from '@/components/dashboard/Motion'
import WidgetShell from '@/components/dashboard/WidgetShell'
import StatCard from '@/components/dashboard/StatCard'
import EmptyNote from '@/components/dashboard/EmptyNote'
import DashboardEmpty from '@/components/dashboard/DashboardEmpty'
import ModulePill from '@/components/dashboard/ModulePill'
import AreaChart from '@/components/charts/AreaChart'
import WeekBars from '@/components/charts/WeekBars'
import Donut from '@/components/charts/Donut'
import HBars from '@/components/charts/HBars'
import Heatmap from '@/components/charts/Heatmap'

export const metadata: Metadata = { title: 'Analytics — Velnox' }

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 3, background: color }} />
      {label}
    </span>
  )
}

export default async function AnalyticsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const data = await getAnalyticsData(user.id)
  const k = data.kpis

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Analytics
              </h1>
              <ModulePill status="live" />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Communication performance across your workspace · {data.rangeLabel}
            </p>
          </div>
        </div>
      </Reveal>

      {!data.hasData ? (
        <DashboardEmpty hasIntegration={data.hasIntegration} />
      ) : (
        <>
          {/* KPIs */}
          <div className="kpi-grid" style={{ marginBottom: 14 }}>
            <StatCard
              label="Avg response time"
              icon={<Clock size={12} />}
              value={k.avgResponse.value}
              sub="Client email → your reply · last 7 days"
              trend={{ deltaPct: k.avgResponse.deltaPct, upIsGood: false }}
              delay={0}
            />
            <StatCard
              label="Threads answered"
              icon={<Mail size={12} />}
              value={k.answered.pct !== null ? `${k.answered.pct}%` : '—'}
              sub={`${k.answered.replied} answered · ${k.answered.waiting} still waiting`}
              tone={k.answered.pct !== null && k.answered.pct >= 80 ? 'success' : 'default'}
              delay={0.05}
            />
            <StatCard
              label="Messages · 30d"
              icon={<ChartLine size={12} />}
              value={String(k.volume.total)}
              sub={`${k.volume.inbound} received · ${k.volume.outbound} sent`}
              trend={{ deltaPct: k.volume.deltaPct, upIsGood: null }}
              delay={0.1}
            />
            <StatCard
              label="Busiest day"
              icon={<CalendarClock size={12} />}
              value={k.busiest.day ?? '—'}
              sub={k.busiest.day ? `${k.busiest.count} client emails on ${k.busiest.day}s` : 'Appears with more data'}
              delay={0.15}
            />
          </div>

          <div className="ana-grid">
            {/* Volume */}
            <Reveal delay={0.08} className="ana-span2">
              <WidgetShell
                icon={<ChartLine size={14} />}
                title="Email volume"
                sub="Daily messages across all client threads"
                status="live"
                action={
                  <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                    <LegendChip color="#4F5CF4" label="Received" />
                    <LegendChip color="#8B5CF6" label="Sent" />
                  </div>
                }
                bodyStyle={{ padding: '18px 18px 14px' }}
              >
                <AreaChart data={data.volumeSeries} height={210} />
              </WidgetShell>
            </Reveal>

            {/* Response time trend */}
            <Reveal delay={0.12}>
              <WidgetShell
                icon={<Clock size={14} />}
                title="Response time trend"
                sub="Average reply time per week — lower is better"
                status="live"
                bodyStyle={{ padding: '20px 22px 16px' }}
              >
                {data.responseWeekly.every((w) => w.hours === null) ? (
                  <EmptyNote icon={<Clock size={17} />} title="No reply pairs yet" hint="Send replies to client emails and the trend builds up week by week." />
                ) : (
                  <WeekBars items={data.responseWeekly} />
                )}
              </WidgetShell>
            </Reveal>

            {/* Priority distribution */}
            <Reveal delay={0.16}>
              <WidgetShell
                icon={<Flame size={14} />}
                title="Priority distribution"
                sub="Where active conversations stand right now"
                status="live"
                bodyStyle={{ padding: '20px 22px' }}
              >
                {data.priorityDist.length === 0 ? (
                  <EmptyNote icon={<ChartPie size={17} />} title="No active conversations" />
                ) : (
                  <Donut segments={data.priorityDist} centerLabel="threads" />
                )}
              </WidgetShell>
            </Reveal>

            {/* Risk distribution */}
            <Reveal delay={0.2}>
              <WidgetShell
                icon={<ShieldAlert size={14} />}
                title="Risk distribution"
                sub="AI churn-risk levels across analyzed threads"
                status="live"
                bodyStyle={{ padding: '20px 22px' }}
              >
                {data.riskDist.length === 0 ? (
                  <EmptyNote
                    icon={<ShieldAlert size={17} />}
                    title="No AI analyses yet"
                    hint="Open a thread and run analysis — risk levels appear here."
                  />
                ) : (
                  <HBars items={data.riskDist} />
                )}
              </WidgetShell>
            </Reveal>

            {/* Sentiment */}
            <Reveal delay={0.24}>
              <WidgetShell
                icon={<HeartPulse size={14} />}
                title="Sentiment"
                sub="Tone of analyzed conversations"
                status="live"
                bodyStyle={{ padding: '20px 22px' }}
              >
                {data.sentimentDist.length === 0 ? (
                  <EmptyNote icon={<HeartPulse size={17} />} title="No AI analyses yet" hint="Sentiment is read from each thread's AI analysis." />
                ) : (
                  <Donut segments={data.sentimentDist} centerLabel="analyzed" />
                )}
              </WidgetShell>
            </Reveal>

            {/* Heatmap */}
            <Reveal delay={0.28}>
              <WidgetShell
                icon={<Radar size={14} />}
                title="When clients email you"
                sub="Inbound activity by weekday and time of day"
                status="live"
                bodyStyle={{ padding: '18px 20px' }}
              >
                {data.heatmap.max === 0 ? (
                  <EmptyNote icon={<Radar size={17} />} title="No inbound email yet" hint="The activity map fills in as client emails arrive." />
                ) : (
                  <Heatmap data={data.heatmap} />
                )}
              </WidgetShell>
            </Reveal>

            {/* Top contacts */}
            <Reveal delay={0.32}>
              <WidgetShell
                icon={<Users size={14} />}
                title="Most active clients"
                sub="By inbound emails · last 30 days"
                status="live"
                bodyStyle={{ padding: '20px 22px' }}
              >
                {data.topContacts.length === 0 ? (
                  <EmptyNote icon={<Users size={17} />} title="No client activity yet" />
                ) : (
                  <HBars items={data.topContacts.map((c) => ({ label: c.name, value: c.count }))} />
                )}
              </WidgetShell>
            </Reveal>

            {/* Spacer card to balance the grid when needed is unnecessary — grid auto-flows. */}
          </div>

          <p style={{ margin: '18px 4px 0', fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ChartColumn size={12} />
            Metrics are computed from your synced threads and AI analyses — no sampled or estimated data.
          </p>
        </>
      )}
    </div>
  )
}
