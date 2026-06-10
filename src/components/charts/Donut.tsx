'use client'

import { motion, useReducedMotion } from 'framer-motion'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

/**
 * Donut distribution chart built from stroked circles (pathLength=100 trick),
 * with an animated sweep and a legend column.
 */
export default function Donut({
  segments,
  size = 148,
  centerLabel,
}: {
  segments: DonutSegment[]
  size?: number
  centerLabel?: string
}) {
  const reduced = useReducedMotion()
  const total = segments.reduce((a, s) => a + s.value, 0)
  const strokeW = 13
  const r = (size - strokeW) / 2
  const c = size / 2
  const gap = segments.length > 1 ? 1.6 : 0

  const fracs = segments.map((s) => (total > 0 ? (s.value / total) * 100 : 0))
  const arcs = segments.map((s, i) => ({
    ...s,
    frac: fracs[i],
    start: fracs.slice(0, i).reduce((a, b) => a + b, 0),
  }))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={strokeW} />
          {arcs.map((a, i) => {
            const visible = Math.max(0, a.frac - gap)
            if (visible <= 0) return null
            return (
              <motion.circle
                key={a.label}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={strokeW}
                strokeLinecap={arcs.length > 1 ? 'butt' : 'round'}
                pathLength={100}
                transform={`rotate(-90 ${c} ${c})`}
                initial={reduced ? { strokeDasharray: `${visible} ${100 - visible}`, strokeDashoffset: -a.start } : { strokeDasharray: `0 100`, strokeDashoffset: 0 }}
                animate={{ strokeDasharray: `${visible} ${100 - visible}`, strokeDashoffset: -a.start }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 + i * 0.06 }}
              />
            )
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>{total}</span>
          {centerLabel && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>{centerLabel}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 130, flex: 1 }}>
        {arcs.map((a) => (
          <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: a.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.value}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, width: 34, textAlign: 'right' }}>
              {total > 0 ? Math.round((a.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
