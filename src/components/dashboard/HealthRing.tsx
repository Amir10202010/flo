'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Gauge } from 'lucide-react'
import { Reveal } from './Motion'

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--success)'
  if (score >= 60) return 'var(--accent)'
  if (score >= 40) return 'var(--attention)'
  return 'var(--hot)'
}

export function HealthRing({ score, size = 56 }: { score: number | null; size?: number }) {
  const reduced = useReducedMotion()
  const stroke = 5.5
  const r = (size - stroke) / 2
  const c = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={score === null ? 'No health score yet' : `Inbox health ${score} of 100`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border-light)" strokeWidth={stroke} />
      {score !== null && (
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          transform={`rotate(-90 ${c} ${c})`}
          initial={reduced ? { strokeDashoffset: 100 - score } : { strokeDashoffset: 100 }}
          animate={{ strokeDashoffset: 100 - score }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
        />
      )}
      <text
        x={c}
        y={c + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: size * 0.28, fontWeight: 700, fill: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
      >
        {score ?? '—'}
      </text>
    </svg>
  )
}

/** Executive tile: animated health ring + the factor dragging the score down. */
export default function HealthScoreCard({
  score,
  topFactor,
  delay = 0,
}: {
  score: number | null
  topFactor: string | null
  delay?: number
}) {
  return (
    <Reveal delay={delay} style={{ minWidth: 0 }}>
      <div className="widget" style={{ padding: '14px 16px', height: '100%', flexDirection: 'row', alignItems: 'center', gap: 13 }}>
        <HealthRing score={score} />
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            <Gauge size={12} />
            Inbox Health
          </span>
          <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
            {score === null
              ? 'Appears after your first sync'
              : topFactor
                ? `Held back by ${topFactor}`
                : 'Everything looks healthy'}
          </div>
        </div>
      </div>
    </Reveal>
  )
}
