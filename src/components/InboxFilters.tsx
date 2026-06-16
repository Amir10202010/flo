'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { CATEGORY_META, EMAIL_CATEGORIES } from '@/lib/categories'
import type { EmailCategory } from '@/types'

export type Filter = 'ALL' | 'HOT' | 'ATTENTION' | 'AWAITING'
export type CatFilter = 'ALL' | EmailCategory
export type RiskFilter = 'ALL' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type SentFilter = 'ALL' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
export type Sort = 'priority' | 'recent' | 'oldest'

const CAT_FILTERS: { key: CatFilter; label: string; dot?: string }[] = [
  { key: 'ALL', label: 'All mail' },
  ...EMAIL_CATEGORIES.map((c) => ({ key: c as CatFilter, label: CATEGORY_META[c].label, dot: CATEGORY_META[c].color })),
]

const PRIORITY_FILTERS: { key: Filter; label: string; dot?: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'HOT', label: 'Urgent', dot: 'var(--hot)' },
  { key: 'ATTENTION', label: 'High', dot: 'var(--attention)' },
  { key: 'AWAITING', label: 'Awaiting', dot: 'var(--accent)' },
]

const RISK_FILTERS: { key: RiskFilter; label: string; dot?: string }[] = [
  { key: 'ALL', label: 'Any' },
  { key: 'MEDIUM', label: 'Medium+', dot: 'var(--attention)' },
  { key: 'HIGH', label: 'High+', dot: 'var(--hot)' },
  { key: 'CRITICAL', label: 'Critical', dot: 'var(--hot)' },
]

const SENT_FILTERS: { key: SentFilter; label: string; dot?: string }[] = [
  { key: 'ALL', label: 'Any' },
  { key: 'POSITIVE', label: 'Positive', dot: 'var(--cold)' },
  { key: 'NEUTRAL', label: 'Neutral', dot: 'var(--text-muted)' },
  { key: 'NEGATIVE', label: 'Negative', dot: 'var(--hot)' },
]

const SORT_OPTIONS: { key: Sort; label: string }[] = [
  { key: 'priority', label: 'Priority' },
  { key: 'recent', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
]

/**
 * Inbox filter control: a single "Filters" button opening a popover with
 * category, priority, risk, sentiment and sort pickers. Presentational — all
 * state lives in the parent (InboxList); selections apply live (no Apply step).
 */
export default function InboxFilters({
  filter,
  setFilter,
  catFilter,
  setCatFilter,
  risk,
  setRisk,
  sentiment,
  setSentiment,
  sort,
  setSort,
  counts,
  catCounts,
}: {
  filter: Filter
  setFilter: (f: Filter) => void
  catFilter: CatFilter
  setCatFilter: (c: CatFilter) => void
  risk: RiskFilter
  setRisk: (r: RiskFilter) => void
  sentiment: SentFilter
  setSentiment: (s: SentFilter) => void
  sort: Sort
  setSort: (s: Sort) => void
  counts: Record<Filter, number>
  catCounts: Record<CatFilter, number>
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  const activeCount =
    (catFilter !== 'ALL' ? 1 : 0) +
    (filter !== 'ALL' ? 1 : 0) +
    (risk !== 'ALL' ? 1 : 0) +
    (sentiment !== 'ALL' ? 1 : 0)
  const hasActive = activeCount > 0 || sort !== 'priority'

  function clearAll() {
    setCatFilter('ALL')
    setFilter('ALL')
    setRisk('ALL')
    setSentiment('ALL')
    setSort('priority')
  }

  return (
    <div className="inbox-filters" ref={rootRef}>
      <button
        type="button"
        className={`inbox-filters-btn${hasActive ? ' active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Filter and sort"
      >
        <SlidersHorizontal size={15} />
        Filters
        {activeCount > 0 && <span className="inbox-filters-badge">{activeCount}</span>}
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
            {PRIORITY_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                data-active={filter === f.key}
                className="iff-seg-btn"
                onClick={() => setFilter(f.key)}
              >
                {f.dot && <span className="iff-seg-dot" style={{ background: f.dot }} />}
                {f.label}
                <span className="iff-seg-count">{counts[f.key] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="iff-divider" />

          <div className="iff-section-label">Risk</div>
          <div className="iff-seg">
            {RISK_FILTERS.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={risk === r.key}
                data-active={risk === r.key}
                className="iff-seg-btn"
                onClick={() => setRisk(r.key)}
              >
                {r.dot && <span className="iff-seg-dot" style={{ background: r.dot }} />}
                {r.label}
              </button>
            ))}
          </div>

          <div className="iff-divider" />

          <div className="iff-section-label">Sentiment</div>
          <div className="iff-seg">
            {SENT_FILTERS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={sentiment === s.key}
                data-active={sentiment === s.key}
                className="iff-seg-btn"
                onClick={() => setSentiment(s.key)}
              >
                {s.dot && <span className="iff-seg-dot" style={{ background: s.dot }} />}
                {s.label}
              </button>
            ))}
          </div>

          <div className="iff-divider" />

          <div className="iff-section-label">Sort</div>
          <div className="iff-seg">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={sort === s.key}
                data-active={sort === s.key}
                className="iff-seg-btn"
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            ))}
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
