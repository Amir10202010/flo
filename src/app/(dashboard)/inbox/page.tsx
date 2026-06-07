import Link from 'next/link'
import { Plug } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'

export default async function InboxPage() {
  // Re-uses the cached user from the dashboard layout — no extra round-trip.
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <Plug size={22} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>You&apos;re in demo mode</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 260 }}>
            <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
            {' '}and connect Gmail to see real conversations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFFFFF', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: 'var(--shadow-xs)' }}>
        💬
      </div>
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Select a conversation</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Click a contact on the left</p>
      </div>
    </div>
  )
}
