/** Absolute message stamp: "9:20 AM" today, "Jun 20" / "Jun 20, 2025" older. */
export function formatStamp(d: Date | string, now: Date): string {
  const date = new Date(d)
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
  return date.toLocaleDateString('en-US', opts)
}

/** Full datetime for hover titles. */
export function fullStamp(d: Date | string): string {
  return new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Day-separator label: Today / Yesterday / "Mar 4" / "Mar 4, 2025". */
export function dayLabel(d: Date, now: Date): string {
  const day = (x: Date) => Math.floor((x.getTime() - x.getTimezoneOffset() * 60000) / 86_400_000)
  const diff = day(now) - day(d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
  return d.toLocaleDateString('en-US', opts)
}
