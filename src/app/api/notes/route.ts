import { type NextRequest } from 'next/server'
import { ok } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { createNote, listNotes } from '@/services/note.knowledge.service'

/** List the user's knowledge notes (newest-edited first). */
export async function GET() {
  const { ctx, error } = await requireOrg('VIEWER')
  if (!ctx) return error
  return ok({ notes: await listNotes(ctx.userId) })
}

/**
 * Create a knowledge note.
 *   POST /api/notes  { "title"?: string, "body"?: string }
 * Auto-linking is queued when the body is substantial.
 */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const body = (await req.json().catch(() => null)) as { title?: unknown; body?: unknown } | null
  const note = await createNote(
    { userId: ctx.userId, organizationId: ctx.organization.id },
    {
      title: typeof body?.title === 'string' ? body.title : '',
      body: typeof body?.body === 'string' ? body.body : '',
    },
  )
  return ok({ id: note.id }, 201)
}
