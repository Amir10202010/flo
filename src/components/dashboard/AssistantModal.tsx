'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelRight, Sparkles, X } from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'
import type { NodeChip } from '@/services/graph.service'
import { NODE_META } from '@/components/knowledge/entityMeta'
import KnowledgePanel from '@/components/knowledge/KnowledgePanel'
import AssistantComposer from './AssistantComposer'

/**
 * Ask Velnox AI — a summonable overlay (not a floating bubble, not a page).
 * Opened from the sidebar "Ask AI" button and the ⌘K palette via the shared UI
 * store, it hosts the grounded workspace assistant (same AssistantComposer,
 * including confirm-before-execute action cards).
 *
 * When an answer touches the knowledge base, a collapsible knowledge rail
 * opens beside the thread: the touched entities as switchable chips, each
 * backed by its full context panel (facts, sources, connections) — the same
 * panel as /knowledge. It auto-opens once; closing it is remembered for the
 * session.
 */

const EMPTY_STATS = { people: 0, companies: 0, topics: 0, meetings: 0, notes: 0, edges: 0 }

function useIsWide(threshold = 880): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${threshold}px)`)
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [threshold])
  return wide
}

export default function AssistantModal() {
  const open = useUiStore((s) => s.assistantOpen)
  const setOpen = useUiStore((s) => s.setAssistantOpen)
  const isWide = useIsWide()

  const [related, setRelated] = useState<NodeChip[]>([])
  const [activeRef, setActiveRef] = useState<string | null>(null)
  const [railOpen, setRailOpen] = useState(false)
  const userClosedRail = useRef(false)

  const onRelated = useCallback((chips: NodeChip[]) => {
    setRelated(chips)
    setActiveRef(chips[0]?.ref ?? null)
    if (!userClosedRail.current) setRailOpen(true)
  }, [])

  const closeRail = useCallback(() => {
    userClosedRail.current = true
    setRailOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, setOpen])

  if (!open) return null

  const showRail = railOpen && related.length > 0 && isWide

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ask Velnox AI"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 950,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '10vh 16px 24px',
        background: 'rgba(12,18,60,0.32)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          width: showRail ? 'min(1000px, 100%)' : 'min(680px, 100%)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 18,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 60px rgba(12,14,29,0.28)',
          overflow: 'hidden',
          transition: 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-light)',
            background: 'var(--bg-subtle)',
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--accent)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={14} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Ask Velnox</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Grounded in your inbox · it proposes, you confirm</div>
          </div>
          {related.length > 0 && isWide && (
            <button
              type="button"
              className="kn-secondary-btn"
              aria-pressed={railOpen}
              onClick={() => (railOpen ? closeRail() : setRailOpen(true))}
              title={railOpen ? 'Hide knowledge' : 'Show knowledge'}
            >
              <PanelRight size={13} />
              Knowledge · {related.length}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 18px 24px', display: 'flex', justifyContent: 'center' }}>
            <AssistantComposer onRelated={onRelated} />
          </div>

          {showRail && (
            <aside
              style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--border-light)', overflowY: 'auto', padding: '16px 16px 24px', background: 'var(--bg-subtle)' }}
              aria-label="Knowledge context"
              // Any link inside the rail navigates — close the modal so the
              // destination is actually visible.
              onClickCapture={(e) => {
                if ((e.target as HTMLElement).closest('a')) setOpen(false)
              }}
            >
              {related.length > 1 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
                  {related.slice(0, 6).map((c) => {
                    const meta = NODE_META[c.type]
                    const Icon = meta.icon
                    const active = c.ref === activeRef
                    return (
                      <button
                        key={c.ref}
                        type="button"
                        className="kn-chip"
                        onClick={() => setActiveRef(c.ref)}
                        aria-pressed={active}
                        style={{
                          cursor: 'pointer',
                          background: active ? 'var(--text-primary)' : 'var(--bg-surface)',
                          color: active ? '#fff' : undefined,
                          borderColor: active ? 'var(--text-primary)' : undefined,
                        }}
                      >
                        <Icon size={11} style={{ color: active ? '#fff' : meta.color, flexShrink: 0 }} />
                        <span className="kn-chip-label">{c.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              <KnowledgePanel
                nodeRef={activeRef}
                stats={EMPTY_STATS}
                onSelect={setActiveRef}
                onClose={closeRail}
                onNavigate={() => setOpen(false)}
              />
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
