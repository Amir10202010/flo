'use client'

import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { smoothPath, areaPath, toPoints } from '@/components/charts/path'

/** Tiny trend line for stat cards. Renders flat baseline for empty/zero data. */
export default function Sparkline({
  data,
  height = 32,
  stroke = 'var(--accent)',
}: {
  data: number[]
  height?: number
  stroke?: string
}) {
  const gid = useId().replace(/[:]/g, '')
  const reduced = useReducedMotion()
  const W = 200
  const H = 40
  const points = toPoints(data, W, H, 4)
  const line = smoothPath(points)
  const area = areaPath(points, H)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sp-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.16" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#sp-${gid})`}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.3 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
      />
    </svg>
  )
}
