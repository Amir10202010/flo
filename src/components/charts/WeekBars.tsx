'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { formatHours } from '@/lib/time'

export interface WeekBarItem {
  label: string
  hours: number | null
}

/** Vertical weekly bars for the response-time trend (lower is better). */
export default function WeekBars({ items, height = 150 }: { items: WeekBarItem[]; height?: number }) {
  const reduced = useReducedMotion()
  const max = Math.max(1, ...items.map((i) => i.hours ?? 0))

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 18, height: height + 42 }}>
      {items.map((it, i) => {
        const frac = it.hours !== null ? Math.max(0.04, it.hours / max) : 0
        const isLast = i === items.length - 1
        return (
          <div key={it.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: it.hours !== null ? 'var(--text-primary)' : 'var(--text-muted)', marginBottom: 6 }}>
              {it.hours !== null ? formatHours(it.hours) : '–'}
            </span>
            <div style={{ flex: 1, width: '100%', maxWidth: 46, display: 'flex', alignItems: 'flex-end', margin: '0 auto' }}>
              <motion.div
                style={{
                  width: '100%',
                  borderRadius: '8px 8px 4px 4px',
                  background: isLast
                    ? 'linear-gradient(180deg, #4F5CF4, #6D44F5)'
                    : 'var(--bg-elevated)',
                  border: isLast ? 'none' : '1px solid var(--border-light)',
                }}
                initial={reduced ? { height: `${frac * 100}%` } : { height: 0 }}
                animate={{ height: `${frac * 100}%` }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 + i * 0.08 }}
              />
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8, whiteSpace: 'nowrap' }}>{it.label}</span>
          </div>
        )
      })}
    </div>
  )
}
