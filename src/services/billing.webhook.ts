/**
 * PURE derivation of a Subscription patch from a Polar webhook event. Kept
 * provider-shape-free (route adapts the SDK event into PolarSubInput) so it is
 * unit-tested without the SDK. `lookup` is injected (productToPlan) for the
 * same reason.
 */
import type { BillingPlan } from '@prisma/client'
import type { BillingPeriod } from '@/lib/billing'

export interface PolarSubInput {
  type: string
  productId: string | null
  status: string | null
  currentPeriodEnd: string | null
  recurringInterval: string | null // 'month' | 'year'
  customerExternalId: string | null
  customerId: string | null
  subscriptionId: string | null
  metadataOrganizationId: string | null
  /** Polar subscription `modifiedAt` (or `createdAt`) — orders events. */
  modifiedAt: string | null
}

export type SubPatch =
  | {
      organizationId: string
      plan: BillingPlan
      status: string
      interval: string | null
      cancelAtPeriodEnd: boolean
      currentPeriodEnd: Date | null
      externalCustomerId: string | null
      externalSubscriptionId: string | null
      lastEventAt: Date | null
    }
  | { ignore: true; reason: string }

type Lookup = (productId: string) => { plan: BillingPlan; period: BillingPeriod } | null

export function subscriptionUpdateFromEvent(e: PolarSubInput, lookup: Lookup): SubPatch {
  if (!e.type.startsWith('subscription.')) return { ignore: true, reason: 'unhandled_event' }

  const organizationId = e.customerExternalId || e.metadataOrganizationId
  if (!organizationId) return { ignore: true, reason: 'no_org' }

  const interval = e.recurringInterval === 'year' ? 'year' : e.recurringInterval === 'month' ? 'month' : null
  const currentPeriodEnd = e.currentPeriodEnd ? new Date(e.currentPeriodEnd) : null
  const base = {
    organizationId,
    interval,
    currentPeriodEnd,
    externalCustomerId: e.customerId,
    externalSubscriptionId: e.subscriptionId,
    lastEventAt: e.modifiedAt ? new Date(e.modifiedAt) : null,
  }

  if (e.type === 'subscription.revoked') {
    return { ...base, plan: 'FREE', status: 'canceled', cancelAtPeriodEnd: false }
  }

  const resolved = e.productId ? lookup(e.productId) : null
  if (!resolved) return { ignore: true, reason: 'unknown_product' }

  if (e.type === 'subscription.canceled') {
    return { ...base, plan: resolved.plan, status: e.status || 'active', cancelAtPeriodEnd: true }
  }

  // subscription.created | updated | active | uncanceled
  return { ...base, plan: resolved.plan, status: e.status || 'active', cancelAtPeriodEnd: false }
}

/**
 * True when an incoming event is older than (or equal to) the last applied one,
 * so the webhook can skip a stale/redelivered/out-of-order event. False when
 * either timestamp is missing (can't order → apply).
 */
export function isStaleEvent(incoming: Date | null, prior: Date | null): boolean {
  return !!(incoming && prior && incoming.getTime() <= prior.getTime())
}
