import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { listOrgTags, createTag, CollabError } from '@/services/assignment.service'

/**
 * Org-scoped conversation tags.
 *   GET  /api/tags                 → list
 *   POST /api/tags  { name, color } → create (admin+)
 */
export async function GET() {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error
  const tags = await listOrgTags(ctx.organization.id)
  return ok({ tags })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const body = await req.json().catch(() => null)
  const name = typeof (body as { name?: unknown })?.name === 'string' ? (body as { name: string }).name : ''
  const color = typeof (body as { color?: unknown })?.color === 'string' ? (body as { color: string }).color : undefined

  try {
    const tag = await createTag(ctx.organization.id, ctx.userId, name, color)
    return ok(tag, 201)
  } catch (e) {
    if (e instanceof CollabError) return err(e.message, e.status)
    console.error('[tags] failed:', e)
    return err('Could not create the tag', 500)
  }
}
