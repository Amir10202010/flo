'use client'

import Link from 'next/link'
import {
  ArrowRight,
  CircleCheck,
  Clock,
  Lightbulb,
  Mail,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import type { InsightItem } from '@/services/dashboard.service'
import WidgetShell from './WidgetShell'

const TONE: Record<InsightItem['tone'], { color: string; bg: string; border: string }> = {
  critical: { color: 'var(--hot)', bg: 'var(--hot-dim)', border: 'var(--hot-border)' },
  warning: { color: 'var(--attention)', bg: 'var(--attention-dim)', border: 'var(--attention-border)' },
  info: { color: 'var(--accent)', bg: 'var(--accent-dim)', border: 'rgba(79,92,244,0.2)' },
  positive: { color: 'var(--success)', bg: 'var(--success-dim)', border: 'var(--success-border)' },
}

const ICONS: Record<InsightItem['icon'], React.ReactNode> = {
  risk: <TriangleAlert size={13} />,
  reply: <Mail size={13} />,
  followup: <Target size={13} />,
  'trend-up': <TrendingUp size={13} />,
  'trend-down': <TrendingDown size={13} />,
  new: <Sparkles size={13} />,
  check: <CircleCheck size={13} />,
  time: <Clock size={13} />,
}

export function InsightCard({ insight }: { insight: InsightItem }) {
  const t = TONE[insight.tone]
  const body = (
    <div
      style={{
        display: 'flex',
        gap: 11,
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--border-light)',
        background: 'var(--bg-subtle)',
        transition: 'border-color 0.15s, background 0.15s',
        minWidth: 0,
        height: '100%',
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: t.bg,
          color: t.color,
          border: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {ICONS[insight.icon]}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>{insight.title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{insight.description}</div>
        {insight.cta && insight.href && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: 'var(--accent)', marginTop: 7 }}>
            {insight.cta}
            <ArrowRight size={12} />
          </span>
        )}
      </div>
    </div>
  )

  return insight.href ? (
    <Link href={insight.href} style={{ textDecoration: 'none', display: 'block', minWidth: 0 }}>
      {body}
    </Link>
  ) : (
    body
  )
}

/** Smart Insights — plain-language conclusions the AI + heuristics draw from your data. */
export default function SmartInsights({ insights }: { insights: InsightItem[] }) {
  return (
    <WidgetShell
      icon={<Lightbulb size={14} />}
      title="Smart Insights"
      sub="What changed and what needs you"
      status="live"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '13px 14px 14px' }}>
        {insights.map((ins) => (
          <InsightCard key={ins.id} insight={ins} />
        ))}
      </div>
    </WidgetShell>
  )
}
