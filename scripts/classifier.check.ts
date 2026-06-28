/**
 * Verification harness for the rule-based email classifier.
 * Pure (no DB / network) — run with: `npm run test:classifier`.
 *
 * Covers each category, learned-rule precedence, and resilience to empty /
 * malformed input (must never throw, must fall back to PRIMARY).
 */
import assert from 'node:assert/strict'
import {
  classifyEmail,
  type ClassificationSignals,
  type ClassifierRule,
} from '@/services/email.classifier'

function signals(partial: Partial<ClassificationSignals>): ClassificationSignals {
  return {
    senderEmail: 'someone@example.com',
    senderName: 'Someone Example',
    subject: '',
    body: '',
    gmailLabels: [],
    hasListUnsubscribe: false,
    hasUserReplied: false,
    ...partial,
  }
}

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('email classifier — scenarios:')

check('invoice / payment → SERVICES', () => {
  const r = classifyEmail(
    signals({
      senderEmail: 'billing@acme.com',
      senderName: 'Acme Billing',
      subject: 'Invoice #1024 — payment receipt',
      body: 'Your invoice is attached. Payment of $200 received. Order confirmation enclosed.',
    }),
  )
  assert.equal(r.category, 'SERVICES')
})

check('sale / marketing → PROMOTIONS', () => {
  const r = classifyEmail(
    signals({
      senderEmail: 'deals@store.com',
      senderName: 'Store Deals',
      subject: 'Summer SALE — 50% off everything',
      body: 'Limited time offer. Shop now and enjoy free shipping. Best price guaranteed.',
      hasListUnsubscribe: true,
    }),
  )
  assert.equal(r.category, 'PROMOTIONS')
})

check('digest + List-Unsubscribe → NEWSLETTERS', () => {
  const r = classifyEmail(
    signals({
      senderEmail: 'newsletter@substack.com',
      senderName: 'The Weekly',
      subject: 'Your weekly digest is here',
      body: 'This week: three stories. View in browser. Unsubscribe anytime.',
      hasListUnsubscribe: true,
    }),
  )
  assert.equal(r.category, 'NEWSLETTERS')
})

check('spam wording → SPAM', () => {
  const r = classifyEmail(
    signals({
      senderEmail: 'winner@lotto-prize.biz',
      senderName: 'Prize Team',
      subject: 'Congratulations you are a WINNER',
      body: 'You have won the lottery! Claim your prize now, this is not a scam.',
    }),
  )
  assert.equal(r.category, 'SPAM')
})

check('Gmail SPAM label → SPAM (overrides content)', () => {
  const r = classifyEmail(
    signals({ subject: 'Project update', body: 'Hello, here is the plan.', gmailLabels: ['SPAM'] }),
  )
  assert.equal(r.category, 'SPAM')
  assert.equal(r.confidence > 0.9, true)
})

check('Gmail CATEGORY_PROMOTIONS → PROMOTIONS', () => {
  const r = classifyEmail(
    signals({
      senderEmail: 'news@brand.com',
      subject: 'New arrivals just dropped',
      body: 'Check out the latest collection.',
      gmailLabels: ['CATEGORY_PROMOTIONS'],
      hasListUnsubscribe: true,
    }),
  )
  assert.equal(r.category, 'PROMOTIONS')
})

check('two-way human thread → CLIENTS', () => {
  const r = classifyEmail(
    signals({
      senderEmail: 'jane@bigcorp.com',
      senderName: 'Jane Doe',
      subject: 'Re: project proposal',
      body: 'Thanks for the proposal — can we schedule a call to discuss the contract?',
      hasUserReplied: true,
    }),
  )
  assert.equal(r.category, 'CLIENTS')
})

check('named human, no reply, no signals → PRIMARY', () => {
  const r = classifyEmail(
    signals({
      senderEmail: 'mike@gmail.com',
      senderName: 'Mike Brown',
      subject: 'Quick question',
      body: 'Hey, do you have a minute later today?',
    }),
  )
  assert.equal(r.category, 'PRIMARY')
})

check('bulk promo mentioning "proposal" never becomes CLIENTS', () => {
  const r = classifyEmail(
    signals({
      senderEmail: 'marketing@brand.com',
      senderName: 'Brand Marketing',
      subject: 'A special proposal just for you — 40% off',
      body: 'Our proposal: limited-time offer, big discount inside. Shop now!',
      hasListUnsubscribe: true,
    }),
  )
  assert.notEqual(r.category, 'CLIENTS')
})

check('no-reply automated sender with client wording → not CLIENTS', () => {
  const r = classifyEmail(
    signals({
      senderEmail: 'no-reply@app.com',
      senderName: 'App',
      subject: 'Your project kickoff is scheduled',
      body: 'The onboarding deliverable is ready. Estimate attached.',
    }),
  )
  assert.notEqual(r.category, 'CLIENTS')
})

check('classifier always returns a 0..1 confidence', () => {
  const r = classifyEmail(signals({ subject: 'hi', body: 'hello there' }))
  assert.equal(typeof r.confidence, 'number')
  assert.equal(r.confidence >= 0 && r.confidence <= 1, true)
})

check('learned email rule overrides heuristics', () => {
  const rules: ClassifierRule[] = [{ matchType: 'email', value: 'deals@store.com', category: 'CLIENTS' }]
  const r = classifyEmail(
    signals({
      senderEmail: 'deals@store.com',
      subject: 'Summer SALE 50% off',
      body: 'Shop now, limited time offer!',
      hasListUnsubscribe: true,
    }),
    rules,
  )
  assert.equal(r.category, 'CLIENTS')
  assert.equal(r.source, 'manual')
  assert.equal(r.confidence, 1)
})

check('learned domain rule matches any address on the domain', () => {
  const rules: ClassifierRule[] = [{ matchType: 'domain', value: 'acme.com', category: 'SERVICES' }]
  const r = classifyEmail(signals({ senderEmail: 'random.person@acme.com', subject: 'hello' }), rules)
  assert.equal(r.category, 'SERVICES')
  assert.equal(r.source, 'manual')
})

check('empty email never throws → PRIMARY', () => {
  const r = classifyEmail(
    signals({ senderEmail: '', senderName: '', subject: '', body: '', gmailLabels: [] }),
  )
  assert.equal(r.category, 'PRIMARY')
})

check('malformed sender (no @) never throws → PRIMARY', () => {
  const r = classifyEmail(
    signals({ senderEmail: 'garbage-no-at', senderName: 'garbage-no-at', subject: '???', body: '...' }),
  )
  assert.equal(r.category, 'PRIMARY')
})

console.log(`\nAll ${passed} classifier scenarios passed.`)
