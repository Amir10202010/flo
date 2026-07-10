import type { RiskLevel } from '@/types'

// Relationship-health chip. Monochrome, like priority — reads from contrast/
// weight, not colour. "Going cold" is darkest/heaviest; "Healthy" fades back.
const STYLES: Record<RiskLevel, { color: string; weight: number; label: string }> = {
  CRITICAL: { color: 'var(--text-primary)',   weight: 600, label: 'Going cold' },
  HIGH:     { color: 'var(--text-secondary)', weight: 600, label: 'At risk' },
  MEDIUM:   { color: 'var(--text-secondary)', weight: 500, label: 'Watch' },
  LOW:      { color: 'var(--text-muted)',     weight: 500, label: 'Healthy' },
}

export default function RiskBadge({ level }: { level: RiskLevel }) {
  const s = STYLES[level]
  return (
    <span className="priority-badge" style={{ color: s.color, fontWeight: s.weight }}>
      {s.label}
    </span>
  )
}
