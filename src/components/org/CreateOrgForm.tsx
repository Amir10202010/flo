'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2 } from 'lucide-react'

/** Minimal org-creation form. POSTs /api/orgs (which sets the active-org cookie)
 * then lands on the dashboard. */
export default function CreateOrgForm({ defaultName = '' }: { defaultName?: string }) {
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a workspace name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => null)
        setError(data?.error ?? 'Could not create workspace')
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
    <form onSubmit={submit}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>
        Workspace name
      </label>
      <div style={{ position: 'relative', marginBottom: error ? 8 : 18 }}>
        <Building2
          size={16}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Inc."
          autoFocus
          maxLength={80}
          style={{
            width: '100%',
            padding: '11px 12px 11px 36px',
            fontSize: 14,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>
      {error && <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--hot)' }}>{error}</p>}
      <button
        type="submit"
        className="btn-primary"
        disabled={busy}
        style={{ width: '100%', justifyContent: 'center', gap: 8, padding: '11px 16px', fontSize: 14 }}
      >
        {busy ? 'Creating…' : 'Create workspace'}
        {!busy && <ArrowRight size={15} />}
      </button>
    </form>
  )
}
