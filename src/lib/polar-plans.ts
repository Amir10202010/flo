/**
 * Maps our BillingPlan + period to Polar product ids and back. PURE except for
 * reading product-id env vars (read at call time so tests can set them). Only
 * Pro/Team/Business are sold via Polar; Free and Enterprise have no product.
 */
import type { BillingPlan, BillingPeriod } from '@/lib/billing'

const PAID: BillingPlan[] = ['PRO', 'TEAM', 'BUSINESS']

function envKey(plan: BillingPlan, period: BillingPeriod): string {
  return `POLAR_PRODUCT_${plan}_${period.toUpperCase()}`
}

/** Polar product id for a sellable plan+period, or null if not sold via Polar. */
export function planToProduct(plan: BillingPlan, period: BillingPeriod): string | null {
  if (!PAID.includes(plan)) return null
  return process.env[envKey(plan, period)]?.trim() || null
}

/** Reverse lookup: which {plan, period} owns a Polar product id. */
export function productToPlan(productId: string): { plan: BillingPlan; period: BillingPeriod } | null {
  if (!productId) return null
  for (const plan of PAID) {
    for (const period of ['monthly', 'annual'] as const) {
      if (process.env[envKey(plan, period)]?.trim() === productId) return { plan, period }
    }
  }
  return null
}
