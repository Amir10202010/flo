/**
 * Ingestion-time transforms for raw email HTML, applied BEFORE the body is
 * stored (see `gmail.service.ts`). Two jobs, both about keeping the database
 * small while still letting images render:
 *
 *  1. `stripInlineDataImages` — base64 `data:` images embedded directly in the
 *     markup are the ONLY thing that actually bloats `Message.contentHtml`
 *     (remote `https` images cost just their URL). We drop those payloads so a
 *     single newsletter can't eat hundreds of KB — and so the 200 KB column cap
 *     never truncates a body mid-base64, which would corrupt the HTML.
 *
 *  2. `rewriteCidImages` — inline attachments referenced as `cid:` are rewritten
 *     to a same-origin proxy URL (`/api/attachments/<messageId>/<attachmentId>`)
 *     that streams the bytes from Gmail on demand. The image renders without the
 *     bytes ever touching our DB.
 *
 * Pure string functions — no I/O, unit-testable.
 */

/** cid (lowercased, angle-brackets stripped) → Gmail attachmentId. */
export type CidMap = Map<string, string>

/** The proxy path inline `cid:` images are rewritten to (must stay in sync with
 *  the allowlist in `sanitize-email.ts` and the route at `/api/attachments`). */
export const ATTACHMENT_PROXY_PREFIX = '/api/attachments'

/**
 * Remove embedded base64 `data:` images from email HTML so they never reach the
 * DB. Replaces the URI inside `src`/`background`/`srcset` attributes (and inside
 * `style="…url(data:…)…"`) with an empty/`none` value, leaving valid markup.
 * Remote (`http(s)`) and proxied (`/api/attachments/…`) images are untouched.
 */
export function stripInlineDataImages(html: string): { html: string; removed: number } {
  if (!html) return { html: '', removed: 0 }
  let removed = 0

  // src="data:…" / background='data:…' / srcset="data:…"
  let out = html.replace(
    /\b(src|background|srcset)\s*=\s*(["'])\s*data:[^"']*\2/gi,
    (_m, attr: string, q: string) => {
      removed++
      return `${attr}=${q}${q}`
    },
  )

  // CSS url(data:…) inside inline styles (e.g. background-image)
  out = out.replace(/url\(\s*(["']?)data:[^)]*\1\s*\)/gi, () => {
    removed++
    return 'none'
  })

  return { html: out, removed }
}

/**
 * Rewrite `cid:` image references to the on-demand attachment proxy. Unmatched
 * cids (no attachment found in the part tree) are left untouched — they simply
 * won't load, same as before.
 */
export function rewriteCidImages(html: string, messageId: string, cids: CidMap): string {
  if (!html || cids.size === 0) return html
  return html.replace(
    /\b(src|background)\s*=\s*(["'])\s*cid:([^"']+)\2/gi,
    (whole, attr: string, q: string, rawCid: string) => {
      const key = normalizeCid(rawCid)
      const attachmentId = cids.get(key)
      if (!attachmentId) return whole
      const url = `${ATTACHMENT_PROXY_PREFIX}/${encodeURIComponent(messageId)}/${encodeURIComponent(attachmentId)}`
      return `${attr}=${q}${url}${q}`
    },
  )
}

/** Normalise a Content-ID header value or a `cid:` reference to a lookup key. */
export function normalizeCid(value: string): string {
  return value.trim().replace(/^<+|>+$/g, '').toLowerCase()
}
