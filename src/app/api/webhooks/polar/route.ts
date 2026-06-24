import { NextRequest, NextResponse } from 'next/server'
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks'
import { prisma } from '@/lib/prisma'
import { productToPlan } from '@/lib/polar-plans'
import { subscriptionUpdateFromEvent, type PolarSubInput } from '@/services/billing.webhook'
import { recordAudit } from '@/services/audit.service'

export const dynamic = 'force-dynamic'

/** Minimal view of the Polar event shape we read — avoids leaking the SDK's
 * large discriminated union into this handler. */
interface PolarEventLike {
  type?: string
  data?: {
    id?: string | null
    productId?: string | null
    status?: string | null
    currentPeriodEnd?: string | Date | null
    recurringInterval?: string | null
    customerId?: string | null
    customer?: { id?: string | null; externalId?: string | null } | null
    metadata?: Record<string, unknown> | null
  }
}

/**
 * Polar webhook receiver. Verifies the signature (POLAR_WEBHOOK_SECRET), maps
 * subscription events to a Subscription patch via the pure
 * subscriptionUpdateFromEvent, and upserts. Fails closed in production when the
 * secret is unset; always 2xx-acks once verified so Polar doesn't redeliver.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET
  const bodyText = await req.text()

  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('[webhooks/polar] POLAR_WEBHOOK_SECRET not set — refusing in production')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  let event: PolarEventLike
  try {
    if (secret) {
      const headers = Object.fromEntries(req.headers.entries())
      event = validateEvent(bodyText, headers, secret) as unknown as PolarEventLike
    } else {
      event = JSON.parse(bodyText) as PolarEventLike // dev only (no secret configured)
    }
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 })
  }

  const type = String(event?.type || '')
  if (!type.startsWith('subscription.')) {
    return NextResponse.json({ ok: true, ignored: 'not_subscription' })
  }

  const d = event.data ?? {}
  const input: PolarSubInput = {
    type,
    productId: d.productId ?? null,
    status: d.status ?? null,
    currentPeriodEnd: d.currentPeriodEnd ? new Date(d.currentPeriodEnd).toISOString() : null,
    recurringInterval: d.recurringInterval ?? null,
    customerExternalId: d.customer?.externalId ?? null,
    customerId: d.customerId ?? d.customer?.id ?? null,
    subscriptionId: d.id ?? null,
    metadataOrganizationId: typeof d.metadata?.organizationId === 'string' ? d.metadata.organizationId : null,
  }

  const patch = subscriptionUpdateFromEvent(input, productToPlan)
  if ('ignore' in patch) return NextResponse.json({ ok: true, ignored: patch.reason })

  const org = await prisma.organization.findUnique({ where: { id: patch.organizationId }, select: { id: true } })
  if (!org) return NextResponse.json({ ok: true, ignored: 'unknown_org' })

  const data = {
    plan: patch.plan,
    status: patch.status,
    interval: patch.interval,
    cancelAtPeriodEnd: patch.cancelAtPeriodEnd,
    currentPeriodEnd: patch.currentPeriodEnd,
    externalCustomerId: patch.externalCustomerId,
    externalSubscriptionId: patch.externalSubscriptionId,
  }
  await prisma.subscription.upsert({
    where: { organizationId: patch.organizationId },
    create: { organizationId: patch.organizationId, seats: 1, ...data },
    update: data,
  })

  await recordAudit({
    organizationId: patch.organizationId,
    actorId: null,
    action: 'billing.subscription_updated',
    summary: `Subscription → ${patch.plan} (${patch.status})`,
    targetType: 'subscription',
    targetId: patch.organizationId,
  })

  return NextResponse.json({ ok: true })
}
