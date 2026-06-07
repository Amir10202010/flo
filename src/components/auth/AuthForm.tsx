'use client'

import { useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowRight, Mail } from 'lucide-react'

export default function AuthForm({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/callback` },
      })
      if (error) { setErrorMsg(error.message); setStatus('error') }
      else setStatus('sent')
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid rgba(79,92,244,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Mail size={22} style={{ color: 'var(--accent)' }} />
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px' }}>Check your inbox</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px', maxWidth: 300 }}>
          We sent a magic link to{' '}
          <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{email}</strong>.
          Click it and you&apos;re in.
        </p>
        <button
          onClick={() => setStatus('idle')}
          style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Resend email
        </button>
      </div>
    )
  }

  return (
    <div>
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
          <p style={{ fontSize: 13, color: 'var(--hot)', margin: 0, lineHeight: 1.5 }}>{errorMsg}</p>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={status === 'loading'}
          style={{ width: '100%', justifyContent: 'center', gap: 8, marginTop: 2 }}
        >
          {status === 'loading' ? 'Sending…' : (
            <>
              {mode === 'login' ? 'Sign in with email' : 'Create account'}
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
        {mode === 'login' ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
              Sign up
            </Link>
          </p>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
