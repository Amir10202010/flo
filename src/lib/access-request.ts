/**
 * Pure validation/normalization for the request-access gate.
 *
 * No DB / network — safe to unit-test (`npm run test:access`) and to import from
 * the `/api/access-request` route handler. The orchestration (upsert + owner
 * notification) lives in `src/services/access-request.service.ts`.
 */

// Conservative single-line email shape: local@domain.tld, no spaces. Good
// enough to catch typos and junk; real deliverability is proven when the owner
// adds the address to the Google Test users list.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL = 254
const MAX_NOTE = 500

export type ValidatedAccessRequest =
  | { ok: true; email: string; note: string | null }
  | { ok: false; error: string }

/** Validate + normalize a raw `{ email, note }` payload from the request form. */
export function validateAccessRequest(input: { email?: unknown; note?: unknown }): ValidatedAccessRequest {
  const rawEmail = input.email
  if (typeof rawEmail !== 'string') return { ok: false, error: 'Email is required.' }
  const email = rawEmail.trim().toLowerCase()
  if (!email) return { ok: false, error: 'Email is required.' }
  if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  // An omitted note is fine; a present-but-non-string note is a malformed request.
  let note: string | null = null
  const rawNote = input.note
  if (rawNote !== undefined && rawNote !== null) {
    if (typeof rawNote !== 'string') return { ok: false, error: 'Note must be text.' }
    const trimmed = rawNote.trim()
    if (trimmed.length > MAX_NOTE) return { ok: false, error: 'Note is too long (500 characters max).' }
    note = trimmed || null
  }

  return { ok: true, email, note }
}

/**
 * Notify-once guard: email the owner only for a brand-new request or one that
 * was never notified. `existing` is the row as it was BEFORE the upsert, so a
 * re-submit of an already-notified request stays silent.
 */
export function shouldNotifyOwner(existing: { notifiedAt: Date | null } | null): boolean {
  return !existing || existing.notifiedAt == null
}
