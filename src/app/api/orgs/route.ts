import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { ACTIVE_ORG_COOKIE } from '@/lib/org'
import { listMembershipsForUser, createOrganization } from '@/services/organization.service'

const ORG_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
}

/** List the organizations the current user belongs to (for the org switcher). */
export async function GET(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  const memberships = await listMembershipsForUser(user.id)
  const ids = new Set(memberships.map((m) => m.organization.id))
  const cookieOrg = req.cookies.get(ACTIVE_ORG_COOKIE)?.value
  const activeId = cookieOrg && ids.has(cookieOrg) ? cookieOrg : (memberships[0]?.organization.id ?? null)

  return ok({
    activeId,
    organizations: memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
  })
}

/** Create a new organization (creator becomes OWNER) and make it active. */
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (!user) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON', 400)
  }
  const name = typeof (body as { name?: unknown })?.name === 'string' ? (body as { name: string }).name.trim() : ''
  if (!name) return err('Organization name is required', 400)
  if (name.length > 80) return err('Organization name is too long (max 80 chars)', 400)

  // Supabase auth is separate from the Prisma User table — ensure the row exists
  // before we attach a membership to it.
  await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email ?? `${user.id}@placeholder.velnox` },
    update: {},
  })

  const org = await createOrganization(user.id, name)
  const res = ok({ organization: { id: org.id, name: org.name, slug: org.slug } }, 201)
  res.cookies.set(ACTIVE_ORG_COOKIE, org.id, ORG_COOKIE_OPTS)
  return res
}
