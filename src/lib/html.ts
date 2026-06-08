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
