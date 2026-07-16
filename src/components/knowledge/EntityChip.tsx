import Link from 'next/link'
import type { GraphNodeType } from '@/services/graph.service'
import { NODE_META } from './entityMeta'

/**
 * A linked knowledge entity — neutral outlined chip, type colour as the icon
 * only (design-system chip rule). Links into the graph focused on the node.
 */
export default function EntityChip({
  nodeRef,
  type,
  label,
  href,
}: {
  nodeRef: string
  type: GraphNodeType
  label: string
  /** Override destination (default: the graph focused on this node). */
  href?: string
}) {
  const meta = NODE_META[type]
  const Icon = meta.icon
  return (
    <Link
      href={href ?? `/knowledge?focus=${encodeURIComponent(nodeRef)}`}
      className="kn-chip"
      title={`${meta.label} · ${label}`}
    >
      <Icon size={11} style={{ color: meta.color, flexShrink: 0 }} />
      <span className="kn-chip-label">{label}</span>
    </Link>
  )
}
