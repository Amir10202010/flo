'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { GraphNode, GraphNodeType } from '@/services/graph.service'
import { NODE_META } from './entityMeta'

/**
 * The mobile knowledge experience — browse-first, not a shrunken canvas:
 * search + type filter over the same graph data, each row opening the full
 * context sheet. Rows are weight-ranked so the strongest relationships lead.
 */

const TYPE_ORDER: GraphNodeType[] = ['PERSON', 'COMPANY', 'TOPIC', 'MEETING', 'NOTE']
const MAX_ROWS = 80

export default function KnowledgeBrowse({
  nodes,
  onOpen,
}: {
  nodes: GraphNode[]
  onOpen: (ref: string) => void
}) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<GraphNodeType | null>(null)

  const counts = useMemo(() => {
    const map = new Map<GraphNodeType, number>()
    for (const n of nodes) map.set(n.type, (map.get(n.type) ?? 0) + 1)
    return map
  }, [nodes])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return nodes
      .filter((n) => (type ? n.type === type : true))
      .filter((n) => (q ? n.label.toLowerCase().includes(q) || n.sublabel?.toLowerCase().includes(q) : true))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_ROWS)
  }, [nodes, query, type])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
      <div className="inbox-search" style={{ padding: '9px 12px' }}>
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people, companies, topics…" aria-label="Search knowledge" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" style={{ display: 'inline-flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={13} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        <button type="button" className="graph-chip" onClick={() => setType(null)} aria-pressed={type === null} style={{ opacity: type === null ? 1 : 0.5, flexShrink: 0 }}>
          All
        </button>
        {TYPE_ORDER.filter((t) => (counts.get(t) ?? 0) > 0).map((t) => {
          const meta = NODE_META[t]
          const Icon = meta.icon
          const on = type === t
          return (
            <button key={t} type="button" className="graph-chip" onClick={() => setType(on ? null : t)} aria-pressed={on} style={{ opacity: on || type === null ? 1 : 0.5, borderColor: on ? meta.color : 'var(--border)', flexShrink: 0 }}>
              <Icon size={12} style={{ color: meta.color }} />
              {meta.plural}
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{counts.get(t)}</span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
        {rows.map((n) => {
          const meta = NODE_META[n.type]
          const Icon = meta.icon
          return (
            <button key={n.id} type="button" className="kn-browse-row" onClick={() => onOpen(n.id)}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: meta.color, color: '#fff' }}>
                <Icon size={14} strokeWidth={2.4} />
              </span>
              <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.label}
                </span>
                {n.sublabel && (
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.sublabel}
                  </span>
                )}
              </span>
            </button>
          )
        })}
        {rows.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 4px', textAlign: 'center' }}>
            Nothing matches — try a different search.
          </p>
        )}
      </div>
    </div>
  )
}
