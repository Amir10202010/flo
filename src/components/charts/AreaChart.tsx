'use client'

import { useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { areaPath, smoothPath, toPoints } from './path'

export interface AreaPoint {
  label: string
  inbound: number
  outbound: number
}

const W = 600
const H = 180

/**
 * Dual-series area chart (inbound vs outbound volume) with a pointer-tracked
 * tooltip. Pure SVG — stretches to its container via preserveAspectRatio.
 */
export default function AreaChart({ data, height = 200 }: { data: AreaPoint[]; height?: number }) {
  const gid = useId().replace(/[:]/g, '')
  const reduced = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  if (data.length < 2) return null

  // Shared y-domain so the two series are visually comparable.
  const maxV = Math.max(1, ...data.map((d) => Math.max(d.inbound, d.outbound)))
  const inPts = toPoints(data.map((d) => d.inbound), W, H, 10, { min: 0, max: maxV })
  const outPts = toPoints(data.map((d) => d.outbound), W, H, 10, { min: 0, max: maxV })
  const n = data.length

  function onMove(e: React.PointerEvent) {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHover(Math.round(frac * (n - 1)))
  }

  const hoverLeftPct = hover !== null ? (hover / (n - 1)) * 100 : 0
  const tooltipOnLeft = hover !== null && hover > n / 2

  return (
    <div>
      <div
        ref={wrapRef}
        style={{ position: 'relative', height, touchAction: 'none' }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
          <defs>
            <linearGradient id={`in-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F5CF4" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#4F5CF4" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`out-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal guides */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--border-light)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}

          <motion.path
            d={areaPath(inPts, H)}
            fill={`url(#in-${gid})`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.35 }}
          />
          <motion.path
            d={areaPath(outPts, H)}
            fill={`url(#out-${gid})`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.45 }}
          />
          <motion.path
            d={smoothPath(outPts)}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15 }}
          />
          <motion.path
            d={smoothPath(inPts)}
            fill="none"
            stroke="#4F5CF4"
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        </svg>

        {/* Hover guide + tooltip */}
        {hover !== null && (
          <>
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${hoverLeftPct}%`,
                width: 1,
                background: 'rgba(79,92,244,0.35)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: tooltipOnLeft ? undefined : `calc(${hoverLeftPct}% + 10px)`,
                right: tooltipOnLeft ? `calc(${100 - hoverLeftPct}% + 10px)` : undefined,
                background: '#FFFFFF',
                border: '1px solid var(--border)',
                borderRadius: 10,
                boxShadow: 'var(--shadow-md)',
                padding: '8px 11px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                zIndex: 2,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{data[hover].label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: '#4F5CF4' }} />
                Received · <strong style={{ color: 'var(--text-primary)' }}>{data[hover].inbound}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: '#8B5CF6' }} />
                Sent · <strong style={{ color: 'var(--text-primary)' }}>{data[hover].outbound}</strong>
              </div>
            </div>
          </>
        )}
      </div>

      {/* X labels: first / middle / last */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5, color: 'var(--text-muted)' }}>
        <span>{data[0].label}</span>
        <span>{data[Math.floor(n / 2)].label}</span>
        <span>{data[n - 1].label}</span>
      </div>
    </div>
  )
}
