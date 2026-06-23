import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { addInternalNote, listInternalNotes, CollabError } from '@/services/assignment.service'

/**
 * Team-internal notes on a conversation (never sent to the contact).
 *   GET  /api/conversations/:id/internal-notes
 *   POST /api/conversations/:id/internal-notes  { body }
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error
  const { id } = await params
  const notes = await listInternalNotes(ctx.organization.id, id)
  return ok({ notes })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'notes')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null)
  const text = typeof (body as { body?: unknown })?.body === 'string' ? (body as { body: string }).body : ''

  try {
    const note = await addInternalNote(ctx.organization.id, ctx.userId, id, text)
    return ok(note, 201)
  } catch (e) {
    if (e instanceof CollabError) return err(e.message, e.status)
    console.error('[internal-notes] failed:', e)
    return err('Could not save the note', 500)
  }
}
