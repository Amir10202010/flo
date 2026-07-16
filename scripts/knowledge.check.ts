/**
 * Verification harness for the knowledge-base pure logic.
 * Pure (no DB / network) — run with: `npm run test:knowledge`.
 *
 * Covers: fact dedupe-key stability/normalization, mention-name → contact-id
 * resolution, name-keyed company canonical keys, and the deterministic /
 * AI-inferred edge-kind split the UI's honesty labels rely on.
 */
import assert from 'node:assert/strict'
import {
  companyNameKey,
  factDedupeKey,
  normalizeFactText,
  resolveMentionedContacts,
} from '@/services/knowledge.extract'
import {
  AI_EDGE_KINDS,
  isDeterministicEdge,
  meetingNode,
  noteNode,
  type GraphEdgeKindName,
} from '@/services/graph.service'
import { detectMeetingProvider, hasCalendarScope, knowsPairs } from '@/services/calendar.service'
import { matchNodesInText } from '@/services/knowledge.recall'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('knowledge base — fact dedupe keys:')

check('same fact → same key; key is a 40-char sha1 hex', () => {
  const a = factDedupeKey('u1', 'DECISION', 'conversation', 'c1', 'Agreed to start with the monthly plan')
  const b = factDedupeKey('u1', 'DECISION', 'conversation', 'c1', 'Agreed to start with the monthly plan')
  assert.equal(a, b)
  assert.match(a, /^[0-9a-f]{40}$/)
})

check('whitespace / case variations normalize to the same key', () => {
  const a = factDedupeKey('u1', 'RISK', 'meeting', 'm1', '  Worried   about the TIMELINE ')
  const b = factDedupeKey('u1', 'RISK', 'meeting', 'm1', 'worried about the timeline')
  assert.equal(a, b)
  assert.equal(normalizeFactText('  Worried   about the TIMELINE '), 'worried about the timeline')
})

check('any differing dimension changes the key (user, kind, source, text)', () => {
  const base = factDedupeKey('u1', 'ACTION_ITEM', 'note', 'n1', 'Send the quote')
  assert.notEqual(base, factDedupeKey('u2', 'ACTION_ITEM', 'note', 'n1', 'Send the quote'))
  assert.notEqual(base, factDedupeKey('u1', 'DECISION', 'note', 'n1', 'Send the quote'))
  assert.notEqual(base, factDedupeKey('u1', 'ACTION_ITEM', 'meeting', 'n1', 'Send the quote'))
  assert.notEqual(base, factDedupeKey('u1', 'ACTION_ITEM', 'note', 'n2', 'Send the quote'))
  assert.notEqual(base, factDedupeKey('u1', 'ACTION_ITEM', 'note', 'n1', 'Send the invoice'))
})

console.log('\nknowledge base — mention resolution:')

const CONTACTS = [
  { id: 'c-anna', name: 'Anna Schmidt', email: 'anna@acme.com' },
  { id: 'c-john', name: 'John Smith', email: 'john@beta.io' },
  { id: 'c-john2', name: 'John Smith', email: 'john@gamma.co' }, // duplicate name, later in list
  { id: 'c-lena', name: 'Лена Иванова', email: null },
]

check('exact names resolve to ids (case-insensitive), order preserved', () => {
  assert.deepEqual(resolveMentionedContacts(['john smith', 'ANNA SCHMIDT'], CONTACTS), ['c-john', 'c-anna'])
})

check('ambiguous duplicate name resolves to the FIRST contact in list order', () => {
  assert.deepEqual(resolveMentionedContacts(['John Smith'], CONTACTS), ['c-john'])
})

check('unknown names are dropped; duplicates collapse; unicode names work', () => {
  assert.deepEqual(resolveMentionedContacts(['Nobody Real', 'Лена Иванова', 'лена иванова'], CONTACTS), ['c-lena'])
  assert.deepEqual(resolveMentionedContacts([], CONTACTS), [])
  assert.deepEqual(resolveMentionedContacts(['Anna Schmidt'], []), [])
})

console.log('\nknowledge base — name-keyed companies:')

check('company name → prefixed, normalized canonical key', () => {
  assert.equal(companyNameKey('Acme Corp'), 'name:acme corp')
  assert.equal(companyNameKey('  Über-Labs GmbH! '), 'name:über labs gmbh')
})

check('unusable names → null (too short after normalizing)', () => {
  assert.equal(companyNameKey(''), null)
  assert.equal(companyNameKey('!'), null)
  assert.equal(companyNameKey('a'), null)
})

check('name-keyed namespace can never collide with domain keys', () => {
  // Domain canonical keys are bare domains ("acme.com"); name keys are prefixed.
  assert.ok(companyNameKey('acme.com')!.startsWith('name:'))
})

console.log('\nknowledge base — edge provenance split:')

check('deterministic kinds: WORKS_AT / ATTENDED / KNOWS; AI kinds: DISCUSSED / MENTIONS', () => {
  const det: GraphEdgeKindName[] = ['WORKS_AT', 'ATTENDED', 'KNOWS']
  const ai: GraphEdgeKindName[] = ['DISCUSSED', 'MENTIONS']
  for (const k of det) assert.ok(isDeterministicEdge(k), `${k} deterministic`)
  for (const k of ai) assert.ok(!isDeterministicEdge(k), `${k} AI-inferred`)
  assert.equal(AI_EDGE_KINDS.size, ai.length)
})

check('meeting/note node refs use their own prefixes', () => {
  assert.equal(meetingNode('m1'), 'meeting:m1')
  assert.equal(noteNode('n1'), 'note:n1')
})

console.log('\nknowledge base — meeting detection:')

check('provider detected from conference URLs (Meet, Zoom, else OTHER)', () => {
  assert.equal(detectMeetingProvider(['https://meet.google.com/abc-defg-hij']), 'GOOGLE_MEET')
  assert.equal(detectMeetingProvider([null, 'Join: https://us02web.zoom.us/j/123456']), 'ZOOM')
  assert.equal(detectMeetingProvider(['https://zoom.com/j/9']), 'ZOOM')
  assert.equal(detectMeetingProvider(['https://teams.microsoft.com/l/x', 'Room 4']), 'OTHER')
  assert.equal(detectMeetingProvider([]), 'OTHER')
})

check('zoom detection does not fire on lookalike domains', () => {
  assert.equal(detectMeetingProvider(['https://notzoom.us/j/1']), 'OTHER')
  assert.equal(detectMeetingProvider(['https://gazoom.com/x']), 'OTHER')
})

check('co-attendance pairs are canonical (sorted, unique, no self-pairs)', () => {
  assert.deepEqual(knowsPairs(['b', 'a']), [['a', 'b']])
  assert.deepEqual(knowsPairs(['c', 'a', 'b']), [['a', 'b'], ['a', 'c'], ['b', 'c']])
  assert.deepEqual(knowsPairs(['a', 'a']), [])
  assert.deepEqual(knowsPairs(['solo']), [])
  assert.deepEqual(knowsPairs([]), [])
})

check('calendar scope gate reads the recorded grant', () => {
  assert.ok(hasCalendarScope({ grantedScopes: 'openid https://www.googleapis.com/auth/calendar.readonly' }))
  assert.ok(!hasCalendarScope({ grantedScopes: 'https://www.googleapis.com/auth/gmail.readonly' }))
  assert.ok(!hasCalendarScope({}))
  assert.ok(!hasCalendarScope(null))
})

console.log('\nknowledge base — assistant recall matching:')

const RECALL_CANDIDATES = [
  { ref: 'contact:john', label: 'John Smith', weight: 5, person: true },
  { ref: 'entity:acme', label: 'Acme', weight: 8 },
  { ref: 'entity:pricing', label: 'Pricing', weight: 6 },
  { ref: 'entity:email-mkt', label: 'Email marketing', weight: 3 },
]

check('full labels match as whole words; people also match on first name', () => {
  assert.deepEqual(matchNodesInText('What did we discuss with John about pricing?', RECALL_CANDIDATES), [
    'entity:pricing',
    'contact:john',
  ])
  assert.deepEqual(matchNodesInText('Where do things stand with Acme?', RECALL_CANDIDATES), ['entity:acme'])
})

check('topic words never match on partial tokens (no "email" → "Email marketing")', () => {
  assert.deepEqual(matchNodesInText('Draft an email to my quietest client', RECALL_CANDIDATES), [])
  assert.deepEqual(matchNodesInText('How is our email marketing doing?', RECALL_CANDIDATES), ['entity:email-mkt'])
})

check('no matches → empty; punctuation and case are ignored', () => {
  assert.deepEqual(matchNodesInText('Who should I follow up with today?', RECALL_CANDIDATES), [])
  assert.deepEqual(matchNodesInText('ACME!!!', RECALL_CANDIDATES), ['entity:acme'])
})

console.log(`\nAll ${passed} knowledge-base scenarios passed.`)
