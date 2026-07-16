'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
import { Crosshair, Info, Maximize2, Minus, Plus, Search, X, type LucideIcon } from 'lucide-react'
import type { GraphLink, GraphNode, GraphNodeType } from '@/services/graph.service'
import { NODE_META } from '@/components/knowledge/entityMeta'

/**
 * The living canvas — d3-force physics rendered through our own SVG. Selection
 * is CONTROLLED (the Knowledge explorer owns it; the context panel reads it).
 * View changes triggered by buttons/selection animate with an eased lerp;
 * wheel/drag stay raw. Above MAX_VISIBLE nodes the weakest are trimmed and the
 * legend says so — search still finds everything.
 */

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
}

interface RenderNode {
  id: string
  type: GraphNodeType
  label: string
  weight: number
  r: number
  x: number
  y: number
}
interface RenderEdge {
  id: string
  weight: number
  deterministic: boolean
  sourceId: string
  targetId: string
  x1: number
  y1: number
  x2: number
  y2: number
}

interface View {
  k: number
  x: number
  y: number
}

const EDGE_SOLID = '#94A3B8'
const EDGE_AI = '#C4B5FD'

const TYPE_FILTERS: GraphNodeType[] = ['PERSON', 'COMPANY', 'TOPIC', 'MEETING', 'NOTE']

const MIN_K = 0.2
const MAX_K = 4
const MAX_VISIBLE = 600

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function nodeRadius(type: GraphNodeType, weight: number): number {
  const base = type === 'PERSON' ? 9 : type === 'COMPANY' ? 8.5 : type === 'MEETING' ? 8 : 7
  return Math.min(28, base + Math.sqrt(Math.max(0, weight - 1)) * 2.6)
}

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

/** One node — memoized so hover/selection only re-renders the nodes involved. */
const NodeG = memo(function NodeG({
  n,
  color,
  icon: Icon,
  sel,
  hov,
  dim,
  showIcon,
  showLabel,
  onDown,
  onPick,
  onEnter,
  onLeave,
}: {
  n: RenderNode
  color: string
  icon: LucideIcon
  sel: boolean
  hov: boolean
  dim: boolean
  showIcon: boolean
  showLabel: boolean
  onDown: (e: React.PointerEvent, id: string) => void
  onPick: (e: React.MouseEvent, id: string) => void
  onEnter: (id: string) => void
  onLeave: (id: string) => void
}) {
  const iconSize = n.r * 1.05
  return (
    <g
      transform={`translate(${n.x}, ${n.y})`}
      style={{ cursor: 'pointer', opacity: dim ? 0.28 : 1, transition: 'opacity 0.25s' }}
      onPointerDown={(e) => onDown(e, n.id)}
      onClick={(e) => onPick(e, n.id)}
      onPointerEnter={() => onEnter(n.id)}
      onPointerLeave={() => onLeave(n.id)}
    >
      <circle r={n.r * (sel || hov ? 2 : 1.65)} fill={color} opacity={sel ? 0.22 : hov ? 0.16 : 0.1} />
      {sel && <circle r={n.r + 5} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.9} vectorEffect="non-scaling-stroke" />}
      <circle r={n.r} fill={color} stroke="#FFFFFF" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
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
})

export default function GraphCanvas({
  nodes,
  links,
  selectedId,
  onSelect,
  initialFocus,
}: {
  nodes: GraphNode[]
  links: GraphLink[]
  selectedId: string | null
  onSelect: (ref: string | null) => void
  initialFocus?: string | null
}) {
  const reducedMotion = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 900, h: 620 })
  const [query, setQuery] = useState('')
  const [activeTypes, setActiveTypes] = useState<Set<GraphNodeType>>(() => new Set(TYPE_FILTERS))
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [frame, setFrame] = useState<{ nodes: RenderNode[]; edges: RenderEdge[] }>({ nodes: [], edges: [] })
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 })

  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])

  // ── Visible slice: type filter + weight-ranked trim guard ─────────────────
  const { viewNodes, viewLinks, trimmed } = useMemo(() => {
    let visible = nodes.filter((n) => activeTypes.has(n.type))
    let trimmedCount = 0
    if (visible.length > MAX_VISIBLE) {
      const keep = new Set(
        [...visible]
          .sort((a, b) => b.weight - a.weight)
          .slice(0, MAX_VISIBLE)
          .map((n) => n.id),
      )
      // The selected / deep-linked node always survives the trim.
      for (const pinned of [selectedId, initialFocus]) {
        if (pinned && visible.some((n) => n.id === pinned)) keep.add(pinned)
      }
      trimmedCount = visible.length - keep.size
      visible = visible.filter((n) => keep.has(n.id))
    }
    const ids = new Set(visible.map((n) => n.id))
    return {
      viewNodes: visible,
      viewLinks: links.filter((l) => ids.has(l.source) && ids.has(l.target)),
      trimmed: trimmedCount,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, activeTypes])

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const n of viewNodes) map.set(n.id, new Set())
    for (const l of viewLinks) {
      map.get(l.source)?.add(l.target)
      map.get(l.target)?.add(l.source)
    }
    return map
  }, [viewNodes, viewLinks])

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
  const [userMoved, setUserMoved] = useState(false)

  // ── Animated view transitions (buttons / selection; wheel stays raw) ──────
  const animRef = useRef<number | null>(null)
  const animateView = useCallback(
    (target: View, duration = 480) => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (reducedMotion) {
        setView(target)
        return
      }
      const from = { ...viewRef.current }
      const t0 = performance.now()
      const ease = (t: number) => 1 - Math.pow(1 - t, 3)
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / duration)
        const e = ease(p)
        setView({
          k: from.k + (target.k - from.k) * e,
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
        })
        animRef.current = p < 1 ? requestAnimationFrame(step) : null
      }
      animRef.current = requestAnimationFrame(step)
    },
    [reducedMotion],
  )
  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
  }, [])

  const fitView = useCallback(
    (focusNodeId?: string | null) => {
      const v = computeFit(nodesRef.current, dims.w, dims.h, focusNodeId)
      if (v) animateView(v)
    },
    [dims, animateView],
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

    let tickCount = 0
    const snapshot = () => {
      const rn: RenderNode[] = simNodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
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

    // Throttle React re-renders on large graphs: every 2nd tick is invisible
    // at 60fps but halves reconciliation work while the layout settles.
    const throttled = simNodes.length > 220
    sim.on('tick', () => {
      tickCount += 1
      if (!throttled || tickCount % 2 === 0) snapshot()
    })

    // Pre-settle synchronously so the graph appears already laid-out.
    sim.tick(160)
    simRef.current = sim
    nodesRef.current = simNodes
    snapshot()

    if (!userMoved) {
      const v = computeFit(simNodes, dims.w, dims.h, initialFocus ?? null)
      if (v) setView(v)
    }

    return () => {
      sim.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewNodes, viewLinks, dims])

  // When selection lands outside the comfortable center, glide to it.
  useEffect(() => {
    if (!selectedId) return
    const n = nodesRef.current.find((x) => x.id === selectedId)
    if (!n) return
    const v = viewRef.current
    const sx = (n.x ?? 0) * v.k + v.x
    const sy = (n.y ?? 0) * v.k + v.y
    const marginX = dims.w * 0.18
    const marginY = dims.h * 0.18
    if (sx < marginX || sx > dims.w - marginX || sy < marginY || sy > dims.h - marginY) {
      const k = Math.max(v.k, 0.9)
      animateView({ k, x: dims.w / 2 - (n.x ?? 0) * k, y: dims.h / 2 - (n.y ?? 0) * k })
    }
  }, [selectedId, dims, animateView])

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
    const v = viewRef.current
    const k = clamp(v.k * factor, MIN_K, MAX_K)
    const cx = dims.w / 2
    const cy = dims.h / 2
    const gx = (cx - v.x) / v.k
    const gy = (cy - v.y) / v.k
    animateView({ k, x: cx - gx * k, y: cy - gy * k }, 240)
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
    panRef.current = { x: e.clientX, y: e.clientY }
    movedRef.current = false
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onNodePointerDown = useCallback((e: React.PointerEvent, id: string) => {
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
  }, [])
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
    if (!movedRef.current) onSelect(null)
  }

  const onNodePick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      if (!movedRef.current) onSelect(id)
    },
    [onSelect],
  )
  const onNodeEnter = useCallback((id: string) => setHoverId(id), [])
  const onNodeLeave = useCallback((id: string) => setHoverId((h) => (h === id ? null : h)), [])

  // ── Emphasis (selection neighbors, else search matches) ────────────────────
  const q = query.trim().toLowerCase()
  const searchMatches = useMemo(() => {
    if (!q) return null
    return new Set(viewNodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id))
  }, [viewNodes, q])

  const selectedNeighbors = useMemo(
    () => (selectedId ? adjacency.get(selectedId) ?? new Set<string>() : null),
    [selectedId, adjacency],
  )

  const anyActive = Boolean(selectedId || searchMatches)

  function isEmphasized(id: string): boolean {
    if (selectedId) return id === selectedId || Boolean(selectedNeighbors?.has(id))
    if (searchMatches) return searchMatches.has(id)
    return true
  }
  function isDimmed(id: string): boolean {
    if (!selectedId && !searchMatches) return false
    return !isEmphasized(id)
  }

  const toggleType = (t: GraphNodeType) =>
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next.size ? next : prev
    })

  const labelThreshold = (n: RenderNode) => {
    if (isEmphasized(n.id) && anyActive) return true
    if (n.id === hoverId) return true
    if (n.type === 'COMPANY') return view.k >= 0.55
    if (n.r >= 14) return view.k >= 0.7
    return view.k >= 1.15
  }

  return (
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
          {TYPE_FILTERS.map((t) => {
            const on = activeTypes.has(t)
            const meta = NODE_META[t]
            const Icon = meta.icon
            return (
              <button key={t} type="button" onClick={() => toggleType(t)} className="graph-chip" aria-pressed={on} style={{ opacity: on ? 1 : 0.4, borderColor: on ? meta.color : 'var(--border)' }}>
                <Icon size={12} style={{ color: meta.color }} />
                {meta.plural}
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
            <g>
              {frame.edges.map((e) => {
                const active = !anyActive || e.sourceId === selectedId || e.targetId === selectedId ||
                  Boolean(searchMatches && (searchMatches.has(e.sourceId) || searchMatches.has(e.targetId)))
                const dim = anyActive && !active
                return (
                  <line
                    key={e.id}
                    x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                    stroke={e.deterministic ? EDGE_SOLID : EDGE_AI}
                    strokeWidth={Math.min(3.5, 0.8 + Math.log2(e.weight + 1))}
                    strokeDasharray={e.deterministic ? undefined : '5 5'}
                    strokeOpacity={dim ? 0.07 : active && anyActive ? 0.9 : 0.4}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}
            </g>
            <g>
              {frame.nodes.map((n) => {
                const meta = NODE_META[n.type]
                return (
                  <NodeG
                    key={n.id}
                    n={n}
                    color={meta.color}
                    icon={meta.icon}
                    sel={n.id === selectedId}
                    hov={n.id === hoverId}
                    dim={isDimmed(n.id)}
                    showIcon={n.r * view.k >= 13}
                    showLabel={labelThreshold(n)}
                    onDown={onNodePointerDown}
                    onPick={onNodePick}
                    onEnter={onNodeEnter}
                    onLeave={onNodeLeave}
                  />
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
          {TYPE_FILTERS.filter((t) => viewNodes.some((n) => n.type === t)).map((t) => {
            const meta = NODE_META[t]
            return (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: meta.color }} />
                {meta.label}
              </span>
            )
          })}
          <span className="graph-legend-sep" />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke={EDGE_SOLID} strokeWidth="2" /></svg>
            recorded
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke={EDGE_AI} strokeWidth="2" strokeDasharray="3 3" /></svg>
            AI-inferred
          </span>
          {trimmed > 0 && (
            <>
              <span className="graph-legend-sep" />
              <span style={{ color: 'var(--text-muted)' }}>showing the strongest {MAX_VISIBLE} · search finds the rest</span>
            </>
          )}
          <span className="graph-legend-info" title="Solid links are recorded facts (email domains, calendar attendance). Dashed links are AI-inferred from conversations, meetings and notes — treat them as suggestions.">
            <Info size={13} />
          </span>
        </div>
      </motion.div>
    </div>
  )
}
