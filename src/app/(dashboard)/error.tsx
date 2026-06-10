'use client'

import Link from 'next/link'
import { Inbox, RefreshCw, TriangleAlert } from 'lucide-react'

/**
 * Error boundary for every dashboard page. The layout (sidebar, top bar)
 * stays mounted — only the page area is replaced, and `reset()` re-renders
 * the failed segment without a full reload.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div className="widget" style={{ alignItems: 'center', textAlign: 'center', padding: '48px 36px', maxWidth: 520 }}>
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: 14,
            background: 'var(--hot-dim)',
            border: '1px solid var(--hot-border)',
            color: 'var(--hot)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <TriangleAlert size={22} />
        </div>
        <h2 style={{ margin: '0 0 7px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          Something went wrong loading this view
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Usually a slow database connection. Your data is intact — retry, or head back to the inbox.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn-primary" style={{ fontSize: 13.5 }} onClick={() => reset()}>
            <RefreshCw size={14} />
            Try again
          </button>
          <Link href="/inbox" className="btn-ghost" style={{ fontSize: 13.5 }}>
            <Inbox size={14} />
            Open Inbox
          </Link>
        </div>
        {error.digest && (
          <p style={{ margin: '18px 0 0', fontSize: 10.5, color: 'var(--text-muted)' }}>Error digest: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
