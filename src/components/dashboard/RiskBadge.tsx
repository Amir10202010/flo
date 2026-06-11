import type { RiskLevel } from '@/types'

const STYLES: Record<RiskLevel, { color: string; bg: string; border: string; label: string }> = {
  CRITICAL: { color: 'var(--hot)', bg: 'var(--hot-dim)', border: 'var(--hot-border)', label: 'Critical' },
  HIGH: { color: '#D14E2E', bg: 'rgba(224, 89, 59, 0.08)', border: 'rgba(224, 89, 59, 0.25)', label: 'High' },
  MEDIUM: { color: 'var(--attention)', bg: 'var(--attention-dim)', border: 'var(--attention-border)', label: 'Medium' },
  LOW: { color: 'var(--success)', bg: 'var(--success-dim)', border: 'var(--success-border)', label: 'Low' },
}

export default function RiskBadge({ level }: { level: RiskLevel }) {
  const s = STYLES[level]
  return (
    <span
      className="priority-badge"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      <span className="priority-dot" aria-hidden />
      {s.label} risk
    </span>
  )
}
