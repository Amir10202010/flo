import { type NextRequest } from 'next/server'
import type { OrgRole } from '@prisma/client'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { sendGmailMessage } from '@/services/gmail.service'
import { inviteMember, listInvitations, MemberError } from '@/services/members.service'

const VALID_ROLES = new Set<OrgRole>(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/** List pending invitations (admin+) and create a new one. */
export async function GET() {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error
  const invitations = await listInvitations(ctx.organization.id)
  return ok({ invitations })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const body = await req.json().catch(() => null)
  const email = typeof (body as { email?: unknown })?.email === 'string' ? (body as { email: string }).email : ''
  const role = (body as { role?: unknown })?.role as OrgRole | undefined
  if (!role || !VALID_ROLES.has(role)) return err('Invalid role', 400)

  try {
    const invite = await inviteMember(ctx.organization.id, { id: ctx.userId, role: ctx.role }, email, role)
    const link = `${appUrl()}/invite/${invite.token}`

    // Best-effort: email the invitee through the org's connected inbox.
    const integration = await prisma.integration.findFirst({
      where: { organizationId: ctx.organization.id, type: 'GMAIL', isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    if (integration) {
      try {
        await sendGmailMessage(integration, {
          to: invite.email,
          subject: `You're invited to join ${ctx.organization.name} on Velnox`,
          text: `You've been invited to join ${ctx.organization.name} on Velnox as a ${role.toLowerCase()}.\n\nAccept your invitation:\n${link}\n\nThis link expires in 14 days.`,
          html: `<p>You've been invited to join <strong>${ctx.organization.name}</strong> on Velnox as a ${role.toLowerCase()}.</p><p><a href="${link}">Accept your invitation</a></p><p style="color:#888;font-size:12px">This link expires in 14 days.</p>`,
        })
      } catch (e) {
        console.warn('[invitations] email send failed (link still returned):', e)
      }
    }

    return ok({ invitation: { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt }, link }, 201)
  } catch (e) {
    if (e instanceof MemberError) return err(e.message, e.status)
    console.error('[invitations] failed:', e)
    return err('Could not send the invitation', 500)
  }
}
