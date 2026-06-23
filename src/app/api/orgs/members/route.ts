import { ok } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { listOrgMembers } from '@/services/organization.service'

/** List the active org's members (for assignee pickers and the members table). */
export async function GET() {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error

  const members = await listOrgMembers(ctx.organization.id)
  return ok({
    members: members.map((m) => ({
      membershipId: m.membershipId,
      name: m.name,
      email: m.email,
      role: m.role,
      status: m.status,
    })),
    me: ctx.membership.id,
  })
}
