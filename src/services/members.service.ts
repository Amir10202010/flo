/**
 * Team membership & invitations. Roles can only be granted up to the actor's
 * own level (assignableRoles), an OWNER can never be demoted/removed by an
 * ADMIN (canManageMember), and an org always keeps at least one OWNER. Every
 * change is audited. Invitations carry a random token; accepting one creates a
 * Membership for the authenticated invitee.
 */
import { randomBytes } from 'node:crypto'
import type { OrgRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assignableRoles, canManageMember } from '@/lib/permissions'
import { canAddSeat } from '@/lib/billing'
import { recordAudit } from '@/services/audit.service'

export class MemberError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'MemberError'
  }
}

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

// ── Invitations ──────────────────────────────────────────────────────────────

export interface InvitationItem {
  id: string
  email: string
  role: OrgRole
  status: string
  expiresAt: string
  token: string
}

export async function inviteMember(
  organizationId: string,
  actor: { id: string; role: OrgRole },
  email: string,
  role: OrgRole,
): Promise<InvitationItem> {
  const clean = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new MemberError('Enter a valid email', 400)
  if (!assignableRoles(actor.role).includes(role)) throw new MemberError('You cannot grant that role', 403)

  // Already a member?
  const existing = await prisma.membership.findFirst({
    where: { organizationId, user: { email: clean } },
    select: { id: true },
  })
  if (existing) throw new MemberError('That person is already a member', 409)

  // Reuse/refresh a pending invite for the same email instead of duplicating.
  const token = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
  const prior = await prisma.invitation.findFirst({ where: { organizationId, email: clean, status: 'PENDING' } })

  // Seat gate (only for net-new invites — a refresh doesn't add a seat).
  if (!prior) {
    const sub = await prisma.subscription.findUnique({ where: { organizationId }, select: { plan: true } })
    const active = await prisma.membership.count({ where: { organizationId, status: 'ACTIVE' } })
    const pending = await prisma.invitation.count({ where: { organizationId, status: 'PENDING' } })
    if (!canAddSeat(sub?.plan ?? 'FREE', active + pending)) {
      throw new MemberError('Seat limit reached for your plan — upgrade to invite more teammates', 402)
    }
  }

  const invite = prior
    ? await prisma.invitation.update({
        where: { id: prior.id },
        data: { role, token, expiresAt, invitedById: actor.id },
      })
    : await prisma.invitation.create({
        data: { organizationId, email: clean, role, token, expiresAt, invitedById: actor.id },
      })

  await recordAudit({
    organizationId,
    actorId: actor.id,
    action: 'member.invited',
    summary: `Invited ${clean} as ${role.toLowerCase()}`,
    targetType: 'invitation',
    targetId: invite.id,
  })

  return { id: invite.id, email: invite.email, role: invite.role, status: invite.status, expiresAt: invite.expiresAt.toISOString(), token: invite.token }
}

export async function listInvitations(organizationId: string): Promise<InvitationItem[]> {
  const rows = await prisma.invitation.findMany({
    where: { organizationId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    status: i.status,
    expiresAt: i.expiresAt.toISOString(),
    token: i.token,
  }))
}

export async function revokeInvitation(organizationId: string, actorId: string, invitationId: string): Promise<void> {
  const invite = await prisma.invitation.findFirst({ where: { id: invitationId, organizationId } })
  if (!invite) throw new MemberError('Invitation not found', 404)
  await prisma.invitation.update({ where: { id: invite.id }, data: { status: 'REVOKED' } })
  await recordAudit({
    organizationId,
    actorId,
    action: 'member.invite_revoked',
    summary: `Revoked the invite for ${invite.email}`,
    targetType: 'invitation',
    targetId: invite.id,
  })
}

export interface InvitePreview {
  organizationName: string
  email: string
  role: OrgRole
  valid: boolean
  reason?: string
}

export async function previewInvitation(token: string): Promise<InvitePreview | null> {
  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  })
  if (!invite) return null
  const expired = invite.expiresAt.getTime() < Date.now()
  const valid = invite.status === 'PENDING' && !expired
  return {
    organizationName: invite.organization.name,
    email: invite.email,
    role: invite.role,
    valid,
    reason: invite.status !== 'PENDING' ? `Invitation ${invite.status.toLowerCase()}` : expired ? 'Invitation expired' : undefined,
  }
}

/** Accept an invitation as the authenticated user (email must match). */
export async function acceptInvitation(
  token: string,
  user: { id: string; email: string },
): Promise<{ organizationId: string }> {
  const invite = await prisma.invitation.findUnique({ where: { token } })
  if (!invite) throw new MemberError('Invitation not found', 404)
  if (invite.status !== 'PENDING') throw new MemberError('Invitation is no longer valid', 410)
  if (invite.expiresAt.getTime() < Date.now()) throw new MemberError('Invitation has expired', 410)
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new MemberError('This invitation was sent to a different email address', 403)
  }

  // Ensure the Prisma user row exists (Supabase auth is separate).
  await prisma.user.upsert({ where: { id: user.id }, create: { id: user.id, email: user.email }, update: {} })

  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: invite.organizationId, userId: user.id } },
    create: { organizationId: invite.organizationId, userId: user.id, role: invite.role, status: 'ACTIVE' },
    update: { status: 'ACTIVE' },
  })
  await prisma.invitation.update({ where: { id: invite.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } })
  await recordAudit({
    organizationId: invite.organizationId,
    actorId: user.id,
    action: 'member.joined',
    summary: `${user.email} joined as ${invite.role.toLowerCase()}`,
    targetType: 'user',
    targetId: user.id,
  })
  return { organizationId: invite.organizationId }
}

// ── Member management ────────────────────────────────────────────────────────

async function ownerCount(organizationId: string): Promise<number> {
  return prisma.membership.count({ where: { organizationId, role: 'OWNER', status: 'ACTIVE' } })
}

export async function changeMemberRole(
  organizationId: string,
  actor: { id: string; role: OrgRole },
  membershipId: string,
  newRole: OrgRole,
): Promise<void> {
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    include: { user: { select: { email: true } } },
  })
  if (!m) throw new MemberError('Member not found', 404)
  if (!canManageMember(actor.role, m.role)) throw new MemberError('You cannot change that member', 403)
  if (!assignableRoles(actor.role).includes(newRole)) throw new MemberError('You cannot grant that role', 403)
  // Don't strip the last owner.
  if (m.role === 'OWNER' && newRole !== 'OWNER' && (await ownerCount(organizationId)) <= 1) {
    throw new MemberError('An organization must keep at least one owner', 400)
  }

  await prisma.membership.update({ where: { id: m.id }, data: { role: newRole } })
  await recordAudit({
    organizationId,
    actorId: actor.id,
    action: 'member.role_changed',
    summary: `Changed ${m.user.email}'s role to ${newRole.toLowerCase()}`,
    targetType: 'membership',
    targetId: m.id,
  })
}

export async function removeMember(
  organizationId: string,
  actor: { id: string; role: OrgRole },
  membershipId: string,
): Promise<void> {
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    include: { user: { select: { email: true } } },
  })
  if (!m) throw new MemberError('Member not found', 404)
  if (!canManageMember(actor.role, m.role)) throw new MemberError('You cannot remove that member', 403)
  if (m.role === 'OWNER' && (await ownerCount(organizationId)) <= 1) {
    throw new MemberError('An organization must keep at least one owner', 400)
  }

  await prisma.membership.delete({ where: { id: m.id } })
  await recordAudit({
    organizationId,
    actorId: actor.id,
    action: 'member.removed',
    summary: `Removed ${m.user.email}`,
    targetType: 'user',
    targetId: m.userId,
  })
}
