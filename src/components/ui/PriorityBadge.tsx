import type { PriorityLevel } from '@/types'

const LABEL: Record<PriorityLevel, string> = {
  HOT: 'HOT',
  ATTENTION: 'ATTENTION',
  COLD: 'COLD',
  SPAM: 'SPAM',
}

const CLS: Record<PriorityLevel, string> = {
  HOT: 'priority-hot',
  ATTENTION: 'priority-attention',
  COLD: 'priority-cold',
  SPAM: 'priority-spam',
}

export default function PriorityBadge({ level }: { level: PriorityLevel }) {
  return <span className={`priority-badge ${CLS[level]}`}>{LABEL[level]}</span>
}
