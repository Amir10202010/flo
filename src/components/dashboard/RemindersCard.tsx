'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlarmClock, ArrowUpRight, Check, Loader2, X } from 'lucide-react'
import WidgetShell from './WidgetShell'

/**
 * Pending follow-up reminders (set via the assistant's create_reminder action).
 * Self-contained: fetches its own data so it stays off the tuned server-render
 * dashboard path. Renders nothing until loaded, and nothing when there are no
 * pending reminders — it never shows an empty shell.
 */
interface ReminderItem {
  id: string
  note: string
  dueLabel: string
  overdue: boolean
  href: string | null
  contactName: string | null
}

export default function RemindersCard() {
  const [items, setItems] = useState<ReminderItem[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/reminders')
      .then((r) => r.json())
      .then((d) => alive && setItems(Array.isArray(d?.reminders) ? d.reminders : []))
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [])

  async function resolve(id: string, action: 'done' | 'cancel') {
    if (busy) return
    setBusy(id)
    const prev = items
    setItems((list) => (list ? list.filter((r) => r.id !== id) : list)) // optimistic
    try {
      const r = await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!r.ok) setItems(prev) // revert on failure
    } catch {
      setItems(prev)
    } finally {
      setBusy(null)
    }
  }

  // Render nothing until loaded, and nothing when empty.
  if (!items || items.length === 0) return null

  return (
    <WidgetShell
      icon={<AlarmClock size={14} />}
      iconTone="ai"
      title="Reminders"
      sub="Follow-ups you asked the assistant to track"
      status="live"
      bodyStyle={{ padding: '4px 6px 6px' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((r) => (
          <div
            key={r.id}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 10px', minWidth: 0 }}
          >
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: r.overdue ? 'var(--hot)' : 'var(--text-muted)',
                background: r.overdue ? 'var(--hot-dim)' : 'var(--bg-subtle)',
                border: `1px solid ${r.overdue ? 'var(--hot-border)' : 'var(--border-light)'}`,
                borderRadius: 7,
                padding: '3px 7px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {r.overdue ? 'Due' : r.dueLabel}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>{r.note}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                {!r.overdue && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.dueLabel}</span>}
                {r.contactName && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.contactName}</span>}
                {r.href && (
                  <Link
                    href={r.href}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                  >
                    Open thread
                    <ArrowUpRight size={10} />
                  </Link>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => resolve(r.id, 'done')}
                disabled={busy === r.id}
                title="Mark done"
                aria-label="Mark reminder done"
                style={iconBtn('var(--success)')}
              >
                {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button
                type="button"
                onClick={() => resolve(r.id, 'cancel')}
                disabled={busy === r.id}
                title="Cancel reminder"
                aria-label="Cancel reminder"
                style={iconBtn('var(--text-muted)')}
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  )
}

function iconBtn(color: string): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid var(--border-light)',
    background: 'transparent',
    color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }
}
