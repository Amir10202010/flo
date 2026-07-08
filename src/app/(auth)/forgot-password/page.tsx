'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase'
import { ArrowRight, Mail, TriangleAlert } from 'lucide-react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Status = 'idle' | 'loading' | 'sent' | 'error'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) { setErrorMsg('Enter a valid email address.'); setStatus('error'); return }
    setStatus('loading')
    setErrorMsg('')
    try {
      const supabase = getSupabaseClient()
      // The recovery link lands on /callback, which exchanges the code and
      // forwards to /reset-password where the new password is set.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/callback?next=/reset-password`,
      })
      if (error) { setErrorMsg(error.message); setStatus('error'); return }
      setStatus('sent')
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ marginBottom: 26, textAlign: 'center' }}>
        <h1 className="display-title" style={{ fontSize: 28, margin: '0 0 8px' }}>
          Reset your password
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
          Enter your email and we&apos;ll send you a link to set a new one.
        </p>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', boxShadow: 'var(--shadow-sm)' }}>
        {status === 'sent' ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid rgba(79,92,244,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Mail size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px' }}>Check your inbox</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 auto', maxWidth: 320 }}>
              If an account exists for{' '}<strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{email}</strong>, we sent a link to reset your password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                className="input-base"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {status === 'error' && (
              <p className="form-error" role="alert">
                <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={status === 'loading'}
              style={{ width: '100%', justifyContent: 'center', gap: 8, marginTop: 2 }}
            >
              {status === 'loading' ? 'Sending…' : (<>Send reset link <ArrowRight size={15} /></>)}
            </button>
          </form>
        )}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Remembered it?{' '}
            <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
