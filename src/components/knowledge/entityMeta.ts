import { Building2, CalendarDays, FileText, Tag, User, type LucideIcon } from 'lucide-react'
import type { GraphNodeType } from '@/services/graph.service'

/**
 * The one shared visual vocabulary for knowledge node types — canvas, chips,
 * context panel and palette all read from here. Per the design system, these
 * hues appear only as small dots/icons and on canvas nodes, never as chip
 * fills or text colour.
 */
export const NODE_META: Record<GraphNodeType, { color: string; label: string; plural: string; icon: LucideIcon }> = {
  PERSON: { color: '#4F5CF4', label: 'Person', plural: 'People', icon: User },
  COMPANY: { color: '#0EA5E9', label: 'Company', plural: 'Companies', icon: Building2 },
  TOPIC: { color: '#8B5CF6', label: 'Topic', plural: 'Topics', icon: Tag },
  MEETING: { color: '#10B981', label: 'Meeting', plural: 'Meetings', icon: CalendarDays },
  NOTE: { color: '#64748B', label: 'Note', plural: 'Notes', icon: FileText },
}

/** Best-effort node type from a polymorphic ref (entity refs need the row). */
export function refPrefixType(ref: string): GraphNodeType | null {
  if (ref.startsWith('contact:')) return 'PERSON'
  if (ref.startsWith('meeting:')) return 'MEETING'
  if (ref.startsWith('note:')) return 'NOTE'
  return null // "entity:" may be COMPANY or TOPIC — resolved by the caller.
}
