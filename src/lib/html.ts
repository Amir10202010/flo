/**
 * Dependency-free HTML → plain-text conversion for message bodies.
 *
 * Email bodies frequently arrive as `text/html`. If we store or render that raw,
 * users see literal tags (`<h2>`, `<p>`, `<div>`). We normalise to readable plain
 * text at ingestion, and also apply it as a render-time guard so rows that were
 * stored before this fix display cleanly without a data migration.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  copy: '©',
  reg: '®',
  trade: '™',
}

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? safeFromCodePoint(code) : match
    }
    return NAMED_ENTITIES[body] ?? match
  })
}

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

/** True when the string looks like it contains HTML markup. */
export function looksLikeHtml(input: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(input)
}

/**
 * Convert an HTML fragment to readable plain text:
 * strips script/style, turns block elements into line breaks, drops all other
 * tags, decodes entities, and collapses excess whitespace.
 */
export function htmlToText(html: string): string {
  if (!html) return ''

  let text = html
    // Remove non-content elements wholesale
    .replace(/<\s*(script|style|head|title|noscript)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // Line breaks
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    // Block-level elements become paragraph breaks
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|tr|table|blockquote|section|article|header|footer)\s*>/gi, '\n')
    .replace(/<\s*(p|div|h[1-6]|tr|table|blockquote|section|article|header|footer)[^>]*>/gi, '\n')
    // List items get a bullet
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    // Strip every remaining tag
    .replace(/<[^>]+>/g, '')

  text = decodeEntities(text)

  return text
    // Normalise whitespace runs but preserve intentional line breaks
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Render-time safety net: if a stored message still contains HTML, convert it;
 * otherwise return it unchanged.
 */
export function ensurePlainText(content: string): string {
  return looksLikeHtml(content) ? htmlToText(content) : content
}

/* ─────────────────────────────────────────────────────────────────────────
 * Sanitised HTML rendering for message bodies.
 *
 * Email arrives as messy `text/html` (inline styles, tables, tracking images).
 * We want to *apply* basic formatting (bold, links, lists, paragraphs) rather
 * than show raw tags or flatten everything to plain text — but without letting
 * email styles break our layout or scripts run. So we keep a small allowlist of
 * structural tags, drop everything else (keeping inner text), strip every
 * attribute except safe `href`s on links, and remove script/style entirely.
 * ─────────────────────────────────────────────────────────────────────── */

const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
])

function isSafeHref(href: string): boolean {
  const v = href.trim().toLowerCase()
  return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('mailto:') || v.startsWith('tel:')
}

/**
 * Sanitise an HTML message body to a safe, style-free subset and return HTML
 * suitable for `dangerouslySetInnerHTML`. Plain-text input is HTML-escaped and
 * returned with line breaks preserved.
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

  let html = content
    // Drop non-content elements (with their contents) outright.
    .replace(/<\s*(script|style|head|title|noscript|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // Drop comments (can hide conditional/script payloads).
    .replace(/<!--[\s\S]*?-->/g, '')

  // Walk every tag; keep allowlisted ones (stripped of attributes, except <a href>),
  // drop the rest while preserving their inner text.
  html = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_m, slash: string, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase()
    if (!ALLOWED_TAGS.has(name)) return ''
    if (slash) return `</${name}>`
    if (name === 'a') {
      const hrefMatch = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
      const href = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '') : ''
      if (href && isSafeHref(href)) {
        return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow">`
      }
      return '<a>'
    }
    return `<${name}>`
  })

  html = collapseEmailWhitespace(html)
  html = foldQuotedHistory(html)

  return html.trim()
}

/**
 * Email HTML arrives full of layout artefacts that survive tag stripping:
 * runs of <br>, empty <p>/<div> spacer blocks, and stray breaks at block
 * edges. Collapse them so rendered messages read compact, not "torn apart".
 * <pre> content is preserved verbatim.
 */
function collapseEmailWhitespace(html: string): string {
  const pres: string[] = []
  let out = html.replace(/<pre>[\s\S]*?<\/pre>/gi, (m) => {
    pres.push(m)
    return `\u0000PRE${pres.length - 1}\u0000`
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

  return out.replace(/\u0000PRE(\d+)\u0000/g, (_m, i: string) => pres[Number(i)] ?? '')
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

/**
 * One-line preview for conversation lists: drops quoted-reply lines and
 * attribution headers, collapses whitespace, and trims to `max` characters.
 */
export function messagePreview(content: string, max = 120): string {
  const text = ensurePlainText(content)
  const line = text
    .split('\n')
    .filter((l) => {
      const t = l.trim()
      return t !== '' && !t.startsWith('>') && !/^On .{3,120} wrote:$/.test(t)
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ))
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E')
}
