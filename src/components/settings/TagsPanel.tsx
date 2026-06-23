'use client'

import { useEffect, useState } from 'react'
import { Plus, Tag as TagIcon } from 'lucide-react'

type Tag = { id: string; name: string; color: string }
const COLORS = ['#6366F1', '#DC2B55', '#0EA371', '#C2620A', '#7C4DFF', '#0891B2']

/** Org tag library: create labels the team applies to conversations. */
export default function TagsPanel({ canManage }: { canManage: boolean }) {
  const [tags, setTags] = useState<Tag[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [busy, setBusy] = useState(false)

  async function load() {
    const r = await fetch('/api/tags').then((x) => (x.ok ? x.json() : null)).catch(() => null)
    if (r) setTags(r.tags ?? [])
  }
  useEffect(() => {
    const run = async () => { await load() }
    void run()
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    setBusy(true)
    try {
      const r = await fetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: clean, color }) })
      if (r.ok) { setName(''); load() }
    } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '16px 18px' }}>
        {tags.length === 0 && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--text-muted)' }}>No tags yet.</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: canManage ? 16 : 0 }}>
          {tags.map((t) => (
            <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: t.color, background: `${t.color}1a`, border: `1px solid ${t.color}55`, borderRadius: 100, padding: '4px 12px' }}>
              <TagIcon size={11} /> {t.name}
            </span>
          ))}
        </div>
        {canManage && (
          <form onSubmit={create} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} style={{ width: 22, height: 22, borderRadius: 6, background: c, border: color === c ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag name" maxLength={40} style={{ flex: '1 1 160px', padding: '8px 11px', fontSize: 13, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }} />
            <button type="submit" className="btn-primary" disabled={busy} style={{ padding: '8px 14px', fontSize: 13, gap: 6 }}><Plus size={14} /> Add</button>
          </form>
        )}
      </div>
    </div>
  )
}
