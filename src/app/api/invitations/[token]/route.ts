import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { ACTIVE_ORG_COOKIE } from '@/lib/org'
import { previewInvitation, acceptInvitation, MemberError } from '@/services/members.service'

const ORG_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
}

/** Public preview of an invitation (org name + role + validity). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const preview = await previewInvitation(token)
  if (!preview) return err('Invitation not found', 404)
  return ok(preview)
}

/** Accept an invitation as the signed-in user, then make that org active. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { user, error } = await getAuthUser()
  if (!user) return error
  if (!user.email) return err('Your account has no email address', 400)

  const { token } = await params
  try {
    const { organizationId } = await acceptInvitation(token, { id: user.id, email: user.email })
    const res = ok({ organizationId })
    res.cookies.set(ACTIVE_ORG_COOKIE, organizationId, ORG_COOKIE_OPTS)
    return res
  } catch (e) {
    if (e instanceof MemberError) return err(e.message, e.status)
    console.error('[accept invite] failed:', e)
    return err('Could not accept the invitation', 500)
  }
}
