'use client'

import { useEffect, useState } from 'react'
import { Bot, Sparkles, X } from 'lucide-react'
import AssistantComposer from './AssistantComposer'

/**
 * Global floating assistant — a bottom-right launcher that opens a chat panel
 * with the grounded workspace assistant (same AssistantComposer used on the
 * /assistant page, including the confirm-before-execute action cards). Mounted
 * once in the dashboard shell so it's available on every page.
 */
export default function AssistantWidget() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="AI assistant"
          style={{
            position: 'fixed',
            bottom: 88,
            right: 24,
            width: 'min(400px, calc(100vw - 32px))',
            height: 'min(560px, calc(100vh - 140px))',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: 16,
            border: '1px solid var(--border)',
            boxShadow: '0 24px 60px rgba(12,14,29,0.28)',
            overflow: 'hidden',
            zIndex: 900,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '13px 15px',
              borderBottom: '1px solid var(--border-light)',
              background: 'linear-gradient(180deg, rgba(79,92,244,0.05), rgba(255,255,255,0))',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                background: 'linear-gradient(135deg, #4F5CF4, #6D44F5)',
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
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Ask Velnox</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Grounded in your workspace</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 15px 18px', display: 'flex', justifyContent: 'center' }}>
            <AssistantComposer />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open AI assistant'}
        aria-expanded={open}
        title="Ask Velnox"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 54,
          height: 54,
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #4F5CF4, #6D44F5)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 12px 30px rgba(79,92,244,0.42)',
          zIndex: 901,
        }}
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>
    </>
  )
}
