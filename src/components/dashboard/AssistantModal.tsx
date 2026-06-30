'use client'

import { useEffect } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'
import AssistantComposer from './AssistantComposer'

/**
 * Ask Velnox AI — a summonable overlay (not a floating bubble, not a page).
 * Opened from the sidebar "Ask AI" button and the ⌘K palette via the shared UI
 * store, it hosts the grounded workspace assistant (same AssistantComposer,
 * including confirm-before-execute action cards). One AI surface, everywhere.
 */
export default function AssistantModal() {
  const open = useUiStore((s) => s.assistantOpen)
  const setOpen = useUiStore((s) => s.setAssistantOpen)

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
          width: 'min(680px, 100%)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 18,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 60px rgba(12,14,29,0.28)',
          overflow: 'hidden',
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
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Grounded in your workspace · it proposes, you confirm</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 24px', display: 'flex', justifyContent: 'center' }}>
          <AssistantComposer />
        </div>
      </div>
    </div>
  )
}
