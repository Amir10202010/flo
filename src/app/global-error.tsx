'use client'

import { RefreshCw, TriangleAlert } from 'lucide-react'

/**
 * Last-resort boundary for errors thrown outside the dashboard shell (e.g. in
 * the root layout). It fully replaces the document, so it renders its own
 * <html>/<body> and cannot rely on globals.css — all styles are inline with
 * hard-coded values that match the brand.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          background: '#FFFFFF',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          color: '#0B0B0F',
        }}
      >
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#FDECEC',
              border: '1px solid #F6C9C9',
              color: '#D14343',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <TriangleAlert size={24} />
          </div>
          <h1 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Something went wrong
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: 15, color: '#5B5B66', lineHeight: 1.6 }}>
            An unexpected error interrupted Velnox. Your data is safe — try again, and if it keeps happening, reload the page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: '#0B0B0F',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} />
            Try again
          </button>
          {error.digest && (
            <p style={{ margin: '18px 0 0', fontSize: 11, color: '#9A9AA5' }}>Error digest: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  )
}
