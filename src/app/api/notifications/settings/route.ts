import { type NextRequest } from 'next/server'
import { getAuthUser, ok, err } from '@/lib/api'
import { rateLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { mergeIntegrationMetadata } from '@/lib/integration-metadata'
import { integrationEmail } from '@/services/gmail.service'
import { digestOwnerEmail } from '@/services/digest.service'

/**
 * Per-mailbox notification preferences, stored on Integration.metadata.
 *   GET   → { connected, alertEmailsEnabled, ownerMailbox }
 *   PATCH { alertEmailsEnabled: boolean } → persist the toggle
 *
 * Urgent-alert emails default ON (absent flag = enabled) and only ever go to
 * the GMAIL_USER_EMAIL owner mailbox, so `ownerMailbox` tells the UI whether
 * the toggle has any real effect for this user.
 */

export async function GET() {
  const { user, error } = await getAuthUser()
  if (!user) return error

  const integration = await prisma.integration.findFirst({
    where: { userId: user.id, type: 'GMAIL', isActive: true },
  })
  const meta = (integration?.metadata as Record<string, unknown> | null) ?? {}
  const ownerEmail = digestOwnerEmail()

  return ok({
    connected: Boolean(integration),
    alertEmailsEnabled: meta.alertEmailsEnabled !== false,
    ownerMailbox: Boolean(integration && ownerEmail && integrationEmail(integration) === ownerEmail),
  })
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (!user) return error
  const limited = await rateLimit(user.id, 'mutate')
  if (limited) return limited

  const body = await req.json().catch(() => null)
  if (typeof body?.alertEmailsEnabled !== 'boolean') {
    return err('Expected { alertEmailsEnabled: boolean }', 400)
  }

  const integration = await prisma.integration.findFirst({
    where: { userId: user.id, type: 'GMAIL', isActive: true },
  })
  if (!integration) return err('No connected mailbox', 404)

  // Atomic merge so we don't clobber concurrent sync/watch metadata writes.
  await mergeIntegrationMetadata(integration.id, { alertEmailsEnabled: body.alertEmailsEnabled })

  return ok({ alertEmailsEnabled: body.alertEmailsEnabled })
}
