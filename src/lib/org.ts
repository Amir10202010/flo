/**
 * Organization context for the request — the B2B counterpart to `getCurrentUser`.
 *
 * `getOrgContext()` resolves the active organization from the `velnox_org` cookie
 * (validated against an ACTIVE membership), falling back to the user's first org.
 * Server Components call it to scope reads; Route Handlers use `requireOrg()` /
 * `requireCan()` which return a ready 401/403 on failure.
 *
 * NOTE: this performs a Prisma lookup, so it is NOT called from the dashboard
 * layout (which stays DB-free for fast navigation — see getCurrentUser). Pages
 * and route handlers that actually need org scope call it; it is React-cached so
 * repeated calls in one render tree share a single lookup.
 */
import { cache } from 'react'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import type { Organization, Membership, OrgRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { err } from '@/lib/api'
import { atLeast, can, type OrgAction } from '@/lib/permissions'

export const ACTIVE_ORG_COOKIE = 'velnox_org'

export interface OrgContext {
  userId: string
  email: string | null
  organization: Organization
  membership: Membership
  role: OrgRole
}

export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const jar = await cookies()
  const preferred = jar.get(ACTIVE_ORG_COOKIE)?.value

  let membership = preferred
    ? await prisma.membership.findFirst({
        where: { userId: user.id, organizationId: preferred, status: 'ACTIVE' },
        include: { organization: true },
      })
    : null

  if (!membership) {
    membership = await prisma.membership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  if (!membership) return null

  return {
    userId: user.id,
    email: user.email ?? null,
    organization: membership.organization,
    membership,
    role: membership.role,
  }
})

type RequireResult =
  | { ctx: OrgContext; error: null }
  | { ctx: null; error: NextResponse }

/**
 * Route-handler guard. Returns the org context, or a pre-built error Response:
 * 401 if unauthenticated, 403 if the user has no org or lacks `minRole`.
 */
export async function requireOrg(minRole: OrgRole = 'VIEWER'): Promise<RequireResult> {
  const user = await getCurrentUser()
  if (!user) return { ctx: null, error: err('Unauthorized', 401) }

  const ctx = await getOrgContext()
  if (!ctx) return { ctx: null, error: err('No organization', 403) }
  if (!atLeast(ctx.role, minRole)) return { ctx: null, error: err('Forbidden', 403) }
  return { ctx, error: null }
}

/** Route-handler guard keyed on a specific permission rather than a role floor. */
export async function requireCan(action: OrgAction): Promise<RequireResult> {
  const user = await getCurrentUser()
  if (!user) return { ctx: null, error: err('Unauthorized', 401) }

  const ctx = await getOrgContext()
  if (!ctx) return { ctx: null, error: err('No organization', 403) }
  if (!can(ctx.role, action)) return { ctx: null, error: err('Forbidden', 403) }
  return { ctx, error: null }
}
