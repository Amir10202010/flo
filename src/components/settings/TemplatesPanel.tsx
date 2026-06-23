'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, FileText } from 'lucide-react'

type Template = { id: string; title: string; body: string; shared: boolean }

/** Saved replies the team inserts in the composer. */
export default function TemplatesPanel() {
  const [items, setItems] = useState<Template[]>([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [shared, setShared] = useState(true)
  const [busy, setBusy] = useState(false)

  async function load() {
    const r = await fetch('/api/templates').then((x) => (x.ok ? x.json() : null)).catch(() => null)
    if (r) setItems(r.templates ?? [])
  }
  useEffect(() => {
    const run = async () => { await load() }
    void run()
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setBusy(true)
    try {
      const r = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), body: body.trim(), shared }) })
      if (r.ok) { setTitle(''); setBody(''); setShared(true); setOpen(false); load() }
    } finally { setBusy(false) }
  }

  async function remove(t: Template) {
    if (!confirm(`Delete template “${t.title}”?`)) return
    await fetch(`/api/templates/${t.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '6px 8px' }}>
        {items.length === 0 && <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>No saved replies yet.</div>}
        {items.map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 12px', borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <FileText size={14} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {t.title}
                {!t.shared && <span style={{ marginLeft: 7, fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: 100, padding: '1px 7px' }}>private</span>}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</div>
            </div>
            <button type="button" onClick={() => remove(t)} title="Delete" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', padding: 4 }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="btn-primary" style={{ alignSelf: 'flex-start', gap: 7, fontSize: 13.5, padding: '9px 15px' }}>
          <Plus size={15} /> New saved reply
        </button>
      )}
      {open && (
        <form onSubmit={create} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Pricing follow-up)" maxLength={80} style={inp} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply text…" rows={4} maxLength={8000} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share with the team
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn-primary" disabled={busy} style={{ fontSize: 13.5, padding: '9px 16px' }}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost" style={{ fontSize: 13.5, padding: '9px 16px' }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

const inp: React.CSSProperties = {
  padding: '9px 11px', fontSize: 13.5, borderRadius: 9, border: '1px solid var(--border)',
  background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none',
}
