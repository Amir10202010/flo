'use client'

import { useEffect, useState } from 'react'
import { Mail, Plus, Plug } from 'lucide-react'

type Integration = { type: string; isActive: boolean; syncedAt: string | null; email: string | null }

/** Connected shared inboxes for the org (admin view). Connect starts the Gmail
 * OAuth flow; disconnect deactivates the integration. */
export default function InboxesPanel({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Integration[]>([])
  const [loaded, setLoaded] = useState(false)

  async function load() {
    const r = await fetch('/api/integrations').then((x) => (x.ok ? x.json() : null)).catch(() => null)
    setItems(Array.isArray(r) ? r : [])
    setLoaded(true)
  }
  useEffect(() => {
    const run = async () => { await load() }
    void run()
  }, [])

  async function disconnect(type: string) {
    if (!confirm('Disconnect this shared inbox? Its threads will be hidden until reconnected.')) return
    await fetch('/api/integrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) })
    load()
  }

  const active = items.filter((i) => i.isActive)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '6px 8px' }}>
        {loaded && active.length === 0 && (
          <div style={{ padding: '22px 14px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>No shared inbox connected</p>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>Connect a Gmail mailbox your team works out of.</p>
          </div>
        )}
        {active.map((i) => (
          <div key={i.type + i.email} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px' }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Mail size={16} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{i.email ?? i.type}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {i.type === 'GMAIL' ? 'Gmail' : i.type} · {i.syncedAt ? 'synced' : 'sync pending'}
              </div>
            </div>
            {canManage && (
              <button type="button" onClick={() => disconnect(i.type)} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>Disconnect</button>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <a href="/api/auth/gmail" className="btn-primary" style={{ alignSelf: 'flex-start', gap: 7, fontSize: 13.5, padding: '10px 16px' }}>
          <Plus size={15} /> Connect a shared inbox
        </a>
      )}
      {!canManage && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plug size={13} /> Only admins can connect or disconnect inboxes.
        </p>
      )}
    </div>
  )
}
