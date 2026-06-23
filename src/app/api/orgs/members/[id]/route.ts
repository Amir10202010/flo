import { type NextRequest } from 'next/server'
import type { OrgRole } from '@prisma/client'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { changeMemberRole, removeMember, MemberError } from '@/services/members.service'

const VALID_ROLES = new Set<OrgRole>(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])

/** Change a member's role (admin+, no privilege escalation). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null)
  const role = (body as { role?: unknown })?.role as OrgRole | undefined
  if (!role || !VALID_ROLES.has(role)) return err('Invalid role', 400)

  try {
    await changeMemberRole(ctx.organization.id, { id: ctx.userId, role: ctx.role }, id, role)
    return ok({ role })
  } catch (e) {
    if (e instanceof MemberError) return err(e.message, e.status)
    return err('Could not change the role', 500)
  }
}

/** Remove a member (admin+, can't remove the last owner). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error

  const { id } = await params
  try {
    await removeMember(ctx.organization.id, { id: ctx.userId, role: ctx.role }, id)
    return ok({ removed: true })
  } catch (e) {
    if (e instanceof MemberError) return err(e.message, e.status)
    return err('Could not remove the member', 500)
  }
}
