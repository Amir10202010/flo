/** Shared SVG path math for the hand-rolled charts (no chart library). */

export interface Pt {
  x: number
  y: number
}

/**
 * Map a numeric series onto chart coordinates (y inverted, padded).
 * Pass `domain` to pin the y-scale (e.g. shared across two series).
 */
export function toPoints(
  data: number[],
  width: number,
  height: number,
  pad = 6,
  domain?: { min: number; max: number },
): Pt[] {
  if (data.length === 0) return []
  if (data.length === 1) return [{ x: width / 2, y: height / 2 }]
  const max = domain?.max ?? Math.max(...data)
  const min = domain?.min ?? Math.min(...data)
  const span = max - min || 1
  const innerH = height - pad * 2
  return data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: max === min ? height - pad : pad + (1 - (v - min) / span) * innerH,
  }))
}

/** Smooth line through points using quadratic curves to segment midpoints. */
export function smoothPath(points: Pt[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2
    const my = (points[i].y + points[i + 1].y) / 2
    d += ` Q ${points[i].x} ${points[i].y} ${mx} ${my}`
  }
  const last = points[points.length - 1]
  d += ` T ${last.x} ${last.y}`
  return d
}

/** Close a smooth line down to the baseline for gradient area fills. */
export function areaPath(points: Pt[], height: number): string {
  if (points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${smoothPath(points)} L ${last.x} ${height} L ${first.x} ${height} Z`
}
