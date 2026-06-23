import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { revokeInvitation, MemberError } from '@/services/members.service'

/** Revoke a pending invitation (admin+). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error
  const { id } = await params
  try {
    await revokeInvitation(ctx.organization.id, ctx.userId, id)
    return ok({ revoked: true })
  } catch (e) {
    if (e instanceof MemberError) return err(e.message, e.status)
    return err('Could not revoke the invitation', 500)
  }
}
