'use client'

import { useState } from 'react'
import { BellPlus, Check } from 'lucide-react'

/**
 * Debrief action items with one-click follow-up: "Remind me" files a reminder
 * for tomorrow (the same reminders that surface on the dashboard and in the
 * urgent email). Deterministic, reversible, never sends mail.
 */
export default function ActionItems({ items }: { items: string[] }) {
  const [set, setSet] = useState<Record<string, 'busy' | 'done'>>({})

  async function remind(item: string) {
    setSet((s) => ({ ...s, [item]: 'busy' }))
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: item }),
      })
      if (!res.ok) throw new Error()
      setSet((s) => ({ ...s, [item]: 'done' }))
    } catch {
      setSet((s) => {
        const next = { ...s }
        delete next[item]
        return next
      })
    }
  }

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item) => {
        const status = set[item]
        return (
          <li key={item} className="mt-fact-row">
            <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-primary)' }}>{item}</span>
            {status === 'done' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                <Check size={12} />
                Reminder set
              </span>
            ) : (
              <button
                type="button"
                className="kn-secondary-btn"
                onClick={() => remind(item)}
                disabled={status === 'busy'}
                style={{ flexShrink: 0 }}
              >
                <BellPlus size={12} />
                {status === 'busy' ? 'Setting…' : 'Remind me'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
