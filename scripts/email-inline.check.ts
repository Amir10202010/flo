/**
 * Verification harness for the ingestion-time email HTML transforms.
 * Pure (no DB / network) — run with: `npm run test:email-inline`.
 *
 * Covers: stripInlineDataImages drops base64 `data:` blobs (src/background/
 * srcset/css url) while leaving remote + proxy images intact; rewriteCidImages
 * maps known `cid:` refs to the attachment proxy and leaves unknown ones alone.
 */
import assert from 'node:assert/strict'
import {
  stripInlineDataImages,
  rewriteCidImages,
  normalizeCid,
  type CidMap,
} from '@/lib/email-inline'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('email-inline — ingestion transforms:')

check('strips base64 data: from src, keeps remote', () => {
  const input =
    '<img src="data:image/png;base64,iVBORw0KGgoAAAANSU=="><img src="https://cdn.example/x.png">'
  const { html, removed } = stripInlineDataImages(input)
  assert.ok(!/data:image/i.test(html), 'data: blob should be gone')
  assert.ok(/https:\/\/cdn\.example\/x\.png/.test(html), 'remote image kept')
  assert.equal(removed, 1)
})

check('strips data: from background and srcset', () => {
  const input =
    '<td background="data:image/gif;base64,AAAA"><img srcset="data:image/png;base64,BBBB 1x"></td>'
  const { html, removed } = stripInlineDataImages(input)
  assert.ok(!/data:image/i.test(html))
  assert.equal(removed, 2)
})

check('strips css url(data:…) in inline style', () => {
  const input = '<div style="background-image:url(data:image/png;base64,CCCC)">x</div>'
  const { html, removed } = stripInlineDataImages(input)
  assert.ok(!/data:image/i.test(html))
  assert.equal(removed, 1)
})

check('leaves markup without data: untouched', () => {
  const input = '<p>hi</p><img src="https://x.test/a.png">'
  const { html, removed } = stripInlineDataImages(input)
  assert.equal(html, input)
  assert.equal(removed, 0)
})

check('rewrites known cid: to the attachment proxy', () => {
  const cids: CidMap = new Map([['logo@acme', 'ATTACH123']])
  const html = rewriteCidImages('<img src="cid:logo@acme">', 'MSG1', cids)
  assert.ok(/\/api\/attachments\/MSG1\/ATTACH123/.test(html))
  assert.ok(!/cid:/.test(html))
})

check('leaves unknown cid: untouched', () => {
  const cids: CidMap = new Map([['known@x', 'A']])
  const html = rewriteCidImages('<img src="cid:unknown@x">', 'MSG1', cids)
  assert.ok(/cid:unknown@x/.test(html))
})

check('cid match is case-insensitive on the id', () => {
  const cids: CidMap = new Map([[normalizeCid('<LOGO@Acme>'), 'A']])
  const html = rewriteCidImages('<img src="cid:logo@acme">', 'M', cids)
  assert.ok(/\/api\/attachments\/M\/A/.test(html))
})

check('normalizeCid strips angle brackets and lowercases', () => {
  assert.equal(normalizeCid('  <Foo@Bar>  '), 'foo@bar')
})

check('empty input is safe', () => {
  assert.deepEqual(stripInlineDataImages(''), { html: '', removed: 0 })
  assert.equal(rewriteCidImages('', 'M', new Map()), '')
})

console.log(`\n${passed} checks passed.`)
