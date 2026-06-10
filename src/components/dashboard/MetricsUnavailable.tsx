'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Inbox, RefreshCw, TriangleAlert } from 'lucide-react'

/**
 * Degraded state when the metrics services can't reach the database
 * (e.g. connection-pool timeout). The page shell stays up; only the data
 * area shows this card, with a refresh that re-runs the server render.
 */
export default function MetricsUnavailable() {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)

  return (
    <div className="widget" style={{ alignItems: 'center', textAlign: 'center', padding: '52px 28px' }}>
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: 14,
          background: 'var(--attention-dim)',
          border: '1px solid var(--attention-border)',
          color: 'var(--attention)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <TriangleAlert size={22} />
      </div>
      <h2 style={{ margin: '0 0 7px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
        Metrics are temporarily unavailable
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 430, lineHeight: 1.6 }}>
        The database didn&apos;t respond in time — usually a busy connection pool or a cold start.
        Your data is safe; nothing was lost. Try again in a moment.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          className="btn-primary"
          style={{ fontSize: 13.5 }}
          disabled={retrying}
          onClick={() => {
            setRetrying(true)
            router.refresh()
          }}
        >
          <RefreshCw size={14} className={retrying ? 'animate-spin' : undefined} />
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
        <Link href="/inbox" className="btn-ghost" style={{ fontSize: 13.5 }}>
          <Inbox size={14} />
          Open Inbox
        </Link>
      </div>
    </div>
  )
}
