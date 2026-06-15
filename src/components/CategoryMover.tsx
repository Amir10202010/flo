'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { CATEGORY_META, EMAIL_CATEGORIES } from '@/lib/categories'
import type { EmailCategory } from '@/types'

/**
 * Per-thread category mover. Pins the category as a manual choice, learns a
 * sender rule for future mail, and re-aligns the sender's other threads — then
 * refreshes the route so the inbox + thread reflect the move immediately.
 */
export default function CategoryMover({
  conversationId,
  current,
}: {
  conversationId: string
  current: EmailCategory
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState<EmailCategory>(current)
  const [error, setError] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Sync to the server prop without an effect (React's adjust-state-in-render
  // pattern): after a move + router.refresh(), the new `current` resets us.
  const [seenCurrent, setSeenCurrent] = useState(current)
  if (current !== seenCurrent) {
    setSeenCurrent(current)
    setCategory(current)
  }

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function move(next: EmailCategory) {
    setOpen(false)
    if (next === category || saving) return
    const prev = category
    setCategory(next) // optimistic
    setSaving(true)
    setError(false)
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: next }),
      })
      if (!res.ok) throw new Error(`PATCH ${res.status}`)
      router.refresh()
    } catch {
      setCategory(prev) // revert
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const meta = CATEGORY_META[category]

  return (
    <div className="cat-mover" ref={rootRef}>
      <button
        type="button"
        className="cat-mover-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={saving}
        onClick={() => setOpen((o) => !o)}
        title={error ? 'Could not save — try again' : 'Move this thread to another category'}
      >
        {saving ? (
          <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)' }} />
        ) : (
          <span className="cat-mover-dot" style={{ background: meta.color }} />
        )}
        {meta.label}
        <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && (
        <div className="cat-menu" role="menu">
          {EMAIL_CATEGORIES.map((c) => {
            const m = CATEGORY_META[c]
            const active = c === category
            return (
              <button
                key={c}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                data-active={active}
                className="cat-menu-item"
                onClick={() => move(c)}
              >
                <span className="cat-menu-item-dot" style={{ background: m.color }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="cat-menu-item-label">{m.label}</span>
                    {active && <Check size={13} style={{ color: 'var(--accent)' }} />}
                  </span>
                  <span className="cat-menu-item-desc">{m.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
