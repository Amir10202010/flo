import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { deleteNote, getNoteDetail, updateNote } from '@/services/note.knowledge.service'

/** Read one note with its auto-linked entities (ownership-checked). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('VIEWER')
  if (!ctx) return error
  const { id } = await params
  const note = await getNoteDetail(ctx.userId, id)
  if (!note) return err('Note not found', 404)
  return ok(note)
}

/**
 * Autosave a note. Re-linking is queued only when content actually changed.
 *   PATCH /api/notes/:id  { "title"?: string, "body"?: string }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const { id } = await params
  const body = (await req.json().catch(() => null)) as { title?: unknown; body?: unknown } | null
  if (!body || (body.title === undefined && body.body === undefined)) {
    return err('Nothing to update — expected title and/or body', 400)
  }
  const updated = await updateNote(ctx.userId, id, {
    ...(typeof body.title === 'string' ? { title: body.title } : {}),
    ...(typeof body.body === 'string' ? { body: body.body } : {}),
  })
  if (!updated) return err('Note not found', 404)
  return ok(updated)
}

/** Delete a note and every trace it left in the knowledge base. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const { id } = await params
  const deleted = await deleteNote(ctx.userId, id)
  if (!deleted) return err('Note not found', 404)
  return ok({ deleted: true })
}
