/**
 * Verification harness for the billing plan catalog (src/lib/billing.ts).
 * Pure (no DB / network) — run with: `npm run test:billing`.
 */
import assert from 'node:assert/strict'
import { canAddSeat, canAddInbox, canAddRule, hasFeature, planPrice, planLimits } from '@/lib/billing'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('billing — seat limits:')
check('FREE and PRO are solo (1 seat)', () => {
  assert.equal(canAddSeat('FREE', 0), true)
  assert.equal(canAddSeat('FREE', 1), false)
  assert.equal(canAddSeat('PRO', 0), true)
  assert.equal(canAddSeat('PRO', 1), false)
})
check('TEAM caps at 5, BUSINESS at 20', () => {
  assert.equal(canAddSeat('TEAM', 4), true)
  assert.equal(canAddSeat('TEAM', 5), false)
  assert.equal(canAddSeat('BUSINESS', 19), true)
  assert.equal(canAddSeat('BUSINESS', 20), false)
})
check('ENTERPRISE is unlimited members', () => {
  assert.equal(canAddSeat('ENTERPRISE', 100000), true)
})

console.log('billing — inbox limits:')
check('FREE/PRO 1 inbox, TEAM 3, BUSINESS 10', () => {
  assert.equal(canAddInbox('FREE', 0), true)
  assert.equal(canAddInbox('FREE', 1), false)
  assert.equal(canAddInbox('PRO', 1), false)
  assert.equal(canAddInbox('TEAM', 2), true)
  assert.equal(canAddInbox('TEAM', 3), false)
  assert.equal(canAddInbox('BUSINESS', 9), true)
})

console.log('billing — feature gates:')
check('automations are TEAM+', () => {
  assert.equal(canAddRule('FREE', 0), false)
  assert.equal(canAddRule('PRO', 0), false)
  assert.equal(canAddRule('TEAM', 0), true)
  assert.equal(hasFeature('TEAM', 'automations'), true)
})
check('audit is BUSINESS+', () => {
  assert.equal(hasFeature('FREE', 'audit'), false)
  assert.equal(hasFeature('TEAM', 'audit'), false)
  assert.equal(hasFeature('BUSINESS', 'audit'), true)
})
check('AI features are Pro+ (off for Free)', () => {
  for (const f of ['aiDrafts', 'digest', 'assistant'] as const) {
    assert.equal(hasFeature('FREE', f), false)
    assert.equal(hasFeature('PRO', f), true)
    assert.equal(hasFeature('TEAM', f), true)
    assert.equal(hasFeature('BUSINESS', f), true)
  }
})

console.log('billing — pricing (flat):')
check('flat monthly/annual prices; enterprise custom (null)', () => {
  assert.equal(planPrice('FREE', 'monthly'), 0)
  assert.equal(planPrice('PRO', 'monthly'), 12)
  assert.equal(planPrice('PRO', 'annual'), 120)
  assert.equal(planPrice('TEAM', 'monthly'), 40)
  assert.equal(planPrice('TEAM', 'annual'), 400)
  assert.equal(planPrice('BUSINESS', 'monthly'), 120)
  assert.equal(planPrice('BUSINESS', 'annual'), 1200)
  assert.equal(planPrice('ENTERPRISE', 'monthly'), null)
})
check('annual is 10× monthly (2 months free)', () => {
  for (const p of ['PRO', 'TEAM', 'BUSINESS'] as const) {
    assert.equal(planPrice(p, 'annual'), (planPrice(p, 'monthly') as number) * 10)
  }
})
check('analytics history grows with plan', () => {
  assert.ok(planLimits('PRO').analyticsHistoryDays > planLimits('FREE').analyticsHistoryDays)
  assert.ok(planLimits('BUSINESS').analyticsHistoryDays >= planLimits('TEAM').analyticsHistoryDays)
})

console.log(`\n${passed} checks passed.`)
