import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  ChevronRight,
  CircleX,
  Clock,
  Eye,
  Flame,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { requireOrgPage } from '@/lib/org'
import { getRiskOverview, type RiskThread } from '@/services/dashboard.service'
import { listRiskAlerts } from '@/services/alert.service'
import { Reveal } from '@/components/dashboard/Motion'
import AlertsPanel from '@/components/dashboard/AlertsPanel'
import StatCard from '@/components/dashboard/StatCard'
import ModulePill from '@/components/dashboard/ModulePill'
import ContactAvatar from '@/components/dashboard/ContactAvatar'
import RiskBadge from '@/components/dashboard/RiskBadge'
import WidgetShell from '@/components/dashboard/WidgetShell'
import EmptyNote from '@/components/dashboard/EmptyNote'
import DashboardEmpty from '@/components/dashboard/DashboardEmpty'

export const metadata: Metadata = { title: 'Risk Monitor — Velnox' }

function RiskThreadCard({ t }: { t: RiskThread }) {
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 11, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <ContactAvatar name={t.contactName} size={34} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.contactName}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.subject ?? t.contactEmail ?? 'No subject'}
          </div>
        </div>
        {t.risk && <RiskBadge level={t.risk} />}
      </div>

      {t.summary && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t.summary}</p>
      )}

      {t.reasons.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {t.reasons.map((r) => (
            <span
              key={r}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--hot)',
                background: 'var(--hot-dim)',
                border: '1px solid var(--hot-border)',
                borderRadius: 100,
                padding: '3px 10px',
              }}
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {t.nextAction && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          <Sparkles size={11} style={{ color: 'var(--accent)', marginRight: 5, verticalAlign: '-1px' }} />
          <strong style={{ fontWeight: 600 }}>AI suggests:</strong> {t.nextAction}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 2 }}>
        {t.waiting && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--attention)' }}>
            <Clock size={12} />
            waiting {t.waiting}
          </span>
        )}
        {t.lastActivityAgo && (
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>active {t.lastActivityAgo}</span>
        )}
        <Link
          href={t.href}
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
        >
          Open thread
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  )
}

export default async function RiskPage() {
  const ctx = await requireOrgPage()

  const data = await getRiskOverview(ctx.organization.id)
  // Sequential on purpose — small connection pool (see CLAUDE.md).
  const alerts = data.hasData ? await listRiskAlerts(ctx.organization.id) : []
  const allClear = data.critical.length === 0 && data.watchlist.length === 0

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Risk Monitor
              </h1>
              <ModulePill status="live" />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Churn signals from AI thread analysis and reply-time tracking.
            </p>
          </div>
        </div>
      </Reveal>

      {!data.hasData ? (
        <DashboardEmpty hasIntegration={data.hasIntegration} />
      ) : (
        <>
          <div className="kpi-grid" style={{ marginBottom: 14 }}>
            <StatCard
              label="Clients at risk"
              icon={<ShieldAlert size={12} />}
              value={String(data.kpis.atRiskClients)}
              sub="AI-flagged or 48h+ overdue"
              tone={data.kpis.atRiskClients > 0 ? 'critical' : 'success'}
              delay={0}
            />
            <StatCard
              label="Critical threads"
              icon={<Flame size={12} />}
              value={String(data.kpis.criticalThreads)}
              sub="Highest AI risk level"
              tone={data.kpis.criticalThreads > 0 ? 'critical' : 'default'}
              delay={0.05}
            />
            <StatCard
              label="Overdue replies"
              icon={<Clock size={12} />}
              value={String(data.kpis.overdueReplies)}
              sub="Client waiting 24h or longer"
              tone={data.kpis.overdueReplies > 0 ? 'warning' : 'default'}
              delay={0.1}
            />
            <StatCard
              label="Deals lost"
              icon={<CircleX size={12} />}
              value={String(data.kpis.lostDeals)}
              sub="Marked lost or AI-detected loss"
              delay={0.15}
            />
          </div>

          <Reveal delay={0.06}>
            <div style={{ marginBottom: 14 }}>
              <AlertsPanel initial={alerts} />
            </div>
          </Reveal>

          {allClear ? (
            <Reveal delay={0.1}>
              <div className="widget" style={{ alignItems: 'center', textAlign: 'center', padding: '56px 28px' }}>
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    background: 'var(--success-dim)',
                    border: '1px solid var(--success-border)',
                    color: 'var(--success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <ShieldCheck size={22} />
                </div>
                <h2 style={{ margin: '0 0 7px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>No active risks</h2>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.6 }}>
                  Every analyzed thread looks healthy and no replies are badly overdue. New risks will appear here the moment they&apos;re detected.
                </p>
              </div>
            </Reveal>
          ) : (
            <>
              {data.critical.length > 0 && (
                <Reveal delay={0.08}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 2px 12px' }}>
                    <ShieldAlert size={14} style={{ color: 'var(--hot)' }} />
                    <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Needs intervention</h2>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--hot)', background: 'var(--hot-dim)', border: '1px solid var(--hot-border)', borderRadius: 100, padding: '1px 8px' }}>
                      {data.critical.length}
                    </span>
                  </div>
                  <div className="insight-grid" style={{ marginBottom: 18 }}>
                    {data.critical.map((t) => (
                      <RiskThreadCard key={t.id} t={t} />
                    ))}
                  </div>
                </Reveal>
              )}

              <Reveal delay={0.16}>
                <WidgetShell
                  icon={<Eye size={14} />}
                  title="Watchlist"
                  sub="Medium risk or replies running late — worth a glance"
                  status="live"
                >
                  {data.watchlist.length === 0 ? (
                    <EmptyNote icon={<Eye size={17} />} title="Watchlist is clear" />
                  ) : (
                    <div style={{ padding: '6px 0' }}>
                      {data.watchlist.map((t) => (
                        <Link key={t.id} href={t.href} className="row-link">
                          <ContactAvatar name={t.contactName} size={30} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.contactName}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.reasons[0] ?? t.summary ?? t.subject ?? 'Reply running late'}
                            </div>
                          </div>
                          {t.waiting && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--attention)', flexShrink: 0 }}>waiting {t.waiting}</span>
                          )}
                          {t.risk && <RiskBadge level={t.risk} />}
                          <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        </Link>
                      ))}
                    </div>
                  )}
                </WidgetShell>
              </Reveal>
            </>
          )}
        </>
      )}
    </div>
  )
}
