'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BellRing, Check, CheckCheck, Loader, ShieldCheck, Sparkles } from 'lucide-react'
import WidgetShell from './WidgetShell'
import RiskBadge from './RiskBadge'
import EmptyNote from './EmptyNote'
import type { RiskAlertItem } from '@/types'

/**
 * Active risk alerts with status transitions. Server provides the initial
 * list (page render); acknowledge/resolve PATCH /api/alerts/:id and update
 * the row in place — resolved rows slide out of the list.
 */
export default function AlertsPanel({ initial }: { initial: RiskAlertItem[] }) {
  const [alerts, setAlerts] = useState(initial)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(id: string, action: 'acknowledge' | 'resolve') {
    if (busyId) return
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to update alert')
      }
      const updated = (await res.json()) as RiskAlertItem
      setAlerts((prev) =>
        action === 'resolve'
          ? prev.filter((a) => a.id !== id)
          : prev.map((a) => (a.id === id ? updated : a)),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update alert')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <WidgetShell
      icon={<BellRing size={14} />}
      iconTone="ai"
      title="Active alerts"
      sub="Rule + AI detections with a clear reason and next step — acknowledge or resolve as you work"
      status="live"
    >
      {error && (
        <p role="alert" style={{ margin: '10px 16px 0', fontSize: 12.5, color: 'var(--hot)' }}>
          {error}
        </p>
      )}
      {alerts.length === 0 ? (
        <EmptyNote
          icon={<ShieldCheck size={17} />}
          title="No active alerts"
          hint="New risk conditions raise alerts here automatically after every sync."
        />
      ) : (
        <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map((a) => {
            const busy = busyId === a.id
            const acked = a.status === 'ACKNOWLEDGED'
            return (
              <div
                key={a.id}
                className="card"
                style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, opacity: acked ? 0.78 : 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flexWrap: 'wrap' }}>
                  <RiskBadge level={a.severity} />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {a.title}
                  </span>
                  {acked && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                      <Check size={11} /> acknowledged
                    </span>
                  )}
                  {a.lastSeenAgo && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{a.lastSeenAgo}</span>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{a.reason}</p>

                {a.suggestedAction && (
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    <Sparkles size={11} style={{ color: 'var(--accent)', marginRight: 5, verticalAlign: '-1px' }} />
                    {a.suggestedAction}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                  {!acked && (
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: 12, padding: '5px 12px' }}
                      disabled={busy}
                      onClick={() => act(a.id, 'acknowledge')}
                    >
                      {busy ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
                      Acknowledge
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    disabled={busy}
                    onClick={() => act(a.id, 'resolve')}
                  >
                    {busy ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCheck size={12} />}
                    Resolve
                  </button>
                  {a.href && (
                    <Link
                      href={a.href}
                      style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      Open thread
                      <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </WidgetShell>
  )
}
