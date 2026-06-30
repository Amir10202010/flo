import type { RiskLevel } from '@/types'

// Monochrome, like priority — risk level reads from contrast/weight, not colour.
// Critical is darkest/heaviest; low fades back. (A true error elsewhere may use
// red, but a risk score is a signal, not an error.)
const STYLES: Record<RiskLevel, { color: string; weight: number; label: string }> = {
  CRITICAL: { color: 'var(--text-primary)',   weight: 600, label: 'Critical' },
  HIGH:     { color: 'var(--text-secondary)', weight: 600, label: 'High' },
  MEDIUM:   { color: 'var(--text-secondary)', weight: 500, label: 'Medium' },
  LOW:      { color: 'var(--text-muted)',     weight: 500, label: 'Low' },
}

export default function RiskBadge({ level }: { level: RiskLevel }) {
  const s = STYLES[level]
  return (
    <span className="priority-badge" style={{ color: s.color, fontWeight: s.weight }}>
      {s.label} risk
    </span>
  )
}
