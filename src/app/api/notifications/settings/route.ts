import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { mergeIntegrationMetadata } from '@/lib/integration-metadata'

/**
 * Organization notification preferences, stored on the connected inbox's
 * Integration.metadata.
 *   GET   → { connected, alertEmailsEnabled }
 *   PATCH { alertEmailsEnabled: boolean } → persist the toggle (admin+)
 *
 * Urgent-alert emails default ON (absent flag = enabled) and go to the org
 * owner's mailbox. `connected` tells the UI whether the toggle has any effect.
 */

export async function GET() {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error

  const integration = await prisma.integration.findFirst({
    where: { organizationId: ctx.organization.id, type: 'GMAIL', isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  const meta = (integration?.metadata as Record<string, unknown> | null) ?? {}

  return ok({
    connected: Boolean(integration),
    alertEmailsEnabled: meta.alertEmailsEnabled !== false,
    // The toggle is effective whenever the org has a connected inbox to send from.
    ownerMailbox: Boolean(integration),
  })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const body = await req.json().catch(() => null)
  if (typeof body?.alertEmailsEnabled !== 'boolean') {
    return err('Expected { alertEmailsEnabled: boolean }', 400)
  }

  const integration = await prisma.integration.findFirst({
    where: { organizationId: ctx.organization.id, type: 'GMAIL', isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!integration) return err('No connected mailbox', 404)

  // Atomic merge so we don't clobber concurrent sync/watch metadata writes.
  await mergeIntegrationMetadata(integration.id, { alertEmailsEnabled: body.alertEmailsEnabled })

  return ok({ alertEmailsEnabled: body.alertEmailsEnabled })
}
