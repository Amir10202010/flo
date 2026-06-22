import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { deleteContactNote } from '@/services/note.service'

/**
 * Delete one note (ownership-checked).
 *   DELETE /api/contacts/:id/notes/:noteId
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error

  const { noteId } = await params
  const deleted = await deleteContactNote(ctx.organization.id, noteId)
  if (!deleted) return err('Note not found', 404)
  return ok({ deleted: true })
}
