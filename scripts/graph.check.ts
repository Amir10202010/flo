/**
 * Verification harness for the knowledge-graph pure logic.
 * Pure (no DB / network) — run with: `npm run test:graph`.
 *
 * Covers: email domain → COMPANY key parsing incl. the public-provider
 * skip-list, topic-name → canonicalKey normalization, and upsert idempotency
 * (re-extraction bumps `weight`, never duplicates entities/edges) via the pure
 * GraphAccumulator that mirrors the service's Prisma upsert semantics.
 */
import assert from 'node:assert/strict'
import {
  companyFromEmail,
  emailDomain,
  normalizeTopicKey,
  contactNode,
  entityNode,
  GraphAccumulator,
  PUBLIC_EMAIL_PROVIDERS,
} from '@/services/graph.service'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('knowledge graph — company domain parsing:')

check('company from a corporate address → domain key + brand name', () => {
  assert.deepEqual(companyFromEmail('bob@acme.com'), { canonicalKey: 'acme.com', name: 'Acme' })
  assert.deepEqual(companyFromEmail('sales@stripe.io'), { canonicalKey: 'stripe.io', name: 'Stripe' })
})

check('multi-part TLD → registrable brand (co.uk / com.au)', () => {
  assert.deepEqual(companyFromEmail('a@team.acme.co.uk'), { canonicalKey: 'team.acme.co.uk', name: 'Acme' })
  assert.deepEqual(companyFromEmail('a@bhp.com.au'), { canonicalKey: 'bhp.com.au', name: 'Bhp' })
})

check('public providers are skipped (not companies)', () => {
  for (const p of ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com', 'proton.me']) {
    assert.ok(PUBLIC_EMAIL_PROVIDERS.has(p), `${p} in skip-list`)
    assert.equal(companyFromEmail(`someone@${p}`), null, `${p} → null`)
  }
})

check('case-insensitive domain; keys are lowercased', () => {
  assert.deepEqual(companyFromEmail('BOB@Acme.COM'), { canonicalKey: 'acme.com', name: 'Acme' })
  assert.equal(companyFromEmail('x@GMAIL.com'), null) // skip-list is case-insensitive too
})

check('missing / malformed addresses → null (never throws)', () => {
  assert.equal(companyFromEmail(null), null)
  assert.equal(companyFromEmail(undefined), null)
  assert.equal(companyFromEmail(''), null)
  assert.equal(companyFromEmail('not-an-email'), null)
  assert.equal(companyFromEmail('no-domain@'), null)
  assert.equal(companyFromEmail('a@localhost'), null) // no dot → not a registrable domain
})

check('emailDomain extracts + trims trailing punctuation', () => {
  assert.equal(emailDomain('a@acme.com'), 'acme.com')
  assert.equal(emailDomain('a@acme.com>'), 'acme.com')
  assert.equal(emailDomain('a@acme.com,'), 'acme.com')
  assert.equal(emailDomain('bad'), null)
})

console.log('\nknowledge graph — topic normalization:')

check('normalizeTopicKey lowercases, strips punctuation, collapses spaces', () => {
  assert.equal(normalizeTopicKey('Q3  Renewal!'), 'q3 renewal')
  assert.equal(normalizeTopicKey('  Pricing & Discounts  '), 'pricing discounts')
  assert.equal(normalizeTopicKey('Onboarding'), 'onboarding')
})

check('near-duplicate wording collapses to the same key', () => {
  assert.equal(normalizeTopicKey('API integration'), normalizeTopicKey('api   integration'))
  assert.equal(normalizeTopicKey('Q3-renewal'), normalizeTopicKey('Q3 renewal'))
})

check('non-latin topics normalize (unicode-aware), digits kept', () => {
  assert.equal(normalizeTopicKey('Оплата счёта'), 'оплата счёта')
  assert.equal(normalizeTopicKey('Invoice #1042'), 'invoice 1042')
})

console.log('\nknowledge graph — node refs:')

check('node ref builders are namespaced + collision-free', () => {
  assert.equal(contactNode('abc'), 'contact:abc')
  assert.equal(entityNode('abc'), 'entity:abc')
  assert.notEqual(contactNode('abc'), entityNode('abc'))
})

console.log('\nknowledge graph — upsert idempotency (GraphAccumulator):')

check('re-bumping the same entity increments weight, keeps ONE row', () => {
  const acc = new GraphAccumulator()
  const k1 = acc.bumpEntity('COMPANY', 'acme.com', 'Acme')
  const k2 = acc.bumpEntity('COMPANY', 'acme.com', 'Acme')
  assert.equal(k1, k2)
  assert.equal(acc.entities.size, 1)
  assert.equal(acc.entities.get(k1)?.weight, 2)
})

check('re-bumping the same edge increments weight, keeps ONE row', () => {
  const acc = new GraphAccumulator()
  const from = contactNode('c1')
  const to = entityNode('e1')
  acc.bumpEdge(from, to, 'WORKS_AT', 'conv1')
  acc.bumpEdge(from, to, 'WORKS_AT', 'conv2')
  assert.equal(acc.edges.size, 1)
  const edge = acc.edges.get(`${from}|${to}|WORKS_AT`)
  assert.equal(edge?.weight, 2)
  assert.equal(edge?.lastConversationId, 'conv2') // latest evidence wins
})

check('distinct entities / edge kinds stay separate', () => {
  const acc = new GraphAccumulator()
  acc.bumpEntity('COMPANY', 'acme.com', 'Acme')
  acc.bumpEntity('TOPIC', 'acme.com', 'acme.com') // same key, different type → separate node
  assert.equal(acc.entities.size, 2)

  const from = contactNode('c1')
  const to = entityNode('e1')
  acc.bumpEdge(from, to, 'WORKS_AT', null)
  acc.bumpEdge(from, to, 'DISCUSSED', null) // same endpoints, different kind → separate edge
  assert.equal(acc.edges.size, 2)
})

check('simulated re-extraction of one conversation is idempotent', () => {
  // Mirrors upsertCompanyEdge + extractGraphEntities: contact bob@acme.com
  // discussing "Q3 renewal", run twice.
  const acc = new GraphAccumulator()
  const contact = { id: 'c1', email: 'bob@acme.com' }
  const topicNames = ['Q3 Renewal']

  function extractOnce(conversationId: string) {
    const company = companyFromEmail(contact.email)!
    const companyKey = acc.bumpEntity('COMPANY', company.canonicalKey, company.name)
    const companyRef = entityNode(companyKey) // stand-in for the DB entity id
    acc.bumpEdge(contactNode(contact.id), companyRef, 'WORKS_AT', conversationId)
    for (const name of topicNames) {
      const topicKey = acc.bumpEntity('TOPIC', normalizeTopicKey(name), name)
      const topicRef = entityNode(topicKey)
      acc.bumpEdge(contactNode(contact.id), topicRef, 'DISCUSSED', conversationId)
      acc.bumpEdge(companyRef, topicRef, 'DISCUSSED', conversationId)
    }
  }

  extractOnce('conv1')
  extractOnce('conv1') // re-run

  // 2 entities (company + topic), 3 edges (WORKS_AT, contact→topic, company→topic).
  assert.equal(acc.entities.size, 2)
  assert.equal(acc.edges.size, 3)
  // Every weight doubled to 2 — evidence bumped, nothing duplicated.
  for (const e of acc.entities.values()) assert.equal(e.weight, 2)
  for (const e of acc.edges.values()) assert.equal(e.weight, 2)
})

console.log(`\nAll ${passed} knowledge-graph scenarios passed.`)
