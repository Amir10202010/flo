'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Plus, Send, Tag as TagIcon, UserRound, X } from 'lucide-react'

type Member = { membershipId: string; name: string | null; email: string; role: string }
type Tag = { id: string; name: string; color: string }
type Note = { id: string; body: string; authorName: string; createdAt: string }
type State = 'OPEN' | 'SNOOZED' | 'CLOSED'

const STATES: { value: State; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'SNOOZED', label: 'Snoozed' },
  { value: 'CLOSED', label: 'Closed' },
]

function memberLabel(m: Member): string {
  return m.name?.trim() || m.email
}

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/**
 * Shared-inbox collaboration bar for a thread: assignee, queue state, tags and
 * team-internal notes. Self-fetches members/tags/notes (keeps the server page
 * light) and persists every change through the collaboration API.
 */
export default function ThreadCollab({
  conversationId,
  initialAssigneeId,
  initialState,
}: {
  conversationId: string
  initialAssigneeId: string | null
  initialState: State
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [meId, setMeId] = useState<string | null>(null)
  const [assigneeId, setAssigneeId] = useState<string | null>(initialAssigneeId)
  const [state, setState] = useState<State>(initialState)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [convTags, setConvTags] = useState<Tag[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [noteText, setNoteText] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const assignRef = useRef<HTMLDivElement>(null)
  const tagRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const [m, t, ct, n] = await Promise.all([
        fetch('/api/orgs/members').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/tags').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/conversations/${conversationId}/tags`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/conversations/${conversationId}/internal-notes`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      if (!alive) return
      if (m) { setMembers(m.members ?? []); setMeId(m.me ?? null) }
      if (t) setAllTags(t.tags ?? [])
      if (ct) setConvTags(ct.tags ?? [])
      if (n) setNotes(n.notes ?? [])
    }
    load()
    return () => { alive = false }
  }, [conversationId])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) setAssignOpen(false)
      if (tagRef.current && !tagRef.current.contains(e.target as Node)) setTagOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const assignee = members.find((m) => m.membershipId === assigneeId) ?? null

  async function assign(membershipId: string | null) {
    setAssignOpen(false)
    setAssigneeId(membershipId)
    setBusy(true)
    try {
      await fetch(`/api/conversations/${conversationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId }),
      })
    } finally {
      setBusy(false)
    }
  }

  async function changeState(next: State) {
    setState(next)
    setBusy(true)
    try {
      await fetch(`/api/conversations/${conversationId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: next }),
      })
    } finally {
      setBusy(false)
    }
  }

  async function toggleTag(tag: Tag) {
    const attached = !convTags.some((t) => t.id === tag.id)
    setConvTags((prev) => (attached ? [...prev, tag] : prev.filter((t) => t.id !== tag.id)))
    await fetch(`/api/conversations/${conversationId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: tag.id, attached }),
    })
  }

  async function addNote() {
    const body = noteText.trim()
    if (!body) return
    setNoteText('')
    const r = await fetch(`/api/conversations/${conversationId}/internal-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (r.ok) {
      const note = await r.json()
      setNotes((prev) => [...prev, note])
    }
  }

  return (
    <div className="thread-collab" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Assignee */}
        <div ref={assignRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setAssignOpen((o) => !o)} disabled={busy} className="collab-chip">
            <UserRound size={13} />
            <span>{assignee ? memberLabel(assignee) : 'Unassigned'}</span>
            <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
          </button>
          {assignOpen && (
            <div className="collab-menu" role="listbox">
              <button type="button" className="collab-menu-item" onClick={() => assign(meId)} disabled={!meId}>
                Assign to me
              </button>
              <button type="button" className="collab-menu-item" onClick={() => assign(null)}>
                Unassigned {assigneeId === null && <Check size={13} style={{ color: 'var(--accent)' }} />}
              </button>
              <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
              {members.map((m) => (
                <button key={m.membershipId} type="button" className="collab-menu-item" onClick={() => assign(m.membershipId)}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memberLabel(m)}</span>
                  {assigneeId === m.membershipId && <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Queue state */}
        <div className="collab-seg" role="group" aria-label="Conversation state">
          {STATES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => changeState(s.value)}
              disabled={busy}
              data-active={state === s.value}
              className="collab-seg-btn"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Tags */}
        <div ref={tagRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setTagOpen((o) => !o)} className="collab-chip">
            <TagIcon size={13} />
            <span>Tags</span>
            <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
          </button>
          {tagOpen && (
            <div className="collab-menu" role="listbox">
              {allTags.length === 0 && (
                <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
                  No tags yet — create them in Settings.
                </div>
              )}
              {allTags.map((t) => {
                const on = convTags.some((c) => c.id === t.id)
                return (
                  <button key={t.id} type="button" className="collab-menu-item" onClick={() => toggleTag(t)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    </span>
                    {on && <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Attached tag chips */}
      {convTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {convTags.map((t) => (
            <span
              key={t.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
                color: t.color, background: `${t.color}1a`, border: `1px solid ${t.color}55`,
                borderRadius: 100, padding: '2px 9px',
              }}
            >
              {t.name}
              <button type="button" onClick={() => toggleTag(t)} style={{ display: 'inline-flex', border: 'none', background: 'none', cursor: 'pointer', color: t.color, padding: 0 }} aria-label={`Remove ${t.name}`}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Internal notes */}
      <div className="collab-notes">
        {notes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ background: 'var(--attention-dim)', border: '1px solid var(--attention-border)', borderRadius: 9, padding: '8px 11px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>{n.authorName}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{timeAgo(n.createdAt)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.body}</p>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add an internal note (only your team sees this)…"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addNote() }
            }}
            style={{
              flex: 1, resize: 'vertical', minHeight: 36, padding: '8px 10px', fontSize: 12.5,
              borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-base)',
              color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button type="button" onClick={addNote} disabled={!noteText.trim()} className="btn-primary" style={{ padding: '8px 12px', fontSize: 12.5, gap: 6 }}>
            <Send size={13} /> Note
          </button>
        </div>
      </div>
    </div>
  )
}
