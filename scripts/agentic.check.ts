/**
 * Verification harness for the agentic-assistant + notification pure logic.
 * Pure (no DB / network) — run with: `npm run test:agentic`.
 *
 * Covers: alert-email throttle window, severity ordering, subject/body
 * rendering, and the action parser/validators (parseAction = raw model shape,
 * coerceAction = normalised confirm-card shape) incl. bounds + reject paths.
 */
import assert from 'node:assert/strict'
import {
  isThrottled,
  sortUrgent,
  alertEmailSubject,
  buildAlertEmail,
  type AlertEmailItem,
} from '@/services/notification.service'
import { parseAction, coerceAction, convIdFromHref } from '@/services/assistant.actions'
import { degradedReasonFor } from '@/services/assistant.service'
import { AiProviderError } from '@/services/ai/types'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

const NOW = Date.parse('2026-06-18T12:00:00Z')
const iso = (ms: number) => new Date(ms).toISOString()

console.log('notifications — throttle + rendering:')

check('isThrottled: no prior send → false', () => {
  assert.equal(isThrottled(null, NOW), false)
  assert.equal(isThrottled(undefined, NOW), false)
})

check('isThrottled: 1h ago is within the 6h window → true', () => {
  assert.equal(isThrottled(iso(NOW - 1 * 3600_000), NOW), true)
})

check('isThrottled: 7h ago is outside the window → false', () => {
  assert.equal(isThrottled(iso(NOW - 7 * 3600_000), NOW), false)
})

check('isThrottled: unparseable stamp → false (never block on bad data)', () => {
  assert.equal(isThrottled('not-a-date', NOW), false)
})

check('sortUrgent: CRITICAL before HIGH', () => {
  const sorted = sortUrgent([
    { severity: 'HIGH', title: 'h', reason: '', suggestedAction: null, conversationId: null },
    { severity: 'CRITICAL', title: 'c', reason: '', suggestedAction: null, conversationId: null },
  ])
  assert.equal(sorted[0].severity, 'CRITICAL')
})

check('alertEmailSubject: alerts → urgent-client subject', () => {
  const subject = alertEmailSubject(
    [{ severity: 'CRITICAL', title: 't', reason: '', suggestedAction: null, conversationId: null }],
    0,
  )
  assert.match(subject, /urgent client/)
})

check('alertEmailSubject: reminders only → reminders-due subject', () => {
  assert.match(alertEmailSubject([], 2), /2 reminders due/)
})

check('buildAlertEmail: alert renders title + ?draft=1 deep link', () => {
  const items: AlertEmailItem[] = [
    { severity: 'CRITICAL', title: 'Acme at risk', reason: 'no reply 4d', suggestedAction: 'Reply today', conversationId: 'conv1' },
  ]
  const { subject, html, text } = buildAlertEmail(items, [], 'http://app/')
  assert.match(subject, /urgent client/)
  assert.match(html, /Acme at risk/)
  assert.match(html, /\/inbox\/conv1\?draft=1/)
  assert.match(html, /\/inbox\/conv1"/) // plain open-thread link too
  assert.match(text, /Acme at risk/)
})

check('buildAlertEmail: reminders-only email renders the note + Dashboard CTA', () => {
  const { html, text } = buildAlertEmail([], [{ note: 'Ping Bob', dueLabel: 'Due Jun 18', conversationId: null }], 'http://app')
  assert.match(html, /Ping Bob/)
  assert.match(html, /Open dashboard/)
  assert.match(text, /Ping Bob/)
})

console.log('\nassistant actions — parse + coerce:')

check('convIdFromHref extracts the id / rejects non-thread hrefs', () => {
  assert.equal(convIdFromHref('/inbox/abc123'), 'abc123')
  assert.equal(convIdFromHref('/inbox/abc123?draft=1'), 'abc123')
  assert.equal(convIdFromHref('/risk'), null)
  assert.equal(convIdFromHref(42), null)
})

check('parseAction bulk_draft: valid filter passes, bad filter rejected', () => {
  const ok = parseAction({ type: 'bulk_draft', summary: 'Draft 3', params: { filter: 'overdue_replies' } }, NOW)
  assert.equal(ok?.type, 'bulk_draft')
  assert.equal(parseAction({ type: 'bulk_draft', summary: 'x', params: { filter: 'nope' } }, NOW), null)
})

check('parseAction triage_alert: href→conversationId, snoozeDays clamped to 30', () => {
  const a = parseAction(
    { type: 'triage_alert', summary: 'Snooze', params: { alertHref: '/inbox/c9', op: 'snooze', snoozeDays: 100 } },
    NOW,
  )
  assert.equal(a?.type, 'triage_alert')
  assert.equal(a && a.type === 'triage_alert' ? a.conversationId : '', 'c9')
  assert.equal(a && a.type === 'triage_alert' ? a.snoozeDays : 0, 30)
})

check('parseAction triage_alert: missing href or bad op → null', () => {
  assert.equal(parseAction({ type: 'triage_alert', summary: 'x', params: { op: 'resolve' } }, NOW), null)
  assert.equal(parseAction({ type: 'triage_alert', summary: 'x', params: { alertHref: '/inbox/c1', op: 'nuke' } }, NOW), null)
})

check('parseAction create_reminder: future dueAt ok, past dueAt rejected', () => {
  const ok = parseAction(
    { type: 'create_reminder', summary: 'Remind', params: { note: 'Call Sam', dueAt: iso(NOW + 2 * 86_400_000) } },
    NOW,
  )
  assert.equal(ok?.type, 'create_reminder')
  assert.equal(
    parseAction({ type: 'create_reminder', summary: 'x', params: { note: 'late', dueAt: iso(NOW - 86_400_000) } }, NOW),
    null,
  )
})

check('parseAction: missing summary / unknown type / non-object → null', () => {
  assert.equal(parseAction({ type: 'bulk_draft', params: { filter: 'awaiting' } }, NOW), null)
  assert.equal(parseAction({ type: 'mystery', summary: 'x' }, NOW), null)
  assert.equal(parseAction(null, NOW), null)
})

check('coerceAction: normalised triage_alert valid; bad id rejected', () => {
  const ok = coerceAction({ type: 'triage_alert', conversationId: 'c1', op: 'resolve', summary: 'Resolve' }, NOW)
  assert.equal(ok?.type, 'triage_alert')
  assert.equal(coerceAction({ type: 'triage_alert', conversationId: 'bad id!', op: 'resolve' }, NOW), null)
})

check('coerceAction: create_reminder normalised future dueAt ok, past → null', () => {
  const ok = coerceAction({ type: 'create_reminder', note: 'n', dueAt: iso(NOW + 86_400_000), summary: 's' }, NOW)
  assert.equal(ok?.type, 'create_reminder')
  assert.equal(coerceAction({ type: 'create_reminder', note: 'n', dueAt: iso(NOW - 1000) }, NOW), null)
})

check('parseAction create_note: contactHref→conversationId + body; missing href/body → null', () => {
  const a = parseAction(
    { type: 'create_note', summary: 'Note', params: { contactHref: '/inbox/c7', body: 'Prefers calls over email.' } },
    NOW,
  )
  assert.equal(a?.type, 'create_note')
  assert.equal(a && a.type === 'create_note' ? a.conversationId : '', 'c7')
  assert.equal(parseAction({ type: 'create_note', summary: 'x', params: { body: 'no contact' } }, NOW), null)
  assert.equal(parseAction({ type: 'create_note', summary: 'x', params: { contactHref: '/inbox/c7' } }, NOW), null)
})

check('coerceAction create_note: normalised valid; bad id rejected', () => {
  const ok = coerceAction({ type: 'create_note', conversationId: 'c7', body: 'note', summary: 's' }, NOW)
  assert.equal(ok?.type, 'create_note')
  assert.equal(coerceAction({ type: 'create_note', conversationId: 'bad id', body: 'note' }, NOW), null)
})

console.log('\nassistant degradation — reason classification:')

check('degradedReasonFor: 429 → rate-limited (honest, NOT "no key")', () => {
  assert.equal(degradedReasonFor(new AiProviderError('429 quota', 'rate_limit')), 'rate-limited')
})

check('degradedReasonFor: 5xx/network → unavailable', () => {
  assert.equal(degradedReasonFor(new AiProviderError('503', 'unavailable')), 'unavailable')
})

check('degradedReasonFor: auth / bad_response / generic → error', () => {
  assert.equal(degradedReasonFor(new AiProviderError('bad key', 'auth')), 'error')
  assert.equal(degradedReasonFor(new AiProviderError('garbage', 'bad_response')), 'error')
  assert.equal(degradedReasonFor(new Error('boom')), 'error')
})

console.log(`\nAll ${passed} agentic scenarios passed.`)
