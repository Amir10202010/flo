/**
 * Billing reads for enforcement points. One sequential Subscription lookup per
 * gated path (never fan out — small Prisma pool). Defaults to FREE when no
 * subscription row exists.
 */
import type { BillingPlan } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hasFeature } from '@/lib/billing'

export async function getOrgPlan(organizationId: string): Promise<BillingPlan> {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { plan: true },
  })
  return sub?.plan ?? 'FREE'
}

export async function orgHasFeature(
  organizationId: string,
  feature: 'audit' | 'automations' | 'aiDrafts' | 'digest' | 'assistant',
): Promise<boolean> {
  return hasFeature(await getOrgPlan(organizationId), feature)
}
