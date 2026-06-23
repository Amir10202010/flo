import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { listConversationTags, setConversationTag, CollabError } from '@/services/assignment.service'

/**
 * Tags attached to one conversation.
 *   GET  /api/conversations/:id/tags
 *   POST /api/conversations/:id/tags  { tagId, attached: boolean }
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error
  const { id } = await params
  const tags = await listConversationTags(ctx.organization.id, id)
  return ok({ tags })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('MEMBER')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null)
  const tagId = typeof (body as { tagId?: unknown })?.tagId === 'string' ? (body as { tagId: string }).tagId : ''
  const attached = (body as { attached?: unknown })?.attached
  if (!tagId || typeof attached !== 'boolean') return err('tagId and attached:boolean are required', 400)

  try {
    await setConversationTag(ctx.organization.id, ctx.userId, id, tagId, attached)
    return ok({ ok: true })
  } catch (e) {
    if (e instanceof CollabError) return err(e.message, e.status)
    console.error('[conversation tags] failed:', e)
    return err('Could not update tags', 500)
  }
}
