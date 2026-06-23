/**
 * Verification harness for the routing-rule matcher (src/services/rule.engine.ts).
 * Pure (no DB / network) — run with: `npm run test:rules`.
 */
import assert from 'node:assert/strict'
import { matchRule, evaluateRules, type RuleDef, type MailContext } from '@/services/rule.engine'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

const ctx: MailContext = { fromEmail: 'jane@acme.com', domain: 'acme.com', subject: 'Invoice #42 overdue', inboxId: 'inbox_1' }

console.log('rules — matchRule:')
check('empty condition never matches', () => {
  assert.equal(matchRule({}, ctx), false)
})
check('AND-matches sender + subject', () => {
  assert.equal(matchRule({ fromEquals: 'JANE@acme.com', subjectContains: 'invoice' }, ctx), true)
  assert.equal(matchRule({ fromEquals: 'jane@acme.com', subjectContains: 'refund' }, ctx), false)
})
check('domain + inbox match', () => {
  assert.equal(matchRule({ domainEquals: 'acme.com', inboxId: 'inbox_1' }, ctx), true)
  assert.equal(matchRule({ domainEquals: 'acme.com', inboxId: 'inbox_2' }, ctx), false)
})

console.log('rules — evaluateRules:')
check('scalars first-match-wins, tags union', () => {
  const rules: RuleDef[] = [
    { id: 'r1', conditions: { domainEquals: 'acme.com' }, actions: { assignMembershipId: 'm1', addTagIds: ['t1'], setPriority: 'ATTENTION' } },
    { id: 'r2', conditions: { subjectContains: 'overdue' }, actions: { assignMembershipId: 'm2', addTagIds: ['t2'], close: true } },
  ]
  const out = evaluateRules(rules, ctx)
  assert.equal(out.assignMembershipId, 'm1') // first match wins
  assert.equal(out.setPriority, 'ATTENTION')
  assert.equal(out.close, true)
  assert.deepEqual([...(out.addTagIds ?? [])].sort(), ['t1', 't2'])
})
check('no matching rule → empty actions', () => {
  const out = evaluateRules([{ id: 'r', conditions: { fromEquals: 'nobody@x.com' }, actions: { close: true } }], ctx)
  assert.deepEqual(out, {})
})

console.log(`\n${passed} checks passed.`)
