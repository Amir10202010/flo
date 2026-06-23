/**
 * Verification harness for the billing plan catalog (src/lib/billing.ts).
 * Pure (no DB / network) — run with: `npm run test:billing`.
 */
import assert from 'node:assert/strict'
import { canAddSeat, canAddInbox, canAddRule, hasFeature, monthlyTotal, planLimits } from '@/lib/billing'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('billing — seat limits:')
check('FREE caps at 3 members', () => {
  assert.equal(canAddSeat('FREE', 2), true)
  assert.equal(canAddSeat('FREE', 3), false)
})
check('BUSINESS / ENTERPRISE are unlimited members', () => {
  assert.equal(canAddSeat('BUSINESS', 9999), true)
  assert.equal(canAddSeat('ENTERPRISE', 100000), true)
})

console.log('billing — inbox limits:')
check('FREE allows 1 inbox, TEAM 3', () => {
  assert.equal(canAddInbox('FREE', 0), true)
  assert.equal(canAddInbox('FREE', 1), false)
  assert.equal(canAddInbox('TEAM', 2), true)
  assert.equal(canAddInbox('TEAM', 3), false)
})

console.log('billing — automations gating:')
check('FREE has no automations; TEAM+ do', () => {
  assert.equal(canAddRule('FREE', 0), false)
  assert.equal(hasFeature('FREE', 'automations'), false)
  assert.equal(canAddRule('TEAM', 0), true)
  assert.equal(hasFeature('TEAM', 'automations'), true)
})
check('audit is Business+ only', () => {
  assert.equal(hasFeature('FREE', 'audit'), false)
  assert.equal(hasFeature('TEAM', 'audit'), false)
  assert.equal(hasFeature('BUSINESS', 'audit'), true)
  assert.equal(hasFeature('ENTERPRISE', 'audit'), true)
})

console.log('billing — pricing math:')
check('per-seat totals; enterprise is custom (null)', () => {
  assert.equal(monthlyTotal('FREE', 3), 0)
  assert.equal(monthlyTotal('TEAM', 5), 60)
  assert.equal(monthlyTotal('BUSINESS', 10), 240)
  assert.equal(monthlyTotal('ENTERPRISE', 50), null)
})
check('analytics history grows with plan', () => {
  assert.ok(planLimits('TEAM').analyticsHistoryDays > planLimits('FREE').analyticsHistoryDays)
  assert.ok(planLimits('BUSINESS').analyticsHistoryDays >= planLimits('TEAM').analyticsHistoryDays)
})

console.log(`\n${passed} checks passed.`)
