'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Renders an already-sanitised email body inside a SANDBOXED iframe.
 *
 * Security: the sanitiser (`sanitizeEmailRich`, server-side) already removed
 * scripts/handlers/unsafe styles. The iframe is a second boundary — it runs with
 * NO `allow-scripts` (so nothing in the frame executes) plus a strict CSP.
 * `allow-same-origin` is safe *because* scripts are disallowed, and only lets the
 * parent read the document height to size the frame.
 *
 * Images render immediately: remote `https` images cost nothing in our DB (only
 * the URL is stored) and inline images come through our same-origin attachment
 * proxy (`/api/attachments/…`, allowed by `img-src 'self'`). Base64 `data:`
 * blobs are stripped at ingestion so they never reach the DB in the first place.
 */
function buildDoc(body: string): string {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; font-src https: data:">
<base target="_blank">
<style>
  html,body{margin:0;padding:0;background:#fff;color:#0C0E1D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.5;word-break:break-word;}
  img{max-width:100%;height:auto;}
  table{max-width:100%;}
  a{color:#2563EB;}
</style>
</head><body>${body}</body></html>`
}

export default function EmailFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(120)

  // The sanitiser parks image sources in `data-src`; restore them so images load.
  const doc = buildDoc(html.split('data-src=').join('src='))

  function resize() {
    const frame = ref.current
    if (!frame) return
    try {
      const doc = frame.contentDocument
      if (!doc) return
      // Use offsetHeight, NOT scrollHeight. Some marketing emails (table-heavy
      // layouts) report a wildly inflated scrollHeight — ~2x the real content
      // with nothing actually extending that far — which left a tall blank gap
      // under the message. offsetHeight of <html>/<body> matches the true
      // rendered box height; max() guards the rare case where one wraps tighter.
      const h = Math.max(doc.documentElement.offsetHeight, doc.body.offsetHeight)
      if (h > 0) setHeight(h + 8)
    } catch {
      /* opaque-origin guard — leave the default height */
    }
  }

  // Re-measure shortly after a (re)render: late layout/decoded images settle.
  useEffect(() => {
    const t = setTimeout(resize, 80)
    return () => clearTimeout(t)
  }, [doc])

  return (
    <div className="email-frame-wrap">
      <iframe
        ref={ref}
        className="email-frame"
        title="Email message"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={doc}
        style={{ height }}
        onLoad={resize}
      />
    </div>
  )
}
