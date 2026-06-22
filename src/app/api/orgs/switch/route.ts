import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { ACTIVE_ORG_COOKIE } from '@/lib/org'
import { isActiveMember } from '@/services/organization.service'

const ORG_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
}

/** Set the active organization (validated against the caller's membership). */
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON', 400)
  }
  const organizationId =
    typeof (body as { organizationId?: unknown })?.organizationId === 'string'
      ? (body as { organizationId: string }).organizationId
      : ''
  if (!organizationId) return err('organizationId is required', 400)

  if (!(await isActiveMember(user.id, organizationId))) {
    return err('Not a member of that organization', 403)
  }

  const res = ok({ ok: true })
  res.cookies.set(ACTIVE_ORG_COOKIE, organizationId, ORG_COOKIE_OPTS)
  return res
}
