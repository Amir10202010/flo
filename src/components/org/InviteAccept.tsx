'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

/**
 * Client accept button for an invitation. Shown when the preview is valid and
 * the visitor is signed in. POSTs the accept, then lands on the dashboard.
 */
export default function InviteAccept({ token, signedIn }: { token: string; signedIn: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!signedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center', gap: 8 }}
      >
        Sign in to accept <ArrowRight size={15} />
      </Link>
    )
  }

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/invitations/${token}`, { method: 'POST' })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        setError(d?.error ?? 'Could not accept the invitation')
        setBusy(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error — try again')
      setBusy(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={accept} disabled={busy} className="btn-primary" style={{ width: '100%', justifyContent: 'center', gap: 8 }}>
        {busy ? 'Joining…' : 'Accept & join'} {!busy && <Check size={15} />}
      </button>
      {error && <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--hot)', textAlign: 'center' }}>{error}</p>}
    </div>
  )
}
