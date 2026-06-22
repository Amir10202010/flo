import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { listContactNotes, createContactNote } from '@/services/note.service'

/**
 * Notes for one contact (ownership-checked).
 *   GET  /api/contacts/:id/notes               → { notes }
 *   POST /api/contacts/:id/notes  { body }      → create a manual note
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error

  const { id } = await params
  const notes = await listContactNotes(ctx.organization.id, id)
  return ok({
    notes: notes.map((n) => ({ id: n.id, body: n.body, source: n.source, createdAt: n.createdAt.toISOString() })),
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'notes')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null)
  const text = typeof (body as { body?: unknown })?.body === 'string' ? (body as { body: string }).body.trim() : ''
  if (!text) return err('Note body is required', 400)

  const note = await createContactNote(ctx.organization.id, ctx.userId, { contactId: id, body: text, source: 'manual' })
  if (!note) return err('Contact not found', 404)
  return ok({ id: note.id, body: note.body, source: note.source, createdAt: note.createdAt.toISOString() }, 201)
}
