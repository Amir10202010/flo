import { priorityMeta } from '@/lib/priority'
import type { PriorityLevel } from '@/types'

/**
 * Priority badge — dot + plain-language label (Urgent / High / Normal / Low).
 * Hover reveals what the level actually means.
 */
export default function PriorityBadge({ level }: { level: PriorityLevel }) {
  const m = priorityMeta(level)
  return (
    <span className={`priority-badge ${m.className}`} title={m.description}>
      <span className="priority-dot" aria-hidden />
      {m.label}
    </span>
  )
}
