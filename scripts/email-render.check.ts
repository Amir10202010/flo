/**
 * Verification harness for the rich email sanitiser.
 * Pure (no DB / network) — run with: `npm run test:email`.
 *
 * Covers: sanitizeEmailRich drops scripts / event handlers / javascript: hrefs /
 * disallowed style props / css url(); keeps tables + allowed inline styles;
 * defuses remote images (src→data-src) and reports hasImages.
 */
import assert from 'node:assert/strict'
import { sanitizeEmailRich } from '@/lib/sanitize-email'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('email-render — sanitizeEmailRich:')

check('strips <script>, keeps text', () => {
  const { html } = sanitizeEmailRich('<p>hi</p><script>alert(1)</script>')
  assert.ok(!/script/i.test(html))
  assert.ok(/hi/.test(html))
})

check('drops inline event handlers', () => {
  const { html } = sanitizeEmailRich('<p onclick="alert(1)" onmouseover="x()">hi</p>')
  assert.ok(!/onclick|onmouseover/i.test(html))
})

check('drops javascript: href', () => {
  const { html } = sanitizeEmailRich('<a href="javascript:alert(1)">x</a>')
  assert.ok(!/javascript:/i.test(html))
})

check('forces target=_blank + rel on links', () => {
  const { html } = sanitizeEmailRich('<a href="https://example.com">x</a>')
  assert.ok(/target="_blank"/.test(html))
  assert.ok(/rel="noopener noreferrer nofollow"/.test(html))
})

check('keeps table structure', () => {
  const { html } = sanitizeEmailRich('<table><tbody><tr><td>cell</td></tr></tbody></table>')
  assert.ok(/<table/.test(html) && /<td/.test(html) && /cell/.test(html))
})

check('keeps allowed inline styles, drops position', () => {
  const { html } = sanitizeEmailRich('<div style="color:#ff0000;text-align:center;position:fixed">x</div>')
  assert.ok(/color/.test(html))
  assert.ok(/text-align/.test(html))
  assert.ok(!/position/i.test(html))
})

check('keeps rgb() colour values', () => {
  const { html } = sanitizeEmailRich('<td style="background-color:rgb(255,0,0)">x</td>')
  assert.ok(/background-color/.test(html))
  assert.ok(/rgb\(/.test(html))
})

check('blocks remote images: src→data-src, hasImages true', () => {
  const r = sanitizeEmailRich('<img src="https://track.example/pixel.gif" alt="x">')
  assert.ok(/data-src=/.test(r.html))
  assert.ok(!/\ssrc=/.test(r.html))
  assert.equal(r.hasImages, true)
})

check('no images → hasImages false', () => {
  const r = sanitizeEmailRich('<p>just text</p>')
  assert.equal(r.hasImages, false)
})

check('drops css url() background (tracking via CSS)', () => {
  const { html } = sanitizeEmailRich('<div style="background:url(https://evil.example/x.png)">x</div>')
  assert.ok(!/url\(/i.test(html))
})

check('empty / falsy input is safe', () => {
  assert.deepEqual(sanitizeEmailRich(''), { html: '', hasImages: false })
})

console.log(`\n${passed} checks passed.`)
