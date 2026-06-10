'use client'

import { motion, useReducedMotion } from 'framer-motion'

export interface HeatmapData {
  rows: string[]
  cols: string[]
  cells: number[][]
  max: number
}

/** Weekday × time-of-day intensity grid ("when clients email you"). */
export default function Heatmap({ data }: { data: HeatmapData }) {
  const reduced = useReducedMotion()
  const { rows, cols, cells, max } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: `34px repeat(${cols.length}, 1fr)`, gap: 5 }}>
        <span />
        {cols.map((cLabel) => (
          <span key={cLabel} style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
            {cLabel}:00
          </span>
        ))}
      </div>

      {rows.map((rLabel, r) => (
        <motion.div
          key={rLabel}
          style={{ display: 'grid', gridTemplateColumns: `34px repeat(${cols.length}, 1fr)`, gap: 5 }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 + r * 0.05 }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{rLabel}</span>
          {cells[r].map((v, cIdx) => {
            const intensity = max > 0 ? v / max : 0
            return (
              <div
                key={cIdx}
                title={`${rLabel} ${cols[cIdx]}:00–${(parseInt(cols[cIdx], 10) + 4) % 24 || 24}:00 · ${v} ${v === 1 ? 'email' : 'emails'}`}
                style={{
                  height: 26,
                  borderRadius: 6,
                  background: v === 0 ? 'var(--bg-subtle)' : `rgba(79, 92, 244, ${0.1 + intensity * 0.78})`,
                  border: '1px solid var(--border-light)',
                  cursor: 'default',
                }}
              />
            )
          })}
        </motion.div>
      ))}

      {/* Scale legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span
            key={f}
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              background: f === 0 ? 'var(--bg-subtle)' : `rgba(79, 92, 244, ${0.1 + f * 0.78})`,
              border: '1px solid var(--border-light)',
            }}
          />
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>More</span>
      </div>
    </div>
  )
}
