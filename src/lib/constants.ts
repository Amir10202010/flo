/**
 * Small, dependency-free constants and helpers shared across server and client
 * components. Keep this module pure (no I/O, no `server-only`/`client-only`
 * imports) so it stays importable from either runtime.
 */

// Single public contact address, referenced by the legal pages, contact page
// and footer. Placeholder for now — a real mailbox is a launch step.
// TODO: point MX / set up this mailbox (see LAUNCH_CHECKLIST.md)
export const SUPPORT_EMAIL = 'hello@velnox.com'

/**
 * Sanitize a `?next=` redirect target. Only same-origin, root-relative paths
 * are allowed — anything else is rejected to prevent open-redirect abuse after
 * auth (the sanitized value is later fed to `window.location.assign`).
 *
 * The input is already URL-decoded by the time it reaches here (searchParams).
 * We reject control characters (tab/newline/CR/…) and backslashes first — a
 * browser strips those before parsing, so "/<TAB>/evil.com" or "/\evil.com"
 * would otherwise normalize to a protocol-relative URL and escape origin — then
 * require a leading "/" that isn't the start of a protocol-relative "//host".
 */
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || typeof next !== 'string') return fallback
  for (let i = 0; i < next.length; i++) {
    const code = next.charCodeAt(i)
    if (code < 0x20 || code === 0x7f || code === 0x5c /* backslash */) return fallback
  }
  if (!next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}
