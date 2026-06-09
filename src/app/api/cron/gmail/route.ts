import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeCron } from '@/lib/cron'
import { enqueueGmailSync } from '@/services/jobs/queue'
import { startGmailWatch } from '@/services/gmail.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Renew watches that expire within this window.
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000

/**
 * Periodic Gmail maintenance (Vercel Cron). For each active Gmail integration:
 *   1. Enqueue a safety incremental sync (covers any push notification we missed).
 *   2. Renew the push watch if it's missing or expiring within 24h.
 *
 * Push notifications handle real-time; this is the durability backstop.
 */
async function handle(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const integrations = await prisma.integration.findMany({
    where: { type: 'GMAIL', isActive: true },
  })

  const pubsubConfigured = Boolean(process.env.GMAIL_PUBSUB_TOPIC)
  let queued = 0
  let renewed = 0
  const errors: string[] = []

  for (const integration of integrations) {
    try {
      await enqueueGmailSync(integration.userId)
      queued++
    } catch (e) {
      errors.push(`sync ${integration.id}: ${String(e)}`)
    }

    if (!pubsubConfigured) continue

    const meta = (integration.metadata as Record<string, unknown> | null) ?? {}
    const expRaw = meta.watchExpiration
    const expiresAt = typeof expRaw === 'string' ? parseInt(expRaw, 10) : 0
    const needsRenew = !expiresAt || expiresAt - Date.now() < RENEW_BEFORE_MS

    if (needsRenew) {
      try {
        await startGmailWatch(integration)
        renewed++
      } catch (e) {
        errors.push(`watch ${integration.id}: ${String(e)}`)
      }
    }
  }

  return NextResponse.json({ integrations: integrations.length, queued, renewed, errors })
}

export async function GET(req: NextRequest) {
  return handle(req)
}
export async function POST(req: NextRequest) {
  return handle(req)
}
