import { ChevronsUp, ChevronUp, Minus, ChevronDown, type LucideIcon } from 'lucide-react'
import { priorityMeta } from '@/lib/priority'
import type { PriorityLevel } from '@/types'

/** Monochrome priority glyph per level — the shape (not a colour) signals urgency. */
export const PRIORITY_ICON: Record<PriorityLevel, LucideIcon> = {
  HOT: ChevronsUp,
  ATTENTION: ChevronUp,
  COLD: Minus,
  SPAM: ChevronDown,
}

/**
 * Priority badge — a monochrome glyph + plain-language label (Urgent / High /
 * Normal / Low). Level reads from contrast + the glyph, never a loud colour.
 * Hover reveals what the level actually means.
 */
export default function PriorityBadge({ level }: { level: PriorityLevel }) {
  const m = priorityMeta(level)
  const Icon = PRIORITY_ICON[level] ?? Minus
  return (
    <span className={`priority-badge ${m.className}`} title={m.description}>
      <Icon size={13} style={{ flexShrink: 0 }} />
      {m.label}
    </span>
  )
}
