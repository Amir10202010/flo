import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { assignConversation, CollabError } from '@/services/assignment.service'

/**
 * Assign a shared-inbox conversation to a member (or clear it).
 *   POST /api/conversations/:id/assign  { membershipId: string | "me" | null }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null)
  const raw = (body as { membershipId?: unknown })?.membershipId

  let membershipId: string | null
  if (raw === null) membershipId = null
  else if (raw === 'me') membershipId = ctx.membership.id
  else if (typeof raw === 'string' && raw) membershipId = raw
  else return err('membershipId (string, "me", or null) is required', 400)

  try {
    const result = await assignConversation(ctx.organization.id, ctx.userId, id, membershipId)
    return ok(result)
  } catch (e) {
    if (e instanceof CollabError) return err(e.message, e.status)
    console.error('[assign] failed:', e)
    return err('Could not assign the conversation', 500)
  }
}
