'use client'

import { useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import Link from 'next/link'
import { ArrowRight, Eye, EyeOff, Mail, TriangleAlert } from 'lucide-react'

type Method = 'password' | 'magic-link'
type Status = 'idle' | 'loading' | 'sent' | 'error'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Supabase surfaces terse, lowercase errors. Translate the common ones into
// plain, actionable language; pass anything unrecognised through unchanged.
function friendlyError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return "That email or password doesn't match. Please try again."
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already')) return 'An account with this email already exists — try signing in instead.'
  if (m.includes('email not confirmed')) return 'Please confirm your email first — check your inbox for the link we sent.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a moment and try again.'
  if (m.includes('should be at least') || m.includes('password')) return msg
  return msg || 'Something went wrong. Please try again.'
}

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

export default function AuthForm({
  mode = 'login',
  next = '/dashboard',
  initialError,
}: {
  mode?: 'login' | 'signup'
  /** Where to land after auth — carried through OAuth/magic-link/confirm. */
  next?: string
  /** A raw error surfaced by the /callback route (e.g. a failed exchange). */
  initialError?: string
}) {
  const [method, setMethod] = useState<Method>('password')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>(initialError ? 'error' : 'idle')
  const [errorMsg, setErrorMsg] = useState(initialError ? friendlyError(initialError) : '')
  const [showPassword, setShowPassword] = useState(false)
  // Set when a login is blocked because the email isn't confirmed yet — lets us
  // offer a one-click "resend confirmation" instead of a dead end.
  const [showResend, setShowResend] = useState(false)
  const [resent, setResent] = useState(false)

  // Absolute callback URL that carries `next`, so the server /callback handler
  // can send the user on to their intended destination after confirming.
  const callbackUrl = () => `${window.location.origin}/callback?next=${encodeURIComponent(next)}`
  // Hard navigation after auth: works for both pages and API routes (e.g. a
  // resumed /api/billing/checkout) and guarantees the fresh server request sees
  // the new session cookie.
  const go = () => { window.location.assign(next) }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Validate up-front so the user gets an instant, specific message instead of
    // a round-trip and a cryptic provider error.
    if (!EMAIL_RE.test(email.trim())) { setErrorMsg('Enter a valid email address.'); setStatus('error'); return }
    if (mode === 'signup' && password.length < 8) { setErrorMsg('Password must be at least 8 characters.'); setStatus('error'); return }
    setStatus('loading')
    setErrorMsg('')
    setShowResend(false)
    try {
      const supabase = getSupabaseClient()
      if (mode === 'signup') {
        track('signup_submitted', { method: 'password' })
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: callbackUrl(),
          },
        })
        if (error) { setErrorMsg(friendlyError(error.message)); setStatus('error'); return }
        // Projects with email confirmation disabled get a session immediately —
        // go straight to `next`. Otherwise show "check your inbox".
        if (data.session) { go(); return }
        setStatus('sent')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          if (error.message.toLowerCase().includes('email not confirmed')) setShowResend(true)
          setErrorMsg(friendlyError(error.message)); setStatus('error'); return
        }
        go()
      }
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) { setErrorMsg('Enter a valid email address.'); setStatus('error'); return }
    setStatus('loading')
    setErrorMsg('')
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl() },
      })
      if (error) { setErrorMsg(friendlyError(error.message)); setStatus('error') }
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
      options: { redirectTo: callbackUrl() },
    })
    if (error) { setErrorMsg(error.message); setStatus('error') }
    // On success, Supabase redirects the browser to Google — nothing else to do here.
  }

  async function handleResend() {
    if (!EMAIL_RE.test(email.trim())) return
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: callbackUrl() },
    })
    if (!error) { setResent(true); setShowResend(false) }
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
        <button onClick={() => setStatus('idle')} className="auth-alt-link" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
          Back
        </button>
      </div>
    )
  }

  return (
    <div>
      <button type="button" onClick={handleGoogle} className="btn-oauth">
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
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-base"
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={8}
                required
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                className="input-eye"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginTop: -6 }}>
              <Link href="/forgot-password" style={{ fontSize: 12.5, color: 'var(--text-muted)', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
          )}

          {status === 'error' && (
            <p className="form-error" role="alert">
              <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              {errorMsg}
            </p>
          )}

          {showResend && (
            <button type="button" className="auth-alt-link" onClick={handleResend} style={{ textAlign: 'left' }}>
              Resend confirmation email
            </button>
          )}
          {resent && (
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0 }}>
              Confirmation sent — check your inbox.
            </p>
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
            className="auth-alt-link"
            onClick={() => { setMethod('magic-link'); setStatus('idle'); setErrorMsg('') }}
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
            {status === 'loading' ? 'Sending…' : (
              <>
                {mode === 'login' ? 'Send magic link' : 'Send confirmation link'}
                <ArrowRight size={15} />
              </>
            )}
          </button>

          <button
            type="button"
            className="auth-alt-link"
            onClick={() => { setMethod('password'); setStatus('idle'); setErrorMsg('') }}
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
