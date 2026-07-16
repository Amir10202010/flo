'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowUpRight, Check, ListTodo, FilePlus2, X } from 'lucide-react'
import type { KnowledgeGraph, NodeContext } from '@/services/graph.service'
import { NODE_META } from './entityMeta'

/**
 * The context panel — click any node and this is the memory of it: state of
 * play, decisions/action items/risks with provenance, the emails, meetings
 * and notes behind it, and its connections. One component serves the desktop
 * side panel and the mobile sheet.
 */

const FACT_META = {
  DECISION: { icon: Check, label: 'Decision' },
  ACTION_ITEM: { icon: ListTodo, label: 'Action item' },
  RISK: { icon: AlertTriangle, label: 'Risk' },
} as const

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div className="graph-sidebar-head" style={{ marginBottom: 8 }}>{children}</div>
}

function ItemLink({ href, title, meta }: { href: string; title: string; meta: string }) {
  return (
    <Link href={href} className="graph-conv-link">
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      {meta && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta}</span>}
    </Link>
  )
}

// Tiny per-session cache so re-selecting a node is instant.
const contextCache = new Map<string, NodeContext>()

export default function KnowledgePanel({
  nodeRef,
  stats,
  onSelect,
  onClose,
}: {
  nodeRef: string | null
  stats: KnowledgeGraph['stats']
  onSelect: (ref: string) => void
  onClose: () => void
}) {
  const router = useRouter()
  // Derived-from-props state (render-time reset — no synchronous effect setState).
  const [current, setCurrent] = useState<{ ref: string | null; context: NodeContext | null; failed: boolean }>(() => ({
    ref: nodeRef,
    context: nodeRef ? (contextCache.get(nodeRef) ?? null) : null,
    failed: false,
  }))
  if (current.ref !== nodeRef) {
    setCurrent({ ref: nodeRef, context: nodeRef ? (contextCache.get(nodeRef) ?? null) : null, failed: false })
  }
  const context = current.ref === nodeRef ? current.context : null
  const loading = Boolean(nodeRef) && !context && !current.failed
  const [creatingNote, setCreatingNote] = useState(false)

  useEffect(() => {
    if (!nodeRef || contextCache.has(nodeRef)) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/knowledge/node?ref=${encodeURIComponent(nodeRef)}`)
        if (!res.ok) throw new Error(`context fetch failed (${res.status})`)
        const data = (await res.json()) as NodeContext
        contextCache.set(nodeRef, data)
        if (!cancelled) setCurrent((cur) => (cur.ref === nodeRef ? { ref: nodeRef, context: data, failed: false } : cur))
      } catch {
        if (!cancelled) setCurrent((cur) => (cur.ref === nodeRef ? { ...cur, failed: true } : cur))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nodeRef])

  async function newNoteAbout(label: string) {
    setCreatingNote(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: label }),
      })
      if (!res.ok) return
      const { id } = (await res.json()) as { id: string }
      router.push(`/knowledge/notes/${id}`)
    } finally {
      setCreatingNote(false)
    }
  }

  // ── Overview (nothing selected) ────────────────────────────────────────────
  if (!nodeRef) {
    const overview: { label: string; value: number; color: string }[] = [
      { label: 'People', value: stats.people, color: NODE_META.PERSON.color },
      { label: 'Companies', value: stats.companies, color: NODE_META.COMPANY.color },
      { label: 'Topics', value: stats.topics, color: NODE_META.TOPIC.color },
      { label: 'Meetings', value: stats.meetings, color: NODE_META.MEETING.color },
      { label: 'Notes', value: stats.notes, color: NODE_META.NOTE.color },
      { label: 'Links', value: stats.edges, color: 'var(--text-muted)' },
    ]
    return (
      <div>
        <SectionHead>Your memory</SectionHead>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.55 }}>
          Everything Velnox knows, connected — click any node to see the emails, meetings, notes and decisions behind it.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 16 }}>
          {overview.map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (current.failed && !context) {
    return (
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Couldn’t load this node — check your connection and click it again.
      </p>
    )
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading || !context) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 9 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 14, width: '70%', borderRadius: 5 }} />
            <div className="skeleton" style={{ height: 11, width: '45%', borderRadius: 5, marginTop: 6 }} />
          </div>
        </div>
        <div className="skeleton" style={{ height: 12, borderRadius: 5, width: '92%' }} />
        <div className="skeleton" style={{ height: 12, borderRadius: 5, width: '85%' }} />
        <div className="skeleton" style={{ height: 64, borderRadius: 10, marginTop: 6 }} />
        <div className="skeleton" style={{ height: 64, borderRadius: 10 }} />
      </div>
    )
  }

  const meta = NODE_META[context.type]
  const Icon = meta.icon

  return (
    <div>
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: meta.color, color: '#fff' }}>
          <Icon size={17} strokeWidth={2.4} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25, wordBreak: 'break-word' }}>
            {context.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {meta.label}
            {context.sublabel ? ` · ${context.sublabel}` : ''}
            {context.awaitingReply ? ' · awaiting your reply' : ''}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="kn-icon-btn" style={{ flexShrink: 0, width: 24, height: 24 }}>
          <X size={15} />
        </button>
      </div>

      {/* State of play */}
      {context.headline && (
        <p style={{ margin: '12px 0 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{context.headline}</p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {context.openHref && context.openLabel && (
          <Link href={context.openHref} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
            {context.openLabel}
            <ArrowUpRight size={12} />
          </Link>
        )}
        <button type="button" className="kn-secondary-btn" onClick={() => newNoteAbout(context.label)} disabled={creatingNote}>
          <FilePlus2 size={12} />
          {creatingNote ? 'Creating…' : 'New note'}
        </button>
      </div>

      {/* Facts */}
      {context.facts.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead>What you know</SectionHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {context.facts.map((f, i) => {
              const fm = FACT_META[f.kind]
              const FIcon = fm.icon
              return (
                <div key={`${f.text}-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <FIcon size={12.5} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2.5 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-primary)' }}>{f.text}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                      {fm.label}
                      {f.whenLabel ? ` · ${f.whenLabel}` : ''}
                      {f.sourceHref && (
                        <>
                          {' · '}
                          <Link href={f.sourceHref} style={{ color: 'var(--text-secondary)' }}>
                            {f.sourceLabel}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sources */}
      {context.conversations.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead>Conversations{context.stats.conversations > context.conversations.length ? ` · ${context.stats.conversations}` : ''}</SectionHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {context.conversations.map((c) => (
              <ItemLink key={c.id} href={c.href} title={c.title} meta={c.meta} />
            ))}
          </div>
        </div>
      )}
      {context.meetings.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead>Meetings</SectionHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {context.meetings.map((m) => (
              <ItemLink key={m.id} href={m.href} title={m.title} meta={m.meta} />
            ))}
          </div>
        </div>
      )}
      {context.notes.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead>Notes</SectionHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {context.notes.map((n) => (
              <ItemLink key={n.id} href={n.href} title={n.title} meta={n.meta} />
            ))}
          </div>
        </div>
      )}

      {/* Connections — select in place, don't navigate */}
      {context.connections.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead>Connections · {context.stats.connections}</SectionHead>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {context.connections.map((c) => {
              const cm = NODE_META[c.type]
              const CIcon = cm.icon
              return (
                <button key={c.ref} type="button" className="kn-chip" onClick={() => onSelect(c.ref)} title={`${cm.label} · ${c.label}`} style={{ cursor: 'pointer' }}>
                  <CIcon size={11} style={{ color: cm.color, flexShrink: 0 }} />
                  <span className="kn-chip-label">{c.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {context.facts.length === 0 && context.conversations.length === 0 && context.connections.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
          Nothing recorded here yet — it fills in as conversations, meetings and notes mention this.
        </p>
      )}
    </div>
  )
}
