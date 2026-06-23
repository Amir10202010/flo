'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Send, Sparkles, Tag as TagIcon, UserRound } from 'lucide-react'
import CategoryMover from '@/components/CategoryMover'
import ThreadSummary from '@/components/ThreadSummary'
import type { EmailCategory } from '@/types'

type Member = { membershipId: string; name: string | null; email: string; role: string }
type Tag = { id: string; name: string; color: string }
type Note = { id: string; body: string; authorName: string; createdAt: string }
type State = 'OPEN' | 'SNOOZED' | 'CLOSED'
type Analysis = { summary: string; riskLevel: string; nextAction: string | null; provider: string } | null

const STATES: { value: State; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'SNOOZED', label: 'Snoozed' },
  { value: 'CLOSED', label: 'Closed' },
]

const RISK: Record<string, { label: string; color: string }> = {
  LOW:      { label: 'Low risk',    color: 'var(--cold)' },
  MEDIUM:   { label: 'Medium risk', color: 'var(--attention)' },
  HIGH:     { label: 'High risk',   color: 'var(--hot)' },
  CRITICAL: { label: 'Critical',    color: 'var(--hot)' },
}

function memberLabel(m: Member): string { return m.name?.trim() || m.email }

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/**
 * The thread context rail: a single AI surface (risk + summary + next action +
 * an inline "Catch me up" expander), thread properties (assignee, status,
 * category, tags), and team-only internal notes. Absorbs everything that used
 * to overload the header. Self-fetches members/tags/notes; AI analysis arrives
 * as serializable props from the server page.
 */
export default function ThreadContextRail({
  conversationId,
  initialAssigneeId,
  initialState,
  category,
  analysis,
}: {
  conversationId: string
  initialAssigneeId: string | null
  initialState: State
  category: EmailCategory
  analysis: Analysis
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
    ;(async () => {
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
    })()
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
  const risk = analysis ? (RISK[analysis.riskLevel] ?? RISK.LOW) : null

  async function assign(membershipId: string | null) {
    setAssignOpen(false); setAssigneeId(membershipId); setBusy(true)
    try {
      await fetch(`/api/conversations/${conversationId}/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId }),
      })
    } finally { setBusy(false) }
  }

  async function changeState(next: State) {
    setState(next); setBusy(true)
    try {
      await fetch(`/api/conversations/${conversationId}/state`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: next }),
      })
    } finally { setBusy(false) }
  }

  async function toggleTag(tag: Tag) {
    const attached = !convTags.some((t) => t.id === tag.id)
    setConvTags((prev) => (attached ? [...prev, tag] : prev.filter((t) => t.id !== tag.id)))
    await fetch(`/api/conversations/${conversationId}/tags`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: tag.id, attached }),
    })
  }

  async function addNote() {
    const body = noteText.trim()
    if (!body) return
    setNoteText('')
    const r = await fetch(`/api/conversations/${conversationId}/internal-notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (r.ok) { const note = await r.json(); setNotes((prev) => [...prev, note]) }
  }

  return (
    <div className="rail">
      {/* AI insight — the single AI surface */}
      <section className="rail-section">
        <div className="rail-ai-head">
          <span className="rail-ai-icon"><Sparkles size={13} /></span>
          <span className="rail-ai-title">AI insight</span>
          {risk && (
            <span className="rail-risk" style={{ color: risk.color }}>
              <span className="rail-risk-dot" style={{ background: risk.color }} />
              {risk.label}
            </span>
          )}
        </div>
        {analysis ? (
          <>
            <p className="rail-ai-summary">{analysis.summary}</p>
            {analysis.nextAction && <p className="rail-ai-action">→ {analysis.nextAction}</p>}
            {analysis.provider === 'local' && (
              <span className="rail-offline" title="Generated by the offline heuristic — add a Gemini key for full AI analysis">
                offline mode
              </span>
            )}
            <ThreadSummary conversationId={conversationId} />
          </>
        ) : (
          <p className="rail-empty">Not analyzed yet. Insight appears after the next sync/analysis.</p>
        )}
      </section>

      {/* Properties */}
      <section className="rail-section">
        <h3 className="rail-label">Properties</h3>

        <div className="rail-prop">
          <span className="rail-prop-k">Assignee</span>
          <div ref={assignRef} className="rail-prop-v">
            <button type="button" onClick={() => setAssignOpen((o) => !o)} disabled={busy} className="rail-select">
              <UserRound size={13} />
              <span className="rail-select-label">{assignee ? memberLabel(assignee) : 'Unassigned'}</span>
              <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
            {assignOpen && (
              <div className="rail-menu" role="listbox">
                <button type="button" className="rail-menu-item" onClick={() => assign(meId)} disabled={!meId}>
                  Assign to me
                </button>
                <button type="button" className="rail-menu-item" onClick={() => assign(null)}>
                  Unassigned {assigneeId === null && <Check size={13} style={{ color: 'var(--accent)' }} />}
                </button>
                <div className="rail-menu-sep" />
                {members.map((m) => (
                  <button key={m.membershipId} type="button" className="rail-menu-item" onClick={() => assign(m.membershipId)}>
                    <span className="rail-trunc">{memberLabel(m)}</span>
                    {assigneeId === m.membershipId && <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rail-prop">
          <span className="rail-prop-k">Status</span>
          <div className="rail-seg" role="group" aria-label="Conversation state">
            {STATES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => changeState(s.value)}
                disabled={busy}
                data-active={state === s.value}
                className="rail-seg-btn"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rail-prop">
          <span className="rail-prop-k">Category</span>
          <div className="rail-prop-v"><CategoryMover conversationId={conversationId} current={category} /></div>
        </div>

        <div className="rail-prop">
          <span className="rail-prop-k">Tags</span>
          <div ref={tagRef} className="rail-prop-v">
            <button type="button" onClick={() => setTagOpen((o) => !o)} className="rail-select">
              <TagIcon size={13} />
              <span className="rail-select-label">
                {convTags.length ? `${convTags.length} tag${convTags.length > 1 ? 's' : ''}` : 'Add tags'}
              </span>
              <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
            {tagOpen && (
              <div className="rail-menu" role="listbox">
                {allTags.length === 0 && <div className="rail-menu-empty">No tags yet — create them in Settings.</div>}
                {allTags.map((t) => {
                  const on = convTags.some((c) => c.id === t.id)
                  return (
                    <button key={t.id} type="button" className="rail-menu-item" onClick={() => toggleTag(t)}>
                      <span className="rail-trunc" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                        {t.name}
                      </span>
                      {on && <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {convTags.length > 0 && (
          <div className="rail-tag-chips">
            {convTags.map((t) => (
              <span
                key={t.id}
                className="rail-tag-chip"
                style={{ color: t.color, background: `${t.color}1a`, borderColor: `${t.color}55` }}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Internal notes — team only */}
      <section className="rail-section">
        <h3 className="rail-label">Internal notes <span className="rail-label-hint">· only your team</span></h3>
        {notes.length > 0 && (
          <div className="rail-notes-list">
            {notes.map((n) => (
              <div key={n.id} className="rail-note">
                <div className="rail-note-head">
                  <span className="rail-note-author">{n.authorName}</span>
                  <span className="rail-note-time">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="rail-note-body">{n.body}</p>
              </div>
            ))}
          </div>
        )}
        <div className="rail-note-compose">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add an internal note…"
            rows={2}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addNote() } }}
            className="rail-note-input"
          />
          <button type="button" onClick={addNote} disabled={!noteText.trim()} className="btn-primary rail-note-send">
            <Send size={13} /> Note
          </button>
        </div>
      </section>
    </div>
  )
}
