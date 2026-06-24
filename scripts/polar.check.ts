/**
 * Pure tests for the Polar plan↔product mapping (src/lib/polar-plans.ts).
 * Run with: `npm run test:polar`.
 *
 * polar-plans reads product-id env vars at CALL time (not import time), so a
 * static import is fine as long as the env is set before the functions run.
 */
import assert from 'node:assert/strict'
import { planToProduct, productToPlan } from '@/lib/polar-plans'
import { subscriptionUpdateFromEvent } from '@/services/billing.webhook'

process.env.POLAR_PRODUCT_PRO_MONTHLY = 'prod_pro_m'
process.env.POLAR_PRODUCT_PRO_ANNUAL = 'prod_pro_a'
process.env.POLAR_PRODUCT_TEAM_MONTHLY = 'prod_team_m'
process.env.POLAR_PRODUCT_TEAM_ANNUAL = 'prod_team_a'
process.env.POLAR_PRODUCT_BUSINESS_MONTHLY = 'prod_biz_m'
process.env.POLAR_PRODUCT_BUSINESS_ANNUAL = 'prod_biz_a'

let passed = 0
function check(name: string, fn: () => void) { fn(); passed++; console.log(`  ✓ ${name}`) }

console.log('polar-plans — planToProduct:')
check('paid plans map to their product ids', () => {
  assert.equal(planToProduct('PRO', 'monthly'), 'prod_pro_m')
  assert.equal(planToProduct('PRO', 'annual'), 'prod_pro_a')
  assert.equal(planToProduct('TEAM', 'monthly'), 'prod_team_m')
  assert.equal(planToProduct('BUSINESS', 'annual'), 'prod_biz_a')
})
check('FREE and ENTERPRISE have no product', () => {
  assert.equal(planToProduct('FREE', 'monthly'), null)
  assert.equal(planToProduct('ENTERPRISE', 'monthly'), null)
})

console.log('polar-plans — productToPlan (reverse):')
check('known product ids resolve back to {plan, period}', () => {
  assert.deepEqual(productToPlan('prod_pro_m'), { plan: 'PRO', period: 'monthly' })
  assert.deepEqual(productToPlan('prod_biz_a'), { plan: 'BUSINESS', period: 'annual' })
})
check('unknown product id → null', () => {
  assert.equal(productToPlan('nope'), null)
})
check('round-trips', () => {
  for (const plan of ['PRO', 'TEAM', 'BUSINESS'] as const) {
    for (const period of ['monthly', 'annual'] as const) {
      const id = planToProduct(plan, period)!
      assert.deepEqual(productToPlan(id), { plan, period })
    }
  }
})

const lookup = (id: string) => productToPlan(id)
const baseEvent = {
  productId: 'prod_team_m',
  status: 'active',
  currentPeriodEnd: '2026-07-24T00:00:00.000Z',
  recurringInterval: 'month',
  customerExternalId: 'org_123',
  customerId: 'cus_1',
  subscriptionId: 'sub_1',
  metadataOrganizationId: null,
}

console.log('billing.webhook — subscriptionUpdateFromEvent:')
check('active subscription → plan from product, status active', () => {
  const p = subscriptionUpdateFromEvent({ ...baseEvent, type: 'subscription.active' }, lookup)
  assert.ok(!('ignore' in p))
  if (!('ignore' in p)) {
    assert.equal(p.organizationId, 'org_123')
    assert.equal(p.plan, 'TEAM')
    assert.equal(p.status, 'active')
    assert.equal(p.interval, 'month')
    assert.equal(p.cancelAtPeriodEnd, false)
    assert.equal(p.externalSubscriptionId, 'sub_1')
    assert.equal(p.externalCustomerId, 'cus_1')
    assert.ok(p.currentPeriodEnd instanceof Date)
  }
})
check('canceled → keeps plan, sets cancelAtPeriodEnd', () => {
  const p = subscriptionUpdateFromEvent({ ...baseEvent, type: 'subscription.canceled' }, lookup)
  if (!('ignore' in p)) {
    assert.equal(p.plan, 'TEAM')
    assert.equal(p.cancelAtPeriodEnd, true)
  } else assert.fail('should not ignore')
})
check('revoked → plan FREE, status canceled', () => {
  const p = subscriptionUpdateFromEvent({ ...baseEvent, type: 'subscription.revoked' }, lookup)
  if (!('ignore' in p)) {
    assert.equal(p.plan, 'FREE')
    assert.equal(p.status, 'canceled')
  } else assert.fail('should not ignore')
})
check('resolves org from metadata when externalId missing', () => {
  const p = subscriptionUpdateFromEvent(
    { ...baseEvent, type: 'subscription.active', customerExternalId: null, metadataOrganizationId: 'org_meta' },
    lookup,
  )
  if (!('ignore' in p)) assert.equal(p.organizationId, 'org_meta')
  else assert.fail('should not ignore')
})
check('ignores non-subscription events', () => {
  const p = subscriptionUpdateFromEvent({ ...baseEvent, type: 'order.created' }, lookup)
  assert.deepEqual(p, { ignore: true, reason: 'unhandled_event' })
})
check('ignores unknown product (non-revoke)', () => {
  const p = subscriptionUpdateFromEvent({ ...baseEvent, type: 'subscription.active', productId: 'nope' }, lookup)
  assert.deepEqual(p, { ignore: true, reason: 'unknown_product' })
})
check('ignores when no org can be resolved', () => {
  const p = subscriptionUpdateFromEvent(
    { ...baseEvent, type: 'subscription.active', customerExternalId: null, metadataOrganizationId: null },
    lookup,
  )
  assert.deepEqual(p, { ignore: true, reason: 'no_org' })
})

console.log(`\n${passed} checks passed.`)
