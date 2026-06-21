import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { deleteContactNote } from '@/services/note.service'

/**
 * Delete one note (ownership-checked).
 *   DELETE /api/contacts/:id/notes/:noteId
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  const { noteId } = await params
  const deleted = await deleteContactNote(user.id, noteId)
  if (!deleted) return err('Note not found', 404)
  return ok({ deleted: true })
}
