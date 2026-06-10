'use client'

import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Reveal } from './Motion'
import Sparkline from './Sparkline'

export type StatTone = 'default' | 'critical' | 'warning' | 'success'

const VALUE_COLOR: Record<StatTone, string> = {
  default: 'var(--text-primary)',
  critical: 'var(--hot)',
  warning: 'var(--attention)',
  success: 'var(--success)',
}

function TrendChip({ deltaPct, upIsGood }: { deltaPct: number | null; upIsGood: boolean | null }) {
  if (deltaPct === null) return null
  const up = deltaPct > 0
  const flat = deltaPct === 0
  const good = upIsGood === null ? null : up === upIsGood
  const color = flat || good === null ? 'var(--text-muted)' : good ? 'var(--success)' : 'var(--hot)'
  const bg = flat || good === null ? 'var(--bg-subtle)' : good ? 'var(--success-dim)' : 'var(--hot-dim)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 10.5,
        fontWeight: 700,
        color,
        background: bg,
        borderRadius: 6,
        padding: '2px 6px',
        whiteSpace: 'nowrap',
      }}
    >
      {!flat && (up ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
      {up ? '+' : ''}{deltaPct}%
    </span>
  )
}

/**
 * Executive overview tile. Trend chips only appear for metrics with an honest
 * week-over-week baseline; others show a factual breakdown line instead.
 */
export default function StatCard({
  label,
  icon,
  value,
  sub,
  tone = 'default',
  trend,
  spark,
  delay = 0,
}: {
  label: string
  icon?: ReactNode
  value: string
  sub?: string | null
  tone?: StatTone
  trend?: { deltaPct: number | null; upIsGood: boolean | null }
  spark?: number[]
  delay?: number
}) {
  return (
    <Reveal delay={delay} style={{ minWidth: 0 }}>
      <div
        className="widget"
        style={{ padding: '14px 16px', height: '100%', gap: 0, justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {icon}
            {label}
          </span>
          {trend && <TrendChip deltaPct={trend.deltaPct} upIsGood={trend.upIsGood} />}
        </div>

        <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: VALUE_COLOR[tone] }}>
          {value}
        </div>

        {sub && (
          <div style={{ marginTop: 7, fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub}
          </div>
        )}

        {spark && spark.length > 1 && (
          <div style={{ marginTop: 10, marginBottom: -2 }}>
            <Sparkline data={spark} height={30} />
          </div>
        )}
      </div>
    </Reveal>
  )
}
