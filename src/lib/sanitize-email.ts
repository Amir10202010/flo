import sanitizeHtml from 'sanitize-html'
import { looksLikeHtml } from './html'

/**
 * Safe rendering of email message bodies for `dangerouslySetInnerHTML`.
 *
 * Email bodies are fully attacker-controlled (anyone can email the user), so
 * the security-critical parsing is delegated to `sanitize-html` — a vetted,
 * parser-based sanitiser — rather than a hand-rolled regex tag-walk, which is
 * prone to mutation-XSS via parser-differential edge cases.
 *
 * Policy: a small allowlist of structural/formatting tags; NO attributes except
 * a protocol-checked `href` on links (forced to a new tab, rel-hardened);
 * script/style/iframe/object/svg/etc. dropped WITH their contents. The UX
 * niceties (bare-URL linkify on plain text, quoted-history folding, email
 * whitespace collapse) run as pre/post-processing around the vetted core.
 *
 * Server-only: importing `sanitize-html` (htmlparser2) keeps it out of client
 * bundles — this module must never be imported by a "use client" component.
 */

const ALLOWED_TAGS = [
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { a: ['http', 'https', 'mailto', 'tel'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard', // drop disallowed tags, keep their text content
  // Drop these tags AND their contents (not just the tag) to defeat payloads
  // hidden inside foreign/raw-text content.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'head', 'title', 'object', 'embed', 'svg', 'math'],
  transformTags: {
    // Keep only a validated href; force safe link behaviour.
    a: (_tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        ...(attribs.href ? { href: attribs.href } : {}),
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      },
    }),
  },
}

// Collision-proof placeholder used to park <pre> blocks while whitespace is
// collapsed around them. Pure ASCII (no NUL bytes in source) and vanishingly
// unlikely to appear in a real email body.
const PRE_OPEN = ' VLNXPRE'
const PRE_CLOSE = ' '

/**
 * Sanitise a message body to a safe, style-free subset suitable for
 * `dangerouslySetInnerHTML`. Plain-text input is HTML-escaped (and bare URLs
 * linkified) with line breaks preserved.
 */
export function sanitizeMessageHtml(content: string): string {
  if (!content) return ''

  // Plain text → escape, tame excessive blank lines, linkify bare URLs,
  // fold trailing "> quoted" reply history, keep breaks as <br>.
  if (!looksLikeHtml(content)) {
    const normalized = content.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    const { main, quoted } = splitPlainQuote(normalized)
    let html = linkify(escapeHtml(main)).replace(/\n/g, '<br>')
    if (quoted) {
      html += `<details class="msg-quote"><summary>Show quoted history</summary>${linkify(escapeHtml(quoted)).replace(/\n/g, '<br>')}</details>`
    }
    return html
  }

  // Vetted sanitiser does the security-critical parsing; our post-processing
  // (whitespace collapse, quote folding) then runs on the already-safe HTML.
  let html = sanitizeHtml(content, SANITIZE_OPTIONS)
  html = collapseEmailWhitespace(html)
  html = foldQuotedHistory(html)

  return html.trim()
}

/**
 * Email HTML arrives full of layout artefacts that survive tag stripping:
 * runs of <br>, empty <p>/<div> spacer blocks, and stray breaks at block
 * edges. Collapse them so rendered messages read compact, not "torn apart".
 * <pre> content is parked under a sentinel and restored verbatim afterwards.
 */
function collapseEmailWhitespace(html: string): string {
  const pres: string[] = []
  let out = html.replace(/<pre>[\s\S]*?<\/pre>/gi, (m) => {
    pres.push(m)
    return `${PRE_OPEN}${pres.length - 1}${PRE_CLOSE}`
  })

  let prev = ''
  while (prev !== out) {
    prev = out
    out = out
      // Empty block elements (possibly nested wrappers) are pure spacers.
      .replace(/<(p|div|span|blockquote)>(\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, '')
      // Breaks hugging a block boundary duplicate the block's own break.
      .replace(/(?:\s|<br\s*\/?>)+(<\/(?:p|div|li|blockquote|h[1-6])>)/gi, '$1')
      .replace(/(<(?:p|div|li|blockquote|h[1-6])>)(?:\s|<br\s*\/?>)+/gi, '$1')
  }

  // At most one blank line between paragraphs.
  out = out.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')

  return out.replace(/ VLNXPRE(\d+) /g, (_m, i: string) => pres[Number(i)] ?? '')
}

/**
 * Long reply chains arrive as trailing <blockquote> history. Fold each
 * outermost quote into <details> so the new message stays front and centre
 * (same idea as Gmail's "…" trimmed-content toggle).
 */
function foldQuotedHistory(html: string): string {
  const open = /<blockquote>/gi
  const anyTag = /<(\/?)blockquote>/gi
  let result = ''
  let cursor = 0

  let m: RegExpExecArray | null
  while ((m = open.exec(html))) {
    if (m.index < cursor) continue // nested inside an already-folded quote
    // Find the matching close for this outermost open.
    anyTag.lastIndex = m.index + m[0].length
    let depth = 1
    let end = -1
    let t: RegExpExecArray | null
    while (depth > 0 && (t = anyTag.exec(html))) {
      depth += t[1] ? -1 : 1
      if (depth === 0) end = t.index + t[0].length
    }
    if (end === -1) break // unbalanced — leave the rest untouched

    result += html.slice(cursor, m.index)
    result += `<details class="msg-quote"><summary>Show quoted history</summary>${html.slice(m.index, end)}</details>`
    cursor = end
    open.lastIndex = cursor
  }

  return result + html.slice(cursor)
}

/**
 * Split plain text into the new message and its trailing quoted history
 * (the "> " block, optionally introduced by an "On … wrote:" attribution).
 */
function splitPlainQuote(text: string): { main: string; quoted: string | null } {
  const lines = text.split('\n')

  // Walk from the end: the quote block is the trailing run of ">"-prefixed
  // (or blank) lines. Require at least two quoted lines to bother folding.
  let start = lines.length
  let quotedCount = 0
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (line.trim() === '') continue
    if (line.trimStart().startsWith('>')) {
      quotedCount++
      start = i
    } else {
      break
    }
  }
  if (quotedCount < 2 || start === 0) return { main: text, quoted: null }

  // Pull a directly preceding "On … wrote:" attribution into the fold too.
  let from = start
  for (let i = start - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (line === '') { from = i; continue }
    if (/^On .{3,120} wrote:$/.test(line)) from = i
    break
  }

  const main = lines.slice(0, from).join('\n').trimEnd()
  const quoted = lines.slice(from).join('\n').trim()
  if (!main) return { main: text, quoted: null }
  return { main, quoted }
}

/** Turn bare http(s) URLs in already-escaped text into safe links. */
function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (url) => {
    // Trailing punctuation usually belongs to the sentence, not the URL.
    const m = url.match(/[.,;:!?)\]]+$/)
    const trail = m ? m[0] : ''
    const clean = trail ? url.slice(0, -trail.length) : url
    return `<a href="${clean.replace(/"/g, '%22')}" target="_blank" rel="noopener noreferrer nofollow">${clean}</a>${trail}`
  })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ))
}

// ── Rich render (for the sandboxed iframe) ───────────────────────────────────

/**
 * A wider sanitiser for rendering real email HTML inside a SANDBOXED iframe
 * (no `allow-scripts` + a strict CSP). Keeps tables, images and a CSS-allowlisted
 * inline `style` so messages look like they do in Gmail, while still parsing
 * through the vetted `sanitize-html` core. Remote images are defused: every
 * `<img src>` is moved to `data-src` (nothing loads) and the caller restores it
 * on "Show images". Returns the safe HTML plus whether any image was present.
 *
 * Server-only (htmlparser2) — never import from a "use client" component.
 */
const RICH_TAGS = [
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'img', 'figure', 'figcaption', 'font', 'center', 'small', 'big', 'sub', 'sup',
  'dl', 'dt', 'dd',
]

// Presentation attributes carried on legacy email markup (kept on every tag).
const PRESENTATION_ATTRS = [
  'style', 'align', 'valign', 'width', 'height', 'bgcolor', 'color', 'face',
  'size', 'cellpadding', 'cellspacing', 'border', 'colspan', 'rowspan', 'dir', 'lang',
]

// CSS value guards. SAFE excludes parentheses / semicolons / braces / colon,
// which kills url() / expression() / javascript:; colour props also accept
// rgb()/rgba(). Any property NOT listed (e.g. position, z-index) is dropped.
const SAFE = /^[#a-z0-9\s.,%_'"/-]+$/i
const RGB = /^rgba?\([\d\s.,%]+\)$/i
const DISPLAY = /^(block|inline|inline-block|table|table-cell|table-row|table-header-group|table-row-group|none|flex)$/i

const STYLE_RULES: Record<string, RegExp[]> = { display: [DISPLAY] }
for (const p of [
  'font-size', 'font-weight', 'font-style', 'font-family', 'font',
  'text-align', 'text-decoration', 'text-transform', 'line-height',
  'letter-spacing', 'vertical-align', 'white-space',
  'width', 'max-width', 'min-width', 'height', 'max-height',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border-width', 'border-style', 'border-radius', 'border-collapse', 'border-spacing',
]) STYLE_RULES[p] = [SAFE]
for (const p of [
  'color', 'background', 'background-color',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color',
]) STYLE_RULES[p] = [SAFE, RGB]

// Remote (https), data-image (legacy/already-stored rows), and our own inline
// attachment proxy. `cid:` is intentionally NOT here — those are rewritten to
// the proxy path at ingestion, so a bare `cid:` would never resolve anyway.
const SAFE_IMG_SRC = /^(https?:|data:image\/|\/api\/attachments\/)/i

export function sanitizeEmailRich(input: string): { html: string; hasImages: boolean } {
  if (!input) return { html: '', hasImages: false }
  const capped = input.length > 200_000 ? input.slice(0, 200_000) : input

  let hasImages = false
  const html = sanitizeHtml(capped, {
    allowedTags: RICH_TAGS,
    allowedAttributes: {
      '*': PRESENTATION_ATTRS,
      a: ['href', 'name', 'target', 'rel', ...PRESENTATION_ATTRS],
      img: ['data-src', 'alt', 'title', ...PRESENTATION_ATTRS],
    },
    allowedStyles: { '*': STYLE_RULES },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto', 'tel'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'head', 'title', 'object', 'embed', 'svg', 'math'],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...(attribs.href ? { href: attribs.href } : {}),
          ...(attribs.style ? { style: attribs.style } : {}),
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      }),
      img: (_tagName, attribs) => {
        const src = (attribs.src ?? '').trim()
        const out: Record<string, string> = { ...attribs }
        delete out.src
        // Defer the load: only a scheme-checked src is parked in data-src.
        if (src && SAFE_IMG_SRC.test(src)) {
          out['data-src'] = src
          hasImages = true
        }
        return { tagName: 'img', attribs: out }
      },
    },
  })

  return { html: html.trim(), hasImages }
}
