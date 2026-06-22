/**
 * Verification harness for the request-access gate pure logic.
 * Pure (no DB / network) — run with: `npm run test:access`.
 *
 * Covers: validateAccessRequest (email normalize + note bounds + reject paths)
 * and shouldNotifyOwner (the notify-once guard).
 */
import assert from 'node:assert/strict'
import { validateAccessRequest, shouldNotifyOwner } from '@/lib/access-request'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('access-request — validateAccessRequest:')

check('valid email is trimmed + lowercased, no note → null', () => {
  const r = validateAccessRequest({ email: '  Foo.Bar@Gmail.com  ' })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.email, 'foo.bar@gmail.com')
    assert.equal(r.note, null)
  }
})

check('note is trimmed; whitespace-only note → null', () => {
  const r = validateAccessRequest({ email: 'a@b.com', note: '   ' })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.note, null)
})

check('note is kept (trimmed) when present', () => {
  const r = validateAccessRequest({ email: 'a@b.com', note: '  please add me  ' })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.note, 'please add me')
})

check('rejects missing / empty / whitespace email', () => {
  assert.equal(validateAccessRequest({}).ok, false)
  assert.equal(validateAccessRequest({ email: '' }).ok, false)
  assert.equal(validateAccessRequest({ email: '   ' }).ok, false)
})

check('rejects malformed email', () => {
  assert.equal(validateAccessRequest({ email: 'not-an-email' }).ok, false)
  assert.equal(validateAccessRequest({ email: 'a@b' }).ok, false)        // no TLD dot
  assert.equal(validateAccessRequest({ email: 'a b@c.com' }).ok, false)  // space
})

check('rejects non-string email', () => {
  assert.equal(validateAccessRequest({ email: 123 }).ok, false)
  assert.equal(validateAccessRequest({ email: null }).ok, false)
})

check('rejects note over 500 chars', () => {
  assert.equal(validateAccessRequest({ email: 'a@b.com', note: 'x'.repeat(501) }).ok, false)
  assert.equal(validateAccessRequest({ email: 'a@b.com', note: 'x'.repeat(500) }).ok, true)
})

check('rejects a non-string note that is present', () => {
  assert.equal(validateAccessRequest({ email: 'a@b.com', note: 123 }).ok, false)
})

console.log('access-request — shouldNotifyOwner:')

check('no existing row → notify', () => {
  assert.equal(shouldNotifyOwner(null), true)
})

check('existing row never notified → notify', () => {
  assert.equal(shouldNotifyOwner({ notifiedAt: null }), true)
})

check('existing row already notified → skip', () => {
  assert.equal(shouldNotifyOwner({ notifiedAt: new Date() }), false)
})

console.log(`\n${passed} checks passed.`)
