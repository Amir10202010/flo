/**
 * URL-safe slug from arbitrary text — PURE. Shared by the org service and the
 * backfill script so they slugify identically.
 */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/@.*$/, '') // drop email domain if a full address slipped in
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32)
  return base || 'team'
}
