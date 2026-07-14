'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force'
import { Building2, Info, Search, Tag, User, X } from 'lucide-react'
import type { GraphConversationRef, GraphLink, GraphNode, GraphNodeType, KnowledgeGraph } from '@/services/graph.service'

/** Physics node — a fresh copy of the read-model node that d3 mutates in place. */
interface SimNode extends SimulationNodeDatum {
  id: string
  type: GraphNodeType
  label: string
  sublabel: string | null
  weight: number
  r: number
}
interface SimEdge {
  id: string
  source: SimNode | string
  target: SimNode | string
  kind: GraphLink['kind']
  weight: number
  deterministic: boolean
  conversationId: string | null
}

/** Per-tick immutable snapshots rendered from state (never read sim refs in render). */
interface RenderNode {
  id: string
  type: GraphNodeType
  label: string
  sublabel: string | null
  weight: number
  r: number
  x: number
  y: number
}
interface RenderEdge {
  id: string
  kind: GraphLink['kind']
  weight: number
  deterministic: boolean
  sourceId: string
  targetId: string
  x1: number
  y1: number
  x2: number
  y2: number
}

const TYPE_META: Record<GraphNodeType, { color: string; label: string; icon: typeof User }> = {
  PERSON: { color: '#4F5CF4', label: 'Person', icon: User },
  COMPANY: { color: '#0EA5E9', label: 'Company', icon: Building2 },
  TOPIC: { color: '#8B5CF6', label: 'Topic', icon: Tag },
}

const TYPE_FILTERS: { key: GraphNodeType; label: string }[] = [
  { key: 'PERSON', label: 'People' },
  { key: 'COMPANY', label: 'Companies' },
  { key: 'TOPIC', label: 'Topics' },
]

function nodeRadius(type: GraphNodeType, weight: number): number {
  const base = type === 'PERSON' ? 8 : type === 'COMPANY' ? 7.5 : 6.5
  return Math.min(24, base + Math.sqrt(Math.max(0, weight - 1)) * 2.4)
}

export default function GraphExplorer({
  graph,
  initialFocus,
}: {
  graph: KnowledgeGraph
  initialFocus?: string | null
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 900, h: 620 })
  const [query, setQuery] = useState('')
  const [activeTypes, setActiveTypes] = useState<Set<GraphNodeType>>(
    () => new Set<GraphNodeType>(['PERSON', 'COMPANY', 'TOPIC']),
  )
  const [selectedId, setSelectedId] = useState<string | null>(initialFocus ?? null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [frame, setFrame] = useState<{ nodes: RenderNode[]; edges: RenderEdge[] }>({ nodes: [], edges: [] })

  // Adjacency (over the full graph — selection highlight ignores type filters so a
  // hidden neighbor is never silently dropped from the sidebar count).
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const n of graph.nodes) map.set(n.id, new Set())
    for (const l of graph.links) {
      map.get(l.source)?.add(l.target)
      map.get(l.target)?.add(l.source)
    }
    return map
  }, [graph])

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph])

  // Filtered view (by type). Edges survive only when BOTH endpoints are visible.
  const { viewNodes, viewLinks } = useMemo(() => {
    const visible = new Set(graph.nodes.filter((n) => activeTypes.has(n.type)).map((n) => n.id))
    return {
      viewNodes: graph.nodes.filter((n) => visible.has(n.id)),
      viewLinks: graph.links.filter((l) => visible.has(l.source) && visible.has(l.target)),
    }
  }, [graph, activeTypes])

  // Measure the canvas.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r && r.width > 0 && r.height > 0) setDims({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Live simulation state, held in refs so the per-tick re-render is cheap.
  const simRef = useRef<Simulation<SimNode, SimEdge> | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const dragRef = useRef<string | null>(null)

  // (Re)build the simulation whenever the visible graph or the canvas changes.
  useEffect(() => {
    const { w, h } = dims
    // Fresh copies — d3 mutates x/y/vx/vy, so never touch the read-model objects.
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]))
    const simNodes: SimNode[] = viewNodes.map((n) => {
      const p = prev.get(n.id)
      return {
        id: n.id,
        type: n.type,
        label: n.label,
        sublabel: n.sublabel,
        weight: n.weight,
        r: nodeRadius(n.type, n.weight),
        // Reuse prior positions so filter toggles don't teleport the layout.
        x: p?.x ?? w / 2 + (Math.random() - 0.5) * w * 0.6,
        y: p?.y ?? h / 2 + (Math.random() - 0.5) * h * 0.6,
      }
    })
    const simEdges: SimEdge[] = viewLinks.map((l) => ({
      id: l.id,
      source: l.source,
      target: l.target,
      kind: l.kind,
      weight: l.weight,
      deterministic: l.deterministic,
      conversationId: l.conversationId,
    }))

    const sim = forceSimulation<SimNode, SimEdge>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance((e) => 46 + 90 / (e.weight + 1))
          .strength(0.5),
      )
      .force('charge', forceManyBody<SimNode>().strength(-240))
      .force('center', forceCenter(w / 2, h / 2))
      .force('collide', forceCollide<SimNode>((d) => d.r + 6))
      .force('x', forceX(w / 2).strength(0.04))
      .force('y', forceY(h / 2).strength(0.04))
      .alpha(0.9)
      .alphaDecay(0.045)

    const snapshot = () => {
      const rn: RenderNode[] = simNodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        sublabel: n.sublabel,
        weight: n.weight,
        r: n.r,
        x: n.x ?? w / 2,
        y: n.y ?? h / 2,
      }))
      const re: RenderEdge[] = []
      for (const e of simEdges) {
        const s = typeof e.source === 'object' ? e.source : null
        const t = typeof e.target === 'object' ? e.target : null
        if (!s || !t) continue
        re.push({
          id: e.id,
          kind: e.kind,
          weight: e.weight,
          deterministic: e.deterministic,
          sourceId: s.id,
          targetId: t.id,
          x1: s.x ?? 0,
          y1: s.y ?? 0,
          x2: t.x ?? 0,
          y2: t.y ?? 0,
        })
      }
      setFrame({ nodes: rn, edges: re })
    }

    sim.on('tick', () => {
      // Keep nodes inside the canvas so nothing drifts off-screen on the demo.
      for (const n of simNodes) {
        n.x = Math.max(n.r + 4, Math.min(w - n.r - 4, n.x ?? w / 2))
        n.y = Math.max(n.r + 4, Math.min(h - n.r - 4, n.y ?? h / 2))
      }
      snapshot()
    })

    simRef.current = sim
    nodesRef.current = simNodes
    snapshot()

    return () => {
      sim.stop()
    }
  }, [viewNodes, viewLinks, dims])

  // Pointer drag: pin a node under the cursor and reheat the sim.
  function clientToSvg(e: React.PointerEvent): { x: number; y: number } {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    dragRef.current = id
    const n = nodesRef.current.find((x) => x.id === id)
    if (n) {
      n.fx = n.x
      n.fy = n.y
    }
    simRef.current?.alphaTarget(0.3).restart()
    setSelectedId(id)
  }
  function onCanvasPointerMove(e: React.PointerEvent) {
    const id = dragRef.current
    if (!id) return
    const n = nodesRef.current.find((x) => x.id === id)
    if (!n) return
    const { x, y } = clientToSvg(e)
    n.fx = x
    n.fy = y
  }
  function endDrag() {
    const id = dragRef.current
    if (!id) return
    const n = nodesRef.current.find((x) => x.id === id)
    if (n) {
      n.fx = null
      n.fy = null
    }
    dragRef.current = null
    simRef.current?.alphaTarget(0)
  }

  // Which nodes to emphasize: selection neighbors take priority; else search matches.
  const q = query.trim().toLowerCase()
  const searchMatches = useMemo(() => {
    if (!q) return null
    return new Set(graph.nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id))
  }, [graph.nodes, q])

  const selectedNeighbors = useMemo(
    () => (selectedId ? adjacency.get(selectedId) ?? new Set<string>() : null),
    [selectedId, adjacency],
  )

  function isEmphasized(id: string): boolean {
    if (selectedId) return id === selectedId || Boolean(selectedNeighbors?.has(id))
    if (searchMatches) return searchMatches.has(id)
    return true
  }
  function isDimmed(id: string): boolean {
    if (!selectedId && !searchMatches) return false
    return !isEmphasized(id)
  }

  const selectedNode = selectedId ? nodeById.get(selectedId) ?? null : null

  // Conversations linked to the selected node (via its incident edges).
  const selectedConversations: GraphConversationRef[] = useMemo(() => {
    if (!selectedId) return []
    const ids = new Set<string>()
    for (const l of graph.links) {
      if ((l.source === selectedId || l.target === selectedId) && l.conversationId) ids.add(l.conversationId)
    }
    return graph.conversations.filter((c) => ids.has(c.id))
  }, [selectedId, graph])

  const selectedNeighborNodes: GraphNode[] = useMemo(() => {
    if (!selectedNeighbors) return []
    return [...selectedNeighbors].map((id) => nodeById.get(id)).filter((n): n is GraphNode => Boolean(n))
      .sort((a, b) => b.weight - a.weight)
  }, [selectedNeighbors, nodeById])

  const toggleType = (t: GraphNodeType) =>
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      // Never allow an empty filter (blank canvas reads as broken).
      return next.size ? next : prev
    })

  const showLabel = (n: RenderNode): boolean =>
    n.type === 'COMPANY' ||
    n.r >= 12 ||
    n.id === selectedId ||
    n.id === hoverId ||
    Boolean(selectedNeighbors?.has(n.id)) ||
    Boolean(searchMatches?.has(n.id))

  return (
    <div className="graph-explorer">
      {/* Canvas */}
      <div className="graph-canvas-wrap">
        <div className="graph-toolbar">
          <div className="inbox-search" style={{ width: 220, padding: '7px 10px' }}>
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the graph…"
              aria-label="Search graph"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" style={{ display: 'inline-flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={13} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TYPE_FILTERS.map((f) => {
              const on = activeTypes.has(f.key)
              const meta = TYPE_META[f.key]
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleType(f.key)}
                  className="graph-chip"
                  aria-pressed={on}
                  style={{ opacity: on ? 1 : 0.45, borderColor: on ? meta.color : 'var(--border)' }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        <motion.div
          ref={wrapRef}
          className="graph-canvas"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClick={() => setSelectedId(null)}
        >
          <svg width={dims.w} height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`} style={{ display: 'block' }}>
            {/* Edges */}
            <g>
              {frame.edges.map((e) => {
                const active = !selectedId || e.sourceId === selectedId || e.targetId === selectedId
                const dim = selectedId ? !active : false
                return (
                  <line
                    key={e.id}
                    x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                    stroke={e.deterministic ? '#94A3B8' : '#C4B5FD'}
                    strokeWidth={Math.min(4, 1 + Math.log2(e.weight + 1))}
                    strokeDasharray={e.deterministic ? undefined : '4 4'}
                    strokeOpacity={dim ? 0.06 : 0.5}
                    strokeLinecap="round"
                  />
                )
              })}
            </g>
            {/* Nodes */}
            <g>
              {frame.nodes.map((n) => {
                const meta = TYPE_META[n.type]
                const dim = isDimmed(n.id)
                const sel = n.id === selectedId
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x ?? 0}, ${n.y ?? 0})`}
                    style={{ cursor: 'pointer', opacity: dim ? 0.22 : 1, transition: 'opacity 0.25s' }}
                    onPointerDown={(e) => onNodePointerDown(e, n.id)}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(n.id) }}
                    onPointerEnter={() => setHoverId(n.id)}
                    onPointerLeave={() => setHoverId((h) => (h === n.id ? null : h))}
                  >
                    {sel && <circle r={n.r + 6} fill="none" stroke={meta.color} strokeWidth={1.5} strokeOpacity={0.5} />}
                    <circle
                      r={n.r}
                      fill={meta.color}
                      fillOpacity={n.type === 'TOPIC' ? 0.9 : 1}
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                    {showLabel(n) && (
                      <text
                        x={0}
                        y={n.r + 12}
                        textAnchor="middle"
                        style={{
                          fontSize: 11,
                          fontWeight: sel ? 700 : 600,
                          fill: 'var(--text-primary)',
                          fontFamily: 'var(--font-sans)',
                          paintOrder: 'stroke',
                          stroke: 'var(--bg-base)',
                          strokeWidth: 3,
                          pointerEvents: 'none',
                        }}
                      >
                        {n.label.length > 22 ? n.label.slice(0, 21) + '…' : n.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Legend + honesty note */}
          <div className="graph-legend">
            {TYPE_FILTERS.map((f) => {
              const meta = TYPE_META[f.key]
              return (
                <span key={f.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: meta.color }} />
                  {meta.label}
                </span>
              )
            })}
            <span className="graph-legend-sep" />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#94A3B8" strokeWidth="2" /></svg>
              works at
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#C4B5FD" strokeWidth="2" strokeDasharray="3 3" /></svg>
              discusses
            </span>
            <span
              className="graph-legend-info"
              title="Company links are derived deterministically from each contact's email domain. Topic links are AI-inferred from conversation content — treat them as suggestions, not facts."
            >
              <Info size={13} />
            </span>
          </div>
        </motion.div>
      </div>

      {/* Detail sidebar */}
      <aside className="graph-sidebar">
        {selectedNode ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span
                style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: TYPE_META[selectedNode.type].color, color: '#fff',
                }}
              >
                {(() => { const Icon = TYPE_META[selectedNode.type].icon; return <Icon size={17} /> })()}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25, wordBreak: 'break-word' }}>{selectedNode.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {TYPE_META[selectedNode.type].label}
                  {selectedNode.sublabel ? ` · ${selectedNode.sublabel}` : ''}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>

            {selectedConversations.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="graph-sidebar-head">Linked conversations</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {selectedConversations.map((c) => (
                    <Link key={c.id} href={c.href} className="graph-conv-link">
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.contactName}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {selectedNeighborNodes.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="graph-sidebar-head">Connections · {selectedNeighborNodes.length}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {selectedNeighborNodes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setSelectedId(n.id)}
                      className="graph-chip"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_META[n.type].color }} />
                      {n.label.length > 20 ? n.label.slice(0, 19) + '…' : n.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedConversations.length === 0 && selectedNeighborNodes.length === 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
                No linked conversations recorded yet for this node.
              </p>
            )}
          </>
        ) : (
          <div>
            <div className="graph-sidebar-head">The graph</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
              People, the companies they work at, and the topics you discuss — built from your real Gmail. Click any node to trace its connections and jump to the source threads.
            </p>
            <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
              <Stat n={graph.stats.people} label="People" color={TYPE_META.PERSON.color} />
              <Stat n={graph.stats.companies} label="Companies" color={TYPE_META.COMPANY.color} />
              <Stat n={graph.stats.topics} label="Topics" color={TYPE_META.TOPIC.color} />
              <Stat n={graph.stats.edges} label="Links" color="var(--text-muted)" />
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
        {label}
      </div>
    </div>
  )
}
