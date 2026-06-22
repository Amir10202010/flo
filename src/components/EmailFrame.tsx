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
 * Images arrive defused as `data-src` (nothing loads). "Show images" swaps them
 * back to `src` — safe, since the markup was already sanitised.
 */
function buildDoc(body: string): string {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:">
<base target="_blank">
<style>
  html,body{margin:0;padding:0;background:#fff;color:#0C0E1D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.5;word-break:break-word;}
  img{max-width:100%;height:auto;}
  table{max-width:100%;}
  a{color:#2563EB;}
</style>
</head><body>${body}</body></html>`
}

export default function EmailFrame({ html, hasImages }: { html: string; hasImages: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [showImages, setShowImages] = useState(false)
  const [height, setHeight] = useState(120)

  const body = showImages ? html.split('data-src=').join('src=') : html
  const doc = buildDoc(body)

  function resize() {
    const frame = ref.current
    if (!frame) return
    try {
      const h = frame.contentDocument?.body?.scrollHeight
      if (h && h > 0) setHeight(h + 8)
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
      {hasImages && !showImages && (
        <button type="button" className="email-img-bar" onClick={() => setShowImages(true)}>
          🛡️ Images blocked for your privacy · Show images
        </button>
      )}
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
