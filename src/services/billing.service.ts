/**
 * Billing reads for enforcement points. One sequential Subscription lookup per
 * gated path (never fan out — small Prisma pool). Defaults to FREE when no
 * subscription row exists.
 */
import type { BillingPlan } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hasFeature, autoDraftAllowance } from '@/lib/billing'

export async function getOrgPlan(organizationId: string): Promise<BillingPlan> {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { plan: true },
  })
  return sub?.plan ?? 'FREE'
}

export async function orgHasFeature(
  organizationId: string,
  feature: 'audit' | 'automations' | 'aiDrafts' | 'alerts' | 'digest' | 'assistant',
): Promise<boolean> {
  return hasFeature(await getOrgPlan(organizationId), feature)
}

/** Auto-drafts the org may still generate this month (the free taste is capped;
 * paid plans are unlimited). Counts ConversationDraft rows created this calendar
 * month against the plan allowance. */
export async function autoDraftsRemaining(organizationId: string): Promise<number> {
  const allowance = autoDraftAllowance(await getOrgPlan(organizationId))
  if (allowance === Infinity) return Infinity
  if (allowance <= 0) return 0
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const used = await prisma.conversationDraft.count({
    where: { organizationId, createdAt: { gte: monthStart } },
  })
  return Math.max(0, allowance - used)
}
