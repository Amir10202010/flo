/**
 * Organization + membership lifecycle: create an org (with the creator as
 * OWNER), list a user's orgs for the switcher, and membership checks. All writes
 * run sequentially (the runtime Prisma pool is tiny — never fan out).
 */
import type { Organization, Membership } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/slug'
import { recordAudit } from '@/services/audit.service'

/** Pick an org slug not already taken, appending a numeric suffix on collision. */
export async function uniqueOrgSlug(seed: string): Promise<string> {
  const base = slugify(seed)
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i}`
    const taken = await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!taken) return candidate
  }
  return `${base}-${Date.now().toString(36)}`
}

export interface MembershipWithOrg extends Membership {
  organization: Organization
}

/** Active memberships for a user, oldest first (the default active org). */
export async function listMembershipsForUser(userId: string): Promise<MembershipWithOrg[]> {
  return prisma.membership.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })
}

export async function isActiveMember(userId: string, organizationId: string): Promise<boolean> {
  const m = await prisma.membership.findFirst({
    where: { userId, organizationId, status: 'ACTIVE' },
    select: { id: true },
  })
  return !!m
}

/**
 * Create an organization owned by `userId`. Seeds the OWNER membership and a FREE
 * subscription, then audits. Returns the new org.
 */
export async function createOrganization(userId: string, rawName: string): Promise<Organization> {
  const name = rawName.trim()
  const slug = await uniqueOrgSlug(name || 'team')
  const org = await prisma.organization.create({ data: { name, slug } })
  await prisma.membership.create({
    data: { organizationId: org.id, userId, role: 'OWNER', status: 'ACTIVE' },
  })
  await prisma.subscription.create({ data: { organizationId: org.id, plan: 'FREE', seats: 1 } })
  await recordAudit({
    organizationId: org.id,
    actorId: userId,
    action: 'org.created',
    summary: `Created organization “${name}”`,
    targetType: 'organization',
    targetId: org.id,
  })
  return org
}

/** Count of active seats (members) in an org — used by billing/seat limits. */
export async function activeSeatCount(organizationId: string): Promise<number> {
  return prisma.membership.count({ where: { organizationId, status: 'ACTIVE' } })
}
