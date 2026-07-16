'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force'
import { Building2, CalendarDays, Crosshair, FileText, Info, Maximize2, Minus, Plus, Search, Tag, User, X } from 'lucide-react'
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

/** View transform: screen = graph * k + (x, y). */
interface View {
  k: number
  x: number
  y: number
}

// Palette matches the app's light theme (same hues as the /clients mini-graph).
const TYPE_META: Record<GraphNodeType, { color: string; label: string; icon: typeof User }> = {
  PERSON: { color: '#4F5CF4', label: 'Person', icon: User },
  COMPANY: { color: '#0EA5E9', label: 'Company', icon: Building2 },
  TOPIC: { color: '#8B5CF6', label: 'Topic', icon: Tag },
  MEETING: { color: '#10B981', label: 'Meeting', icon: CalendarDays },
  NOTE: { color: '#64748B', label: 'Note', icon: FileText },
}

const EDGE_WORKS_AT = '#94A3B8'
const EDGE_DISCUSSED = '#C4B5FD'

const TYPE_FILTERS: { key: GraphNodeType; label: string }[] = [
  { key: 'PERSON', label: 'People' },
  { key: 'COMPANY', label: 'Companies' },
  { key: 'TOPIC', label: 'Topics' },
  { key: 'MEETING', label: 'Meetings' },
  { key: 'NOTE', label: 'Notes' },
]

const MIN_K = 0.2
const MAX_K = 4

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function nodeRadius(type: GraphNodeType, weight: number): number {
  const base = type === 'PERSON' ? 9 : type === 'COMPANY' ? 8.5 : 7
  return Math.min(28, base + Math.sqrt(Math.max(0, weight - 1)) * 2.6)
}

/** View transform that fits `nodes` into a w×h viewport, or centers one node. */
function computeFit(
  nodes: { id: string; x?: number; y?: number; r: number }[],
  w: number,
  h: number,
  focusId?: string | null,
): View | null {
  if (!nodes.length) return null
  if (focusId) {
    const n = nodes.find((x) => x.id === focusId)
    if (n) {
      const k = 1.4
      return { k, x: w / 2 - (n.x ?? 0) * k, y: h / 2 - (n.y ?? 0) * k }
    }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, (n.x ?? 0) - n.r)
    minY = Math.min(minY, (n.y ?? 0) - n.r)
    maxX = Math.max(maxX, (n.x ?? 0) + n.r)
    maxY = Math.max(maxY, (n.y ?? 0) + n.r)
  }
  const bw = Math.max(1, maxX - minX)
  const bh = Math.max(1, maxY - minY)
  const pad = 56
  const k = clamp(Math.min((w - pad) / bw, (h - pad) / bh), MIN_K, 1.4)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return { k, x: w / 2 - cx * k, y: h / 2 - cy * k }
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
    () => new Set<GraphNodeType>(['PERSON', 'COMPANY', 'TOPIC', 'MEETING', 'NOTE']),
  )
  const [selectedId, setSelectedId] = useState<string | null>(initialFocus ?? null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [frame, setFrame] = useState<{ nodes: RenderNode[]; edges: RenderEdge[] }>({ nodes: [], edges: [] })
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 })

  // Keep a live mirror of view so stable pointer/wheel handlers read the latest.
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])

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

  const simRef = useRef<Simulation<SimNode, SimEdge> | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const dragRef = useRef<string | null>(null)
  const panRef = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(false)
  // "Has the user zoomed/panned?" — a plain state flag (handlers call the setter;
  // the sim-build effect reads it to decide whether to auto-fit). Kept out of the
  // effect deps on purpose so a first interaction doesn't rebuild the layout.
  const [userMoved, setUserMoved] = useState(false)

  // Fit the whole graph into the viewport (or focus one node).
  const fitView = useCallback(
    (focusNodeId?: string | null) => {
      const v = computeFit(nodesRef.current, dims.w, dims.h, focusNodeId)
      if (v) setView(v)
    },
    [dims],
  )

  // (Re)build the simulation whenever the visible graph or the canvas changes.
  useEffect(() => {
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
        // Seed near the graph origin (0,0); the view transform centers it.
        x: p?.x ?? (Math.random() - 0.5) * 480,
        y: p?.y ?? (Math.random() - 0.5) * 480,
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
          .distance((e) => 130 + 70 / (e.weight + 1))
          .strength(0.22),
      )
      .force('charge', forceManyBody<SimNode>().strength(-900).distanceMax(1100))
      .force('collide', forceCollide<SimNode>((d) => d.r + 26).strength(1))
      .force('x', forceX(0).strength(0.018))
      .force('y', forceY(0).strength(0.018))
      .alpha(1)
      .alphaDecay(0.022)

    const snapshot = () => {
      const rn: RenderNode[] = simNodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        sublabel: n.sublabel,
        weight: n.weight,
        r: n.r,
        x: n.x ?? 0,
        y: n.y ?? 0,
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

    sim.on('tick', snapshot)

    // Pre-settle synchronously so the graph appears already laid-out (no long
    // corner-to-center drift), then let the internal timer finish gently.
    sim.tick(160)
    simRef.current = sim
    nodesRef.current = simNodes
    snapshot()

    // Auto-fit to the fresh layout unless the user has taken over the view.
    if (!userMoved) {
      const v = computeFit(simNodes, dims.w, dims.h, initialFocus ?? null)
      if (v) setView(v)
    }

    return () => {
      sim.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewNodes, viewLinks, dims])

  // ── Zoom (wheel, toward cursor) ────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setUserMoved(true)
      setView((v) => {
        const factor = Math.exp(-e.deltaY * 0.0018)
        const k = clamp(v.k * factor, MIN_K, MAX_K)
        const gx = (cx - v.x) / v.k
        const gy = (cy - v.y) / v.k
        return { k, x: cx - gx * k, y: cy - gy * k }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function zoomBy(factor: number) {
    setUserMoved(true)
    setView((v) => {
      const k = clamp(v.k * factor, MIN_K, MAX_K)
      const cx = dims.w / 2
      const cy = dims.h / 2
      const gx = (cx - v.x) / v.k
      const gy = (cy - v.y) / v.k
      return { k, x: cx - gx * k, y: cy - gy * k }
    })
  }

  // ── Pan (drag background) + node drag ──────────────────────────────────────
  function localPoint(e: React.PointerEvent) {
    const rect = wrapRef.current?.getBoundingClientRect()
    return { cx: e.clientX - (rect?.left ?? 0), cy: e.clientY - (rect?.top ?? 0) }
  }
  function toGraph(cx: number, cy: number) {
    const v = viewRef.current
    return { gx: (cx - v.x) / v.k, gy: (cy - v.y) / v.k }
  }

  function onCanvasPointerDown(e: React.PointerEvent) {
    // Background press → begin panning (node presses stopPropagation).
    panRef.current = { x: e.clientX, y: e.clientY }
    movedRef.current = false
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    dragRef.current = id
    movedRef.current = false
    const { cx, cy } = localPoint(e)
    const { gx, gy } = toGraph(cx, cy)
    const n = nodesRef.current.find((x) => x.id === id)
    if (n) {
      n.fx = gx
      n.fy = gy
    }
    simRef.current?.alphaTarget(0.25).restart()
    ;(e.currentTarget as unknown as Element).setPointerCapture?.(e.pointerId)
    setSelectedId(id)
  }
  function onCanvasPointerMove(e: React.PointerEvent) {
    const id = dragRef.current
    if (id) {
      movedRef.current = true
      const { cx, cy } = localPoint(e)
      const { gx, gy } = toGraph(cx, cy)
      const n = nodesRef.current.find((x) => x.id === id)
      if (n) {
        n.fx = gx
        n.fy = gy
      }
      return
    }
    const pan = panRef.current
    if (pan) {
      const dx = e.clientX - pan.x
      const dy = e.clientY - pan.y
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        movedRef.current = true
        setUserMoved(true)
        panRef.current = { x: e.clientX, y: e.clientY }
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
      }
    }
  }
  function endInteraction() {
    const id = dragRef.current
    if (id) {
      const n = nodesRef.current.find((x) => x.id === id)
      if (n) {
        n.fx = null
        n.fy = null
      }
      dragRef.current = null
      simRef.current?.alphaTarget(0)
    }
    panRef.current = null
  }
  function onCanvasClick() {
    // A click that wasn't a drag on the background clears the selection.
    if (!movedRef.current) setSelectedId(null)
  }

  // ── Emphasis (selection neighbors, else search matches) ────────────────────
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
    return [...selectedNeighbors]
      .map((id) => nodeById.get(id))
      .filter((n): n is GraphNode => Boolean(n))
      .sort((a, b) => b.weight - a.weight)
  }, [selectedNeighbors, nodeById])

  const toggleType = (t: GraphNodeType) =>
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next.size ? next : prev
    })

  // Labels appear when zoomed in enough, or for emphasized / important nodes.
  const labelThreshold = (n: RenderNode) => {
    if (isEmphasized(n.id) && (selectedId || searchMatches)) return true
    if (n.id === hoverId) return true
    if (n.type === 'COMPANY') return view.k >= 0.55
    if (n.r >= 14) return view.k >= 0.7
    return view.k >= 1.15
  }

  const anyActive = Boolean(selectedId || searchMatches)

  return (
    <div className="graph-explorer">
      <div className="graph-canvas-wrap">
        <div className="graph-toolbar">
          <div className="inbox-search" style={{ width: 230, padding: '7px 10px' }}>
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the graph…" aria-label="Search graph" />
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
              const Icon = meta.icon
              return (
                <button key={f.key} type="button" onClick={() => toggleType(f.key)} className="graph-chip" aria-pressed={on} style={{ opacity: on ? 1 : 0.4, borderColor: on ? meta.color : 'var(--border)' }}>
                  <Icon size={12} style={{ color: meta.color }} />
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
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={endInteraction}
          onPointerLeave={endInteraction}
          onClick={onCanvasClick}
        >
          <svg width={dims.w} height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`} style={{ display: 'block' }}>
            <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
              {/* Edges */}
              <g>
                {frame.edges.map((e) => {
                  const active = !anyActive || e.sourceId === selectedId || e.targetId === selectedId ||
                    Boolean(searchMatches && (searchMatches.has(e.sourceId) || searchMatches.has(e.targetId)))
                  const dim = anyActive && !active
                  return (
                    <line
                      key={e.id}
                      x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                      stroke={e.deterministic ? EDGE_WORKS_AT : EDGE_DISCUSSED}
                      strokeWidth={Math.min(3.5, 0.8 + Math.log2(e.weight + 1))}
                      strokeDasharray={e.deterministic ? undefined : '5 5'}
                      strokeOpacity={dim ? 0.07 : active && anyActive ? 0.9 : 0.4}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
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
                  const hov = n.id === hoverId
                  const Icon = meta.icon
                  const showIcon = n.r * view.k >= 13
                  const showLabel = labelThreshold(n)
                  const iconSize = n.r * 1.05
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x}, ${n.y})`}
                      style={{ cursor: 'pointer', opacity: dim ? 0.28 : 1, transition: 'opacity 0.25s' }}
                      onPointerDown={(e) => onNodePointerDown(e, n.id)}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(n.id) }}
                      onPointerEnter={() => setHoverId(n.id)}
                      onPointerLeave={() => setHoverId((h) => (h === n.id ? null : h))}
                    >
                      {/* soft glow */}
                      <circle r={n.r * (sel || hov ? 2 : 1.65)} fill={meta.color} opacity={sel ? 0.22 : hov ? 0.16 : 0.1} />
                      {/* selection ring */}
                      {sel && <circle r={n.r + 5} fill="none" stroke={meta.color} strokeWidth={2} strokeOpacity={0.9} vectorEffect="non-scaling-stroke" />}
                      <circle r={n.r} fill={meta.color} stroke="#FFFFFF" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                      {showIcon && (
                        <foreignObject x={-iconSize / 2} y={-iconSize / 2} width={iconSize} height={iconSize} style={{ pointerEvents: 'none', overflow: 'visible' }}>
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
                            <Icon size={Math.max(9, iconSize * 0.62)} strokeWidth={2.4} />
                          </div>
                        </foreignObject>
                      )}
                      {showLabel && (
                        <text
                          x={0}
                          y={n.r + 13}
                          textAnchor="middle"
                          style={{
                            fontSize: 11,
                            fontWeight: sel ? 700 : 600,
                            fill: dim ? 'var(--text-muted)' : 'var(--text-primary)',
                            fontFamily: 'var(--font-sans)',
                            paintOrder: 'stroke',
                            stroke: 'var(--bg-base)',
                            strokeWidth: 3.5,
                            strokeLinejoin: 'round',
                            pointerEvents: 'none',
                          }}
                        >
                          {n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            </g>
          </svg>

          {/* Zoom controls */}
          <div className="graph-zoom-controls">
            <button type="button" className="graph-zoom-btn" onClick={() => zoomBy(1.3)} title="Zoom in" aria-label="Zoom in"><Plus size={15} /></button>
            <button type="button" className="graph-zoom-btn" onClick={() => zoomBy(1 / 1.3)} title="Zoom out" aria-label="Zoom out"><Minus size={15} /></button>
            <button type="button" className="graph-zoom-btn" onClick={() => { setUserMoved(true); fitView(null) }} title="Fit graph" aria-label="Fit graph"><Maximize2 size={14} /></button>
            {selectedId && (
              <button type="button" className="graph-zoom-btn" onClick={() => { setUserMoved(true); fitView(selectedId) }} title="Center selection" aria-label="Center selection"><Crosshair size={14} /></button>
            )}
          </div>

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
              <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke={EDGE_WORKS_AT} strokeWidth="2" /></svg>
              works at
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke={EDGE_DISCUSSED} strokeWidth="2" strokeDasharray="3 3" /></svg>
              discusses
            </span>
            <span className="graph-legend-info" title="Company links are derived deterministically from each contact's email domain. Topic links are AI-inferred from conversation content — treat them as suggestions, not facts.">
              <Info size={13} />
            </span>
          </div>
        </motion.div>
      </div>

      {/* Detail inspector */}
      <aside className="graph-sidebar">
        {selectedNode ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: TYPE_META[selectedNode.type].color, color: '#FFFFFF' }}>
                {(() => { const Icon = TYPE_META[selectedNode.type].icon; return <Icon size={17} strokeWidth={2.4} /> })()}
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
                  {selectedNeighborNodes.map((n) => {
                    const Icon = TYPE_META[n.type].icon
                    return (
                      <button key={n.id} type="button" onClick={() => setSelectedId(n.id)} className="graph-chip" style={{ borderColor: 'var(--border)' }}>
                        <Icon size={11} style={{ color: TYPE_META[n.type].color }} />
                        {n.label.length > 20 ? n.label.slice(0, 19) + '…' : n.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {selectedConversations.length === 0 && selectedNeighborNodes.length === 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>No linked conversations recorded yet for this node.</p>
            )}
          </>
        ) : (
          <div>
            <div className="graph-sidebar-head">The graph</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
              People, the companies they work at, and the topics you discuss — built from your real Gmail. Scroll to zoom, drag to pan, click a node to trace its connections and jump to the source threads.
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
