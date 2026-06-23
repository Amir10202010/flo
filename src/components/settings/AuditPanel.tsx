'use client'

import { useEffect, useState } from 'react'
import { History } from 'lucide-react'

type Entry = { id: string; action: string; summary: string; actorName: string; createdAt: string }

function ago(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/** Append-only activity log for the organization (admin view). */
export default function AuditPanel() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/orgs/audit').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d) setEntries(d.entries ?? [])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  return (
    <div className="card" style={{ padding: '6px 8px' }}>
      {loaded && entries.length === 0 && (
        <div style={{ padding: '22px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>No activity yet.</div>
      )}
      {entries.map((e) => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '10px 12px', borderBottom: '1px solid var(--border-light)' }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-subtle)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            <History size={14} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>{e.summary}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>{e.actorName} · {ago(e.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
