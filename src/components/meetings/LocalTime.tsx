'use client'

/**
 * Absolute meeting times in the VIEWER's timezone. The server renders its own
 * zone first and the client corrects on hydration — `suppressHydrationWarning`
 * makes that swap silent (the standard tradeoff for absolute local times).
 */
export default function LocalTime({
  iso,
  endIso,
  mode = 'datetime',
}: {
  iso: string
  endIso?: string | null
  /** datetime = "Wed, Jul 22 · 2:00 PM"; time = "2:00 PM"; date = "Wed, Jul 22". */
  mode?: 'datetime' | 'time' | 'date'
}) {
  const start = new Date(iso)
  const date = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const time = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const end = endIso ? new Date(endIso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null

  const label =
    mode === 'date' ? date : mode === 'time' ? (end ? `${time} – ${end}` : time) : `${date} · ${time}${end ? ` – ${end}` : ''}`

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {label}
    </time>
  )
}
