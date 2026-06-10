'use client'

import { motion, useReducedMotion } from 'framer-motion'

export interface HBarItem {
  label: string
  value: number
  color?: string
}

/** Horizontal bar list — used for risk distribution and top contacts. */
export default function HBars({ items, suffix = '' }: { items: HBarItem[]; suffix?: string }) {
  const reduced = useReducedMotion()
  const max = Math.max(1, ...items.map((i) => i.value))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, i) => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span
            style={{
              width: 86,
              flexShrink: 0,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={it.label}
          >
            {it.label}
          </span>
          <div style={{ flex: 1, height: 8, borderRadius: 5, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <motion.div
              style={{ height: '100%', borderRadius: 5, background: it.color ?? 'var(--accent)' }}
              initial={reduced ? { width: `${(it.value / max) * 100}%` } : { width: 0 }}
              animate={{ width: `${(it.value / max) * 100}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.06 }}
            />
          </div>
          <span style={{ width: 44, textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
            {it.value}{suffix}
          </span>
        </div>
      ))}
    </div>
  )
}
