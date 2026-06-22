import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { stopGmailWatch } from '@/services/gmail.service'

/** List the organization's connected integrations (any member). */
export async function GET() {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error

  const integrations = await prisma.integration.findMany({
    where: { organizationId: ctx.organization.id },
    select: { type: true, isActive: true, syncedAt: true, email: true },
  })

  return NextResponse.json(integrations)
}

/** Disconnect a shared inbox (admin/owner only). */
export async function DELETE(req: Request) {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error

  const { type } = await req.json()
  if (!type) {
    return NextResponse.json({ error: 'Missing type' }, { status: 400 })
  }

  // Stop the Gmail push watch before deactivating (best-effort).
  if (type === 'GMAIL') {
    const integration = await prisma.integration.findFirst({
      where: { organizationId: ctx.organization.id, type: 'GMAIL', isActive: true },
    })
    if (integration) {
      try {
        await stopGmailWatch(integration)
      } catch {
        // ignore — disconnect should still proceed
      }
    }
  }

  await prisma.integration.updateMany({
    where: { organizationId: ctx.organization.id, type },
    data: { isActive: false },
  })

  return NextResponse.json({ ok: true })
}
