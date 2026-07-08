import Link from 'next/link'
import { Compass, Home, LayoutDashboard } from 'lucide-react'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--bg-base)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 460 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'var(--accent-dim)',
            border: '1px solid rgba(79,92,244,0.2)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <Compass size={24} />
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          404 · Velnox
        </p>
        <h1 className="display-title" style={{ margin: '0 0 10px', fontSize: 26 }}>
          This page went quiet
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          The page you&apos;re looking for doesn&apos;t exist or may have moved. Let&apos;s get you back on track.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/" className="btn-primary" style={{ fontSize: 14 }}>
            <Home size={15} />
            Back home
          </Link>
          <Link href="/dashboard" className="btn-ghost" style={{ fontSize: 14 }}>
            <LayoutDashboard size={15} />
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
