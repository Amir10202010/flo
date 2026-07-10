'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'
import AlertsPanel from './AlertsPanel'
import type { RiskAlertItem } from '@/types'

/**
 * Follow-ups slide-over: the relationships going cold and threads waiting on a
 * reply. Opened globally (the ⌘K palette), it fetches the actionable set on open
 * and hands it to AlertsPanel (dismiss / snooze in place).
 */
export default function AlertsDrawer() {
  const open = useUiStore((s) => s.alertsOpen)
  const setOpen = useUiStore((s) => s.setAlertsOpen)
  const [alerts, setAlerts] = useState<RiskAlertItem[] | null>(null)

  useEffect(() => {
    if (!open) return
    // No synchronous reset here (react-hooks/set-state-in-effect): the initial
    // null shows the loader on first open; later opens refresh the list in place.
    const ctrl = new AbortController()
    fetch('/api/alerts', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // Tolerate either a bare array or an { items } / { data: { items } } envelope.
        const items = Array.isArray(d) ? d : (d?.items ?? d?.data?.items ?? [])
        setAlerts(items as RiskAlertItem[])
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setAlerts([])
      })
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      ctrl.abort()
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, setOpen])

  if (!open) return null

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(12,18,60,0.32)', backdropFilter: 'blur(2px)', zIndex: 940 }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Follow-ups"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(440px, 100vw)',
          background: 'var(--bg-base)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-12px 0 40px rgba(12,14,29,0.2)',
          zIndex: 941,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--border-light)' }}>
          <h2 className="section-title" style={{ margin: 0, fontSize: 18 }}>
            Who needs a follow-up
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {alerts === null ? (
            <p style={{ padding: '24px 6px', fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
          ) : (
            <AlertsPanel initial={alerts} />
          )}
        </div>
      </aside>
    </>
  )
}
