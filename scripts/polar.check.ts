/**
 * Pure tests for the Polar plan↔product mapping (src/lib/polar-plans.ts).
 * Run with: `npm run test:polar`.
 *
 * polar-plans reads product-id env vars at CALL time (not import time), so a
 * static import is fine as long as the env is set before the functions run.
 */
import assert from 'node:assert/strict'
import { planToProduct, productToPlan } from '@/lib/polar-plans'

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

console.log(`\n${passed} checks passed.`)
