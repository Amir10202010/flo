'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { CATEGORY_META, EMAIL_CATEGORIES } from '@/lib/categories'
import type { EmailCategory } from '@/types'

export type Filter = 'ALL' | 'HOT' | 'ATTENTION' | 'AWAITING'
export type CatFilter = 'ALL' | EmailCategory

// Category rows (single-select). "All mail" shows everything except Spam — junk
// never mixes with real mail, Spam has its own row.
const CAT_FILTERS: { key: CatFilter; label: string; dot?: string }[] = [
  { key: 'ALL', label: 'All mail' },
  ...EMAIL_CATEGORIES.map((c) => ({
    key: c as CatFilter,
    label: CATEGORY_META[c].label,
    dot: CATEGORY_META[c].color,
  })),
]

const PRIORITY_FILTERS: { key: Filter; label: string; dot?: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'HOT', label: 'Urgent', dot: 'var(--hot)' },
  { key: 'ATTENTION', label: 'High', dot: 'var(--attention)' },
  { key: 'AWAITING', label: 'Awaiting', dot: 'var(--accent)' },
]

/**
 * Inbox filter control: a single "Filters" button that opens a popover with the
 * category + priority pickers. Presentational — all filter state lives in the
 * parent (InboxList); this just renders the current values and reports changes.
 * Selections apply live (no Apply step); the popover closes on Done / outside
 * click / Escape.
 */
export default function InboxFilters({
  filter,
  setFilter,
  catFilter,
  setCatFilter,
  counts,
  catCounts,
}: {
  filter: Filter
  setFilter: (f: Filter) => void
  catFilter: CatFilter
  setCatFilter: (c: CatFilter) => void
  counts: Record<Filter, number>
  catCounts: Record<CatFilter, number>
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape (same pattern as CategoryMover).
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

  const activeCount = (catFilter !== 'ALL' ? 1 : 0) + (filter !== 'ALL' ? 1 : 0)
  const hasActive = activeCount > 0

  function clearAll() {
    setCatFilter('ALL')
    setFilter('ALL')
  }

  return (
    <div className="inbox-filters" ref={rootRef}>
      <button
        type="button"
        className={`inbox-filters-btn${hasActive ? ' active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Filter by category and priority"
      >
        <SlidersHorizontal size={15} />
        Filters
        {hasActive && <span className="inbox-filters-badge">{activeCount}</span>}
      </button>

      {open && (
        <div className="inbox-filters-panel" role="dialog" aria-label="Filters">
          <div className="iff-section-label">Category</div>
          <div className="iff-list">
            {CAT_FILTERS.map((c) => {
              const active = catFilter === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  data-active={active}
                  className="iff-row"
                  onClick={() => setCatFilter(c.key)}
                >
                  <span className="iff-row-dot" style={{ background: c.dot ?? 'var(--text-muted)' }} />
                  <span className="iff-row-label">{c.label}</span>
                  <span className="iff-row-count">{catCounts[c.key] ?? 0}</span>
                  {active && <Check size={14} className="iff-row-check" />}
                </button>
              )
            })}
          </div>

          <div className="iff-divider" />

          <div className="iff-section-label">Priority</div>
          <div className="iff-seg">
            {PRIORITY_FILTERS.map((f) => {
              const active = filter === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={active}
                  data-active={active}
                  className="iff-seg-btn"
                  onClick={() => setFilter(f.key)}
                >
                  {f.dot && <span className="iff-seg-dot" style={{ background: f.dot }} />}
                  {f.label}
                  <span className="iff-seg-count">{counts[f.key] ?? 0}</span>
                </button>
              )
            })}
          </div>

          <div className="iff-divider" />

          <div className="iff-footer">
            <button type="button" className="iff-clear" onClick={clearAll} disabled={!hasActive}>
              <RotateCcw size={13} /> Clear all
            </button>
            <button type="button" className="iff-done" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
