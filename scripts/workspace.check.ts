/**
 * Verification harness for the adaptive-workspace metadata core:
 * blueprint contract (src/lib/workspace/blueprint.ts), field-type registry,
 * terminology resolution. Pure (no DB / network) — run with:
 * `npm run test:workspace`.
 *
 * Later sections (added with their features): industry templates integrity,
 * generator customization.
 */
import assert from 'node:assert/strict'
import { safeParseBlueprint, MAX_OBJECTS } from '@/lib/workspace/blueprint'
import { validateRecordData, FIELD_TYPES, type FieldSpec } from '@/lib/workspace/field-types'
import { isWorkspaceIcon, WORKSPACE_ICON_NAMES } from '@/lib/workspace/icons'
import { resolveTerm } from '@/lib/workspace/terminology'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

/** A minimal, structurally valid blueprint as untrusted JSON input. */
function baseBlueprint(): Record<string, unknown> {
  return {
    profile: { industryKey: 'generic', industryLabel: 'General business' },
    terminology: { contact: { singular: 'Client', plural: 'Clients' } },
    objects: [
      {
        key: 'deal',
        singular: 'Deal',
        plural: 'Deals',
        icon: 'target',
        fields: [
          { key: 'value', label: 'Deal value', type: 'MONEY', currency: 'USD' },
          { key: 'notes', label: 'Notes', type: 'LONG_TEXT', showInList: false },
        ],
        pipeline: [
          { key: 'lead', label: 'Lead' },
          { key: 'won', label: 'Won', terminal: true },
        ],
      },
    ],
    dashboard: [{ type: 'object-count', objectKey: 'deal' }],
    copilot: { title: 'Sales copilot' },
    automationIdeas: ['Follow up on stale deals'],
  }
}

console.log('blueprint — parsing & bounds:')
check('valid minimal blueprint parses', () => {
  const r = safeParseBlueprint(baseBlueprint())
  assert.equal(r.ok, true, r.ok ? '' : r.error)
  if (r.ok) {
    assert.equal(r.blueprint.objects[0].key, 'deal')
    assert.equal(r.blueprint.objects[0].fields[0].type, 'MONEY')
    assert.equal(r.blueprint.objects[0].pipeline?.[1].terminal, true)
  }
})

check('duplicate object keys rejected', () => {
  const b = baseBlueprint()
  const objects = b.objects as Record<string, unknown>[]
  objects.push({ ...objects[0] })
  assert.equal(safeParseBlueprint(b).ok, false)
})

check('reserved object key rejected', () => {
  const b = baseBlueprint()
  ;(b.objects as Record<string, unknown>[])[0].key = 'settings'
  assert.equal(safeParseBlueprint(b).ok, false)
})

check('malformed object key rejected', () => {
  const b = baseBlueprint()
  ;(b.objects as Record<string, unknown>[])[0].key = 'Bad Key!'
  assert.equal(safeParseBlueprint(b).ok, false)
})

check('unknown icon rejected', () => {
  const b = baseBlueprint()
  ;(b.objects as Record<string, unknown>[])[0].icon = 'unicorn-3000'
  assert.equal(safeParseBlueprint(b).ok, false)
})

check('too many objects rejected', () => {
  const b = baseBlueprint()
  const proto = (b.objects as Record<string, unknown>[])[0]
  b.objects = Array.from({ length: MAX_OBJECTS + 1 }, (_, i) => ({
    ...proto,
    key: `obj_${i}`,
    pipeline: undefined,
  }))
  assert.equal(safeParseBlueprint(b).ok, false)
})

check('duplicate stage keys rejected', () => {
  const b = baseBlueprint()
  const obj = (b.objects as Record<string, unknown>[])[0]
  obj.pipeline = [
    { key: 'lead', label: 'Lead' },
    { key: 'lead', label: 'Lead again' },
  ]
  assert.equal(safeParseBlueprint(b).ok, false)
})

console.log('blueprint — normalization:')
check('widget referencing unknown object is dropped', () => {
  const b = baseBlueprint()
  ;(b.dashboard as Record<string, unknown>[]).push({ type: 'object-count', objectKey: 'ghost' })
  const r = safeParseBlueprint(b)
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.blueprint.dashboard.length, 1)
})

check('stage-breakdown widget for pipeline-less object is dropped', () => {
  const b = baseBlueprint()
  const obj = (b.objects as Record<string, unknown>[])[0]
  delete obj.pipeline
  b.dashboard = [{ type: 'stage-breakdown', objectKey: 'deal' }]
  const r = safeParseBlueprint(b)
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.blueprint.dashboard.length, 0)
})

console.log('field types — record data validation:')
const fields: FieldSpec[] = [
  { key: 'name', label: 'Full name', type: 'TEXT', required: true, showInList: true, order: 0 },
  { key: 'age', label: 'Age', type: 'NUMBER', required: false, showInList: true, order: 1 },
  { key: 'plan', label: 'Insurance plan', type: 'SELECT', required: false, showInList: true, order: 2, options: ['Basic', 'Premium'] },
  { key: 'tags', label: 'Tags', type: 'MULTI_SELECT', required: false, showInList: false, order: 3, options: ['vip', 'new'] },
  { key: 'visit', label: 'Next visit', type: 'DATE', required: false, showInList: true, order: 4 },
  { key: 'due', label: 'Due at', type: 'DATETIME', required: false, showInList: false, order: 5 },
  { key: 'active', label: 'Active', type: 'BOOLEAN', required: false, showInList: false, order: 6 },
  { key: 'budget', label: 'Budget', type: 'MONEY', required: false, showInList: true, order: 7, currency: 'USD' },
  { key: 'email', label: 'Email', type: 'EMAIL', required: false, showInList: false, order: 8 },
  { key: 'site', label: 'Website', type: 'URL', required: false, showInList: false, order: 9 },
  { key: 'phone', label: 'Phone', type: 'PHONE', required: false, showInList: false, order: 10 },
]

check('missing required field errors with its label', () => {
  const r = validateRecordData(fields, { age: 30 })
  assert.equal(r.ok, false)
  if (!r.ok) assert.ok(r.errors.join(' ').includes('Full name'))
})

check('partial mode skips required check', () => {
  const r = validateRecordData(fields, { age: 30 }, { partial: true })
  assert.equal(r.ok, true)
})

check('NUMBER coerces numeric strings and rejects garbage', () => {
  const good = validateRecordData(fields, { name: 'A', age: '42' })
  assert.equal(good.ok, true)
  if (good.ok) assert.equal(good.data.age, 42)
  const bad = validateRecordData(fields, { name: 'A', age: 'abc' })
  assert.equal(bad.ok, false)
})

check('SELECT enforces options', () => {
  assert.equal(validateRecordData(fields, { name: 'A', plan: 'Premium' }).ok, true)
  assert.equal(validateRecordData(fields, { name: 'A', plan: 'Gold' }).ok, false)
})

check('MULTI_SELECT keeps only known options', () => {
  const r = validateRecordData(fields, { name: 'A', tags: ['vip', 'bogus'] })
  assert.equal(r.ok, true)
  if (r.ok) assert.deepEqual(r.data.tags, ['vip'])
})

check('DATE accepts ISO date, rejects prose', () => {
  assert.equal(validateRecordData(fields, { name: 'A', visit: '2026-07-02' }).ok, true)
  assert.equal(validateRecordData(fields, { name: 'A', visit: 'tomorrow' }).ok, false)
})

check('DATETIME accepts ISO datetime', () => {
  assert.equal(validateRecordData(fields, { name: 'A', due: '2026-07-02T10:30' }).ok, true)
  assert.equal(validateRecordData(fields, { name: 'A', due: 'soon' }).ok, false)
})

check('BOOLEAN coerces checkbox-style strings', () => {
  const r = validateRecordData(fields, { name: 'A', active: 'true' })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.data.active, true)
})

check('MONEY coerces and formats with currency', () => {
  const r = validateRecordData(fields, { name: 'A', budget: '1200.50' })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.data.budget, 1200.5)
  const spec = fields.find((f) => f.key === 'budget')!
  const label = FIELD_TYPES.MONEY.format(1200.5, spec)
  assert.ok(label.includes('1,200'), `got "${label}"`)
})

check('EMAIL/URL/PHONE validate shape', () => {
  assert.equal(validateRecordData(fields, { name: 'A', email: 'a@b.co' }).ok, true)
  assert.equal(validateRecordData(fields, { name: 'A', email: 'nope' }).ok, false)
  assert.equal(validateRecordData(fields, { name: 'A', site: 'https://x.dev' }).ok, true)
  assert.equal(validateRecordData(fields, { name: 'A', site: 'not a url' }).ok, false)
  assert.equal(validateRecordData(fields, { name: 'A', phone: '+7 701 123 45 67' }).ok, true)
  assert.equal(validateRecordData(fields, { name: 'A', phone: '¯\\_(ツ)_/¯' }).ok, false)
})

check('unknown data keys are stripped', () => {
  const r = validateRecordData(fields, { name: 'A', hacker: 'payload' })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal('hacker' in r.data, false)
})

check('empty optional values are allowed and normalized out', () => {
  const r = validateRecordData(fields, { name: 'A', age: '', plan: '' })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal('age' in r.data, false)
    assert.equal('plan' in r.data, false)
  }
})

console.log('icons:')
check('curated icon names are recognized; junk is not', () => {
  assert.ok(WORKSPACE_ICON_NAMES.length >= 20)
  for (const n of WORKSPACE_ICON_NAMES) assert.ok(isWorkspaceIcon(n), n)
  assert.equal(isWorkspaceIcon('unicorn-3000'), false)
})

console.log('terminology:')
check('resolveTerm prefers overrides, falls back to defaults, then identity', () => {
  const map = { contact: { singular: 'Patient', plural: 'Patients' } }
  assert.deepEqual(resolveTerm(map, 'contact'), { singular: 'Patient', plural: 'Patients' })
  assert.deepEqual(resolveTerm({}, 'contact'), { singular: 'Client', plural: 'Clients' })
  assert.deepEqual(resolveTerm(undefined, 'conversation').plural, 'Conversations')
})

console.log(`\n${passed} checks passed.`)
