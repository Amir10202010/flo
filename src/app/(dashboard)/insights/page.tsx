import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CalendarClock, ChartLine, Clock, Lightbulb, Mail, MessagesSquare, Send } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getInsightsFeed } from '@/services/dashboard.service'
import { Reveal } from '@/components/dashboard/Motion'
import StatCard from '@/components/dashboard/StatCard'
import ModulePill from '@/components/dashboard/ModulePill'
import WidgetShell from '@/components/dashboard/WidgetShell'
import { InsightCard } from '@/components/dashboard/SmartInsights'
import DashboardEmpty from '@/components/dashboard/DashboardEmpty'

export const metadata: Metadata = { title: 'Insights — Velnox' }

const TREND_ICONS: Record<string, React.ReactNode> = {
  'response-time': <Clock size={12} />,
  'inbound-volume': <Mail size={12} />,
  'replies-sent': <Send size={12} />,
  'new-threads': <MessagesSquare size={12} />,
}

export default async function InsightsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const data = await getInsightsFeed(user.id)

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Insights
              </h1>
              <ModulePill status="live" />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Plain-language conclusions from your threads, replies and AI analyses.
            </p>
          </div>
        </div>
      </Reveal>

      {!data.hasData ? (
        <DashboardEmpty hasIntegration={data.hasIntegration} />
      ) : (
        <>
          {/* Weekly trends */}
          <div className="kpi-grid" style={{ marginBottom: 14 }}>
            {data.trends.map((t, i) => (
              <StatCard
                key={t.id}
                label={t.label}
                icon={TREND_ICONS[t.id] ?? <ChartLine size={12} />}
                value={t.value}
                sub={t.description}
                trend={{ deltaPct: t.deltaPct, upIsGood: t.upIsGood }}
                delay={i * 0.05}
              />
            ))}
          </div>

          {/* Today's insights */}
          <Reveal delay={0.1}>
            <WidgetShell
              icon={<Lightbulb size={14} />}
              title="Needs your attention"
              sub="Generated from live workspace data — every item links to the source"
              status="live"
            >
              <div className="insight-grid" style={{ padding: '14px 14px 16px' }}>
                {data.today.map((ins) => (
                  <InsightCard key={ins.id} insight={ins} />
                ))}
              </div>
            </WidgetShell>
          </Reveal>

          {/* Weekly digest — honest upcoming module */}
          <Reveal delay={0.18}>
            <div style={{ marginTop: 14 }}>
              <WidgetShell
                icon={<CalendarClock size={14} />}
                title="Weekly digest"
                sub="This report, delivered to your inbox every Monday morning"
                status="soon"
                bodyStyle={{ padding: '16px 18px 18px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                    <li>Response-time and volume trends vs the previous week</li>
                    <li>Clients who went quiet and deals that need a push</li>
                    <li>Your top three recommended actions for the week</li>
                  </ul>
                  <button
                    type="button"
                    disabled
                    className="btn-ghost"
                    style={{ fontSize: 13, opacity: 0.6, cursor: 'default' }}
                    title="Rolling out to Early Access workspaces"
                  >
                    Rolling out to Early Access
                  </button>
                </div>
              </WidgetShell>
            </div>
          </Reveal>
        </>
      )}
    </div>
  )
}
