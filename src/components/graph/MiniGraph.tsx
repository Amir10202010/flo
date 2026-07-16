import Link from 'next/link'
import type { MiniGraphNeighbor } from '@/services/graph.service'

/**
 * Static radial mini-graph for a contact card — the contact centered, up to ~6
 * one-hop neighbors (companies + topics) on a ring. No physics: cheap to render
 * many in a list (same hand-rolled-SVG approach as src/components/charts/).
 * Links through to the full explorer focused on this contact.
 */

const COLOR: Record<MiniGraphNeighbor['type'], string> = {
  COMPANY: '#0EA5E9',
  TOPIC: '#8B5CF6',
}
const CENTER = '#4F5CF4'

export default function MiniGraph({
  contactId,
  contactName,
  neighbors,
  size = 52,
  interactive = true,
}: {
  contactId: string
  contactName: string
  neighbors: MiniGraphNeighbor[]
  size?: number
  /** When false, render a plain (non-link) SVG — e.g. inside a <button> where a
   *  nested <a> would be invalid HTML (the mobile client card). */
  interactive?: boolean
}) {
  const c = size / 2
  const ring = c - 6

  // No graph data yet — a muted single dot, not a link (nothing to explore).
  if (!neighbors.length) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="No graph links yet" role="img">
        <circle cx={c} cy={c} r={4} fill="var(--border)" />
      </svg>
    )
  }

  const shown = neighbors.slice(0, 6)
  const pts = shown.map((n, i) => {
    const angle = (i / shown.length) * Math.PI * 2 - Math.PI / 2
    return { ...n, x: c + Math.cos(angle) * ring, y: c + Math.sin(angle) * ring }
  })

  const summary = `${contactName} — ${shown.map((n) => n.label).join(', ')}`

  const svg = (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden="true">
      <g stroke="var(--border)" strokeWidth={1}>
        {pts.map((p) => (
          <line key={p.id} x1={c} y1={c} x2={p.x} y2={p.y} />
        ))}
      </g>
      {pts.map((p) => (
        <circle key={p.id} cx={p.x} cy={p.y} r={3.4} fill={COLOR[p.type]} stroke="#fff" strokeWidth={1} />
      ))}
      <circle cx={c} cy={c} r={5} fill={CENTER} stroke="#fff" strokeWidth={1.5} />
    </svg>
  )

  if (!interactive) {
    return (
      <span className="mini-graph-static" title={summary} style={{ display: 'inline-flex' }}>
        {svg}
      </span>
    )
  }

  return (
    <Link
      href={`/graph?focus=contact:${contactId}`}
      className="mini-graph-link"
      title={`Open ${contactName} in the knowledge graph · ${summary}`}
      aria-label={`Open ${contactName} in the knowledge graph`}
      onClick={(e) => e.stopPropagation()}
    >
      {svg}
    </Link>
  )
}
