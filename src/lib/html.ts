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

  // Plain text → escape and keep line breaks as <br>.
  if (!looksLikeHtml(content)) {
    return escapeHtml(content).replace(/\n/g, '<br>')
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

  return html.trim()
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ))
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E')
}
