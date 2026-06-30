import { priorityMeta } from '@/lib/priority'
import type { PriorityLevel } from '@/types'

/**
 * Priority badge — plain-language label (Urgent / High / Normal / Low). The
 * label colour already encodes the level, so no leading dot. Hover reveals what
 * the level actually means.
 */
export default function PriorityBadge({ level }: { level: PriorityLevel }) {
  const m = priorityMeta(level)
  return (
    <span className={`priority-badge ${m.className}`} title={m.description}>
      {m.label}
    </span>
  )
}
