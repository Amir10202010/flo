import { CalendarClock, ChartLine, Clock, Mail, Users } from 'lucide-react'
import { getAnalyticsData } from '@/services/analytics.service'
import { Reveal } from '@/components/dashboard/Motion'
import WidgetShell from '@/components/dashboard/WidgetShell'
import StatCard from '@/components/dashboard/StatCard'
import EmptyNote from '@/components/dashboard/EmptyNote'
import DashboardEmpty from '@/components/dashboard/DashboardEmpty'
import AreaChart from '@/components/charts/AreaChart'
import WeekBars from '@/components/charts/WeekBars'
import HBars from '@/components/charts/HBars'

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 3, background: color }} />
      {label}
    </span>
  )
}

/**
 * Dashboard "Trends" tab — the slimmed analytics that replaces the old
 * /analytics page: the four metrics that drive decisions (response time,
 * answered %, volume, busiest day) plus volume + response-time trends and team
 * workload. The decorative distributions (priority/risk/sentiment donuts) and
 * the inbound heatmap were intentionally dropped — they were eye-candy, not action.
 */
export default async function TrendsBody({ organizationId }: { organizationId: string }) {
  const data = await getAnalyticsData(organizationId)
  if (!data.hasData) return <DashboardEmpty hasIntegration={data.hasIntegration} />
  const k = data.kpis

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        <StatCard
          label="Avg response time"
          icon={<Clock size={13} />}
          value={k.avgResponse.value}
          sub="Client email → your reply · last 7 days"
          trend={{ deltaPct: k.avgResponse.deltaPct, upIsGood: false }}
          delay={0}
        />
        <StatCard
          label="Threads answered"
          icon={<Mail size={13} />}
          value={k.answered.pct !== null ? `${k.answered.pct}%` : '—'}
          sub={`${k.answered.replied} answered · ${k.answered.waiting} waiting`}
          tone={k.answered.pct !== null && k.answered.pct >= 80 ? 'success' : 'default'}
          delay={0.05}
        />
        <StatCard
          label="Messages · 30d"
          icon={<ChartLine size={13} />}
          value={String(k.volume.total)}
          sub={`${k.volume.inbound} received · ${k.volume.outbound} sent`}
          trend={{ deltaPct: k.volume.deltaPct, upIsGood: null }}
          delay={0.1}
        />
        <StatCard
          label="Busiest day"
          icon={<CalendarClock size={13} />}
          value={k.busiest.day ?? '—'}
          sub={k.busiest.day ? `${k.busiest.count} client emails on ${k.busiest.day}s` : 'Appears with more data'}
          delay={0.15}
        />
      </div>

      {/* Composition: a full-width trend on top, then a balanced two-up row. */}
      <div className="ana-grid">
        <Reveal delay={0.08} className="ana-span2">
          <WidgetShell
            icon={<ChartLine size={14} />}
            title="Email volume"
            sub="Daily messages across all client threads"
            status="live"
            action={
              <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                <LegendChip color="#4F5CF4" label="Received" />
                <LegendChip color="#8B5CF6" label="Sent" />
              </div>
            }
            bodyStyle={{ padding: '18px 20px 16px' }}
          >
            <AreaChart data={data.volumeSeries} height={210} />
          </WidgetShell>
        </Reveal>

        <Reveal delay={0.12}>
          <WidgetShell
            icon={<Clock size={14} />}
            title="Response time trend"
            sub="Average reply time per week — lower is better"
            status="live"
            bodyStyle={{ padding: '18px 20px 16px' }}
          >
            {data.responseWeekly.every((w) => w.hours === null) ? (
              <EmptyNote icon={<Clock size={17} />} title="No reply pairs yet" hint="Send replies to client emails and the trend builds up week by week." />
            ) : (
              <WeekBars items={data.responseWeekly} />
            )}
          </WidgetShell>
        </Reveal>

        <Reveal delay={0.16}>
          <WidgetShell
            icon={<Users size={14} />}
            title="Most active clients"
            sub="By inbound emails · last 30 days"
            status="live"
            bodyStyle={{ padding: '18px 20px' }}
          >
            {data.topContacts.length === 0 ? (
              <EmptyNote icon={<Users size={17} />} title="No client activity yet" />
            ) : (
              <HBars items={data.topContacts.map((c) => ({ label: c.name, value: c.count }))} />
            )}
          </WidgetShell>
        </Reveal>

      </div>

      <p style={{ margin: '18px 4px 0', fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <ChartLine size={12} />
        Metrics are computed from your synced threads and AI analyses — no sampled or estimated data.
      </p>
    </>
  )
}
