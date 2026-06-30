import type { RiskLevel } from '@/types'

// Compact colour-coded text (no capsule). Only genuine risk wears colour; low
// risk stays muted so it doesn't compete.
const STYLES: Record<RiskLevel, { color: string; label: string }> = {
  CRITICAL: { color: 'var(--hot)', label: 'Critical' },
  HIGH: { color: '#D14E2E', label: 'High' },
  MEDIUM: { color: 'var(--attention)', label: 'Medium' },
  LOW: { color: 'var(--text-muted)', label: 'Low' },
}

export default function RiskBadge({ level }: { level: RiskLevel }) {
  const s = STYLES[level]
  return (
    <span className="priority-badge" style={{ color: s.color }}>
      {s.label} risk
    </span>
  )
}
