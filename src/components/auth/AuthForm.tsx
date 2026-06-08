'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowRight, Mail } from 'lucide-react'

type Method = 'password' | 'magic-link'
type Status = 'idle' | 'loading' | 'sent' | 'error'

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.05l3.02-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

export default function AuthForm({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const router = useRouter()
  const [method, setMethod] = useState<Method>('password')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    try {
      const supabase = getSupabaseClient()
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/callback`,
          },
        })
        if (error) { setErrorMsg(error.message); setStatus('error'); return }
        // Projects with email confirmation disabled get a session immediately;
        // otherwise the user needs to click the confirmation link we just sent.
        setStatus('sent')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setErrorMsg(error.message); setStatus('error'); return }
        router.push('/inbox')
        router.refresh()
      }
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
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

  async function handleGoogle() {
    setErrorMsg('')
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/callback` },
    })
    if (error) { setErrorMsg(error.message); setStatus('error') }
    // On success, Supabase redirects the browser to Google — nothing else to do here.
  }

  if (status === 'sent') {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid rgba(79,92,244,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Mail size={22} style={{ color: 'var(--accent)' }} />
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px' }}>Check your inbox</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px', maxWidth: 320 }}>
          {method === 'magic-link' ? (
            <>We sent a magic link to{' '}<strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{email}</strong>. Click it and you&apos;re in.</>
          ) : (
            <>We sent a confirmation link to{' '}<strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{email}</strong>. Confirm your email to finish creating your account.</>
          )}
        </p>
        <button
          onClick={() => setStatus('idle')}
          style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Back
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleGoogle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#FFFFFF', color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>or</span>
        <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
      </div>

      {method === 'password' ? (
        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'signup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Name</label>
              <input
                type="text"
                className="input-base"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              className="input-base"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus={mode === 'login'}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
            <input
              type="password"
              className="input-base"
              placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              required
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
            {status === 'loading' ? 'Please wait…' : (
              <>
                {mode === 'login' ? 'Sign in' : 'Create account'}
                <ArrowRight size={15} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setMethod('magic-link'); setStatus('idle'); setErrorMsg('') }}
            style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}
          >
            {mode === 'login' ? 'Sign in with a magic link instead' : 'Use a magic link instead'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMagicLinkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                {mode === 'login' ? 'Send magic link' : 'Send confirmation link'}
                <ArrowRight size={15} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setMethod('password'); setStatus('idle'); setErrorMsg('') }}
            style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}
          >
            Use a password instead
          </button>
        </form>
      )}

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
