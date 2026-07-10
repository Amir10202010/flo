import type { PriorityLevel } from '@/types'

/**
 * Single source of truth for how priority levels are presented across the UI.
 *
 * The DB enum stays HOT / ATTENTION / COLD / SPAM (see priority.engine.ts),
 * but users see a plain-language urgency scale instead of internal codenames:
 *
 *   HOT       → Urgent  — act now: client waiting, fresh activity, or churn risk
 *   ATTENTION → High    — should be handled today
 *   COLD      → Normal  — active, not time-critical
 *   SPAM      → Low     — quiet or low-value thread
 */
export const PRIORITY_META: Record<
  PriorityLevel,
  { label: string; className: string; color: string; description: string }
> = {
  HOT: {
    label: 'Urgent',
    className: 'priority-hot',
    color: 'var(--hot)',
    description: 'Needs action now — someone waiting, fresh activity, or going cold',
  },
  ATTENTION: {
    label: 'High',
    className: 'priority-attention',
    color: 'var(--attention)',
    description: 'Should be handled today',
  },
  COLD: {
    label: 'Normal',
    className: 'priority-cold',
    color: 'var(--cold)',
    description: 'Active, but not time-critical',
  },
  SPAM: {
    label: 'Low',
    className: 'priority-spam',
    color: 'var(--spam-text)',
    description: 'Quiet or low-value thread',
  },
}

export function priorityMeta(level: string) {
  return PRIORITY_META[level as PriorityLevel] ?? PRIORITY_META.SPAM
}
