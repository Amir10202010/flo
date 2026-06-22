/**
 * Verification harness for the RBAC matrix (src/lib/permissions.ts).
 * Pure (no DB / network) — run with: `npm run test:permissions`.
 *
 * Encodes the permission table from the B2B spec so a future edit that widens
 * or narrows a role's powers fails loudly here.
 */
import assert from 'node:assert/strict'
import { can, atLeast, canManageMember, assignableRoles } from '@/lib/permissions'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('permissions — read access (everyone, incl. viewer):')
check('all roles can read inbox + analytics', () => {
  for (const r of ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const) {
    assert.equal(can(r, 'inbox:read'), true)
    assert.equal(can(r, 'analytics:read'), true)
  }
})

console.log('permissions — write/collaboration (member+, not viewer):')
check('member+ can write inbox; viewer cannot', () => {
  assert.equal(can('MEMBER', 'inbox:write'), true)
  assert.equal(can('ADMIN', 'inbox:write'), true)
  assert.equal(can('OWNER', 'inbox:write'), true)
  assert.equal(can('VIEWER', 'inbox:write'), false)
})

console.log('permissions — admin-only management:')
check('inbox/rules/templates/tags/members/billing/audit require admin+', () => {
  const adminActions = [
    'inbox:manage', 'rules:manage', 'templates:manage', 'tags:manage',
    'members:manage', 'billing:manage', 'audit:read', 'org:settings',
  ] as const
  for (const a of adminActions) {
    assert.equal(can('ADMIN', a), true, `admin should ${a}`)
    assert.equal(can('OWNER', a), true, `owner should ${a}`)
    assert.equal(can('MEMBER', a), false, `member should NOT ${a}`)
    assert.equal(can('VIEWER', a), false, `viewer should NOT ${a}`)
  }
})

console.log('permissions — owner-only:')
check('only owner can delete org / transfer ownership', () => {
  assert.equal(can('OWNER', 'org:delete'), true)
  assert.equal(can('ADMIN', 'org:delete'), false)
  assert.equal(can('MEMBER', 'org:delete'), false)
  assert.equal(can('VIEWER', 'org:delete'), false)
})

console.log('permissions — atLeast hierarchy:')
check('rank ordering OWNER > ADMIN > MEMBER > VIEWER', () => {
  assert.equal(atLeast('OWNER', 'VIEWER'), true)
  assert.equal(atLeast('ADMIN', 'MEMBER'), true)
  assert.equal(atLeast('MEMBER', 'ADMIN'), false)
  assert.equal(atLeast('VIEWER', 'MEMBER'), false)
})

console.log('permissions — canManageMember (no privilege escalation):')
check('admin cannot manage an owner; owner can', () => {
  assert.equal(canManageMember('ADMIN', 'OWNER'), false)
  assert.equal(canManageMember('OWNER', 'OWNER'), true)
  assert.equal(canManageMember('ADMIN', 'MEMBER'), true)
  assert.equal(canManageMember('ADMIN', 'ADMIN'), true)
  assert.equal(canManageMember('MEMBER', 'VIEWER'), false) // member can't manage anyone
})

console.log('permissions — assignableRoles:')
check('only owner can grant OWNER; admin tops out at admin', () => {
  assert.deepEqual(assignableRoles('OWNER'), ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
  assert.deepEqual(assignableRoles('ADMIN'), ['ADMIN', 'MEMBER', 'VIEWER'])
  assert.deepEqual(assignableRoles('MEMBER'), ['MEMBER', 'VIEWER'])
})

console.log(`\n${passed} checks passed.`)
