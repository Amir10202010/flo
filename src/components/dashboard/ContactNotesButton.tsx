'use client'

import { useState } from 'react'
import { Loader2, StickyNote, Trash2, X } from 'lucide-react'

interface Note {
  id: string
  body: string
  source: string
  createdAt: string
}

/**
 * Per-contact notes: a small launcher (with a count badge) that opens a modal
 * to view, add and delete notes. Lives inside a clickable table row, so every
 * handler stops propagation to avoid triggering the row's navigation.
 */
export default function ContactNotesButton({
  contactId,
  contactName,
  count,
}: {
  contactId: string
  contactName: string
  count: number
}) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [n, setN] = useState(count)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const r = await fetch(`/api/contacts/${contactId}/notes`)
      const d = await r.json()
      const list: Note[] = Array.isArray(d?.notes) ? d.notes : []
      setNotes(list)
      setN(list.length)
    } catch {
      setNotes([])
    }
  }

  function openModal(e: React.MouseEvent) {
    e.stopPropagation()
    setOpen(true)
    if (notes === null) void load()
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      const r = await fetch(`/api/contacts/${contactId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (r.ok) {
        const note = (await r.json()) as Note
        setNotes((prev) => [note, ...(prev ?? [])])
        setN((c) => c + 1)
        setText('')
      }
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const prev = notes
    setNotes((list) => (list ? list.filter((x) => x.id !== id) : list))
    setN((c) => Math.max(0, c - 1))
    try {
      const r = await fetch(`/api/contacts/${contactId}/notes/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        setNotes(prev)
        setN(prev?.length ?? 0)
      }
    } catch {
      setNotes(prev)
      setN(prev?.length ?? 0)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title={n > 0 ? `${n} note${n === 1 ? '' : 's'}` : 'Add a note'}
        aria-label="Contact notes"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 7px',
          borderRadius: 7,
          border: '1px solid var(--border-light)',
          background: n > 0 ? 'var(--accent-dim)' : 'transparent',
          color: n > 0 ? 'var(--accent)' : 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        <StickyNote size={13} />
        {n > 0 && n}
      </button>

      {open && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(12,14,29,0.42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
              borderRadius: 14,
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg, 0 20px 50px rgba(0,0,0,0.25))',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 16px', borderBottom: '1px solid var(--border-light)' }}>
              <StickyNote size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
                Notes · {contactName}
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notes === null ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: 12.5 }}>
                  <Loader2 size={13} className="animate-spin" /> Loading…
                </div>
              ) : notes.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>No notes yet. Add the first one below.</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', borderRadius: 9, padding: '9px 11px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{note.body}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
                        {note.source === 'assistant' ? 'AI assistant' : 'You'} · {new Date(note.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button type="button" onClick={(e) => del(note.id, e)} aria-label="Delete note" title="Delete" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={add} style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border-light)' }}>
              <input
                value={text}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Note about ${contactName}…`}
                aria-label="New note"
                style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 9, padding: '9px 11px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)' }}
              />
              <button type="submit" className="btn-primary" disabled={busy || !text.trim()} style={{ fontSize: 13, padding: '9px 14px', flexShrink: 0 }}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : 'Add'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
