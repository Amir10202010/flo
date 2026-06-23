'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileText } from 'lucide-react'

type Template = { id: string; title: string; body: string }

/**
 * Composer dropdown that inserts a saved reply. Lazily fetches templates on first
 * open. `onPick` receives the chosen template body for insertion.
 */
export default function TemplateMenu({ onPick, disabled }: { onPick: (body: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Template[] | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && items === null) {
      const r = await fetch('/api/templates').then((x) => (x.ok ? x.json() : null)).catch(() => null)
      setItems(r?.templates ?? [])
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="composer-tool" onClick={() => void toggle()} disabled={disabled} title="Insert a saved reply">
        <FileText size={13} /> Templates <ChevronDown size={11} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div className="collab-menu" style={{ bottom: 'calc(100% + 6px)', top: 'auto', left: 0, minWidth: 240 }} role="listbox">
          {items === null && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>}
          {items !== null && items.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>No saved replies — create them in Settings → Templates.</div>
          )}
          {items?.map((t) => (
            <button key={t.id} type="button" className="collab-menu-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} onClick={() => { onPick(t.body); setOpen(false) }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{t.body}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
