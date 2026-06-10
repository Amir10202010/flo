/**
 * Small date helpers shared by the metrics services.
 *
 * All relative strings are computed SERVER-SIDE (inside services / server
 * components) and passed to client widgets as plain strings — never compute
 * them during a client render, or SSR/CSR clock skew causes hydration
 * mismatches.
 */

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/** "just now" · "5m ago" · "3h ago" · "4d ago" · "3w ago" · "2mo ago" */
export function timeAgo(input: Date | string | null | undefined, now = Date.now()): string | null {
  if (!input) return null
  const t = typeof input === 'string' ? new Date(input).getTime() : input.getTime()
  if (!Number.isFinite(t)) return null
  const diff = Math.max(0, now - t)
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`
  if (diff < 30 * DAY) return `${Math.floor(diff / (7 * DAY))}w ago`
  return `${Math.floor(diff / (30 * DAY))}mo ago`
}

/** Compact wait duration: "2h" · "3d" · "2w" — for "waiting 3d" chips. */
export function waitDuration(input: Date | string | null | undefined, now = Date.now()): string | null {
  if (!input) return null
  const t = typeof input === 'string' ? new Date(input).getTime() : input.getTime()
  if (!Number.isFinite(t)) return null
  const diff = Math.max(0, now - t)
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MINUTE))}m`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`
  if (diff < 14 * DAY) return `${Math.floor(diff / DAY)}d`
  return `${Math.floor(diff / (7 * DAY))}w`
}

export function hoursSince(input: Date | string, now = Date.now()): number {
  const t = typeof input === 'string' ? new Date(input).getTime() : input.getTime()
  return (now - t) / HOUR
}

export function daysAgoDate(days: number, now = Date.now()): Date {
  return new Date(now - days * DAY)
}

/** Local YYYY-MM-DD bucket key. */
export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Jun 10" — axis labels. */
export function shortDate(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`
}

/** "Tue" — weekday label. */
export function weekdayName(d: Date): string {
  return DAY_NAMES[d.getDay()]
}

/** "Tuesday, June 10" — page header date. */
export function longDate(d: Date): string {
  const full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${full[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`
}

/** Format hours as a human duration: 0.4 → "24m", 5.2 → "5.2h", 49 → "2.0d" */
export function formatHours(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return '—'
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`
  if (h < 24) return `${h.toFixed(1).replace(/\.0$/, '')}h`
  return `${(h / 24).toFixed(1).replace(/\.0$/, '')}d`
}
