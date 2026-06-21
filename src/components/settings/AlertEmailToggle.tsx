'use client'

import { useEffect, useState } from 'react'

/**
 * Toggle for proactive urgent-alert emails. Reads its own state from
 * /api/notifications/settings (avoids threading the integration through the
 * server page) and optimistically PATCHes on change, reverting on failure.
 */
export default function AlertEmailToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [connected, setConnected] = useState(true)
  const [ownerMailbox, setOwnerMailbox] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/notifications/settings')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        setEnabled(d?.alertEmailsEnabled ?? true)
        setConnected(d?.connected ?? false)
        setOwnerMailbox(d?.ownerMailbox ?? false)
      })
      .catch(() => alive && setEnabled(true))
    return () => {
      alive = false
    }
  }, [])

  async function toggle() {
    if (enabled === null || saving || !connected) return
    const next = !enabled
    setEnabled(next)
    setSaving(true)
    try {
      const r = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertEmailsEnabled: next }),
      })
      if (!r.ok) setEnabled(!next) // revert
    } catch {
      setEnabled(!next)
    } finally {
      setSaving(false)
    }
  }

  const on = enabled === true
  const state =
    enabled === null
      ? '…'
      : !connected
        ? 'Connect Gmail'
        : !ownerMailbox
          ? 'Not your owner mailbox'
          : on
            ? 'On'
            : 'Off'

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={enabled === null || saving || !connected}
      aria-pressed={on}
      title={
        ownerMailbox
          ? 'Get an email when a client hits critical/high risk (throttled, max once per ~6h)'
          : 'Urgent-alert emails are sent only to the GMAIL_USER_EMAIL owner mailbox'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        background: 'transparent',
        border: 'none',
        cursor: enabled === null || saving || !connected ? 'default' : 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: on && ownerMailbox ? 'var(--success)' : 'var(--text-muted)' }}>
        {state}
      </span>
      <span
        style={{
          width: 34,
          height: 20,
          borderRadius: 999,
          background: on && ownerMailbox ? 'var(--accent)' : 'var(--border-light)',
          position: 'relative',
          transition: 'background 0.16s ease',
          opacity: connected ? 1 : 0.5,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 16 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            transition: 'left 0.16s ease',
          }}
        />
      </span>
    </button>
  )
}
