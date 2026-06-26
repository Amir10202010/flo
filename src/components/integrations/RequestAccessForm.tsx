'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 13.5,
  color: 'var(--text-primary)',
  background: '#FFFFFF',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 12px',
  outline: 'none',
}

/**
 * Invite-gate request form. The user submits the Gmail they want to connect;
 * the owner is emailed and adds it to the Google Test users list. Shown in
 * Settings → Connections while the OAuth app is in Testing mode.
 */
export default function RequestAccessForm() {
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, note: note.trim() || undefined }),
      })
      if (res.ok) {
        setDone(true)
        return
      }
      const data = await res.json().catch(() => null)
      setError(
        data?.error ??
          (res.status === 429
            ? 'Too many requests — please wait a moment and try again.'
            : 'Something went wrong. Please try again.'),
      )
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div
        style={{
          display: 'flex',
          gap: 11,
          padding: '14px 16px',
          borderRadius: 12,
          background: 'var(--success-dim)',
          border: '1px solid var(--success-border)',
          marginTop: 14,
        }}
      >
        <CheckCircle2 size={18} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>
          Request received. We&apos;ll email your account once you&apos;re approved.
          <br />
          Need it faster? Message us at <strong>8&nbsp;700&nbsp;160&nbsp;1000</strong>.
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        marginTop: 14,
        padding: 16,
        borderRadius: 12,
        background: 'var(--surface, #FBFCFE)',
        border: '1px solid var(--border)',
      }}
    >
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        Which Gmail do you want to connect?
      </label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@gmail.com"
        autoComplete="email"
        style={inputStyle}
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything we should know? (optional)"
        maxLength={500}
        rows={2}
        style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
      />
      {error && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--hot)' }}>{error}</p>
      )}
      <button
        type="submit"
        className="btn-primary"
        disabled={submitting}
        style={{ alignSelf: 'flex-start', fontSize: 13, padding: '9px 18px', display: 'inline-flex', alignItems: 'center', gap: 7 }}
      >
        {submitting && <Loader2 size={13} className="animate-spin" />}
        {submitting ? 'Sending…' : 'Send request'}
      </button>
    </form>
  )
}
