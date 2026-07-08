'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase'
import { ArrowRight, Eye, EyeOff, TriangleAlert } from 'lucide-react'

type Status = 'idle' | 'loading' | 'error'

export default function ResetPasswordPage() {
  const [supabase] = useState(getSupabaseClient)
  // null = still checking for a recovery session; true/false = resolved.
  const [ready, setReady] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // The /callback route already exchanged the recovery code and set the
    // session cookie, so getSession() resolves it here. We also listen for the
    // PASSWORD_RECOVERY event to cover hash-based links that hydrate late.
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setReady(true)
      else if (mounted) setReady(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session) setReady(true)
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setErrorMsg('Password must be at least 8 characters.'); setStatus('error'); return }
    if (password !== confirm) { setErrorMsg('Passwords do not match.'); setStatus('error'); return }
    setStatus('loading')
    setErrorMsg('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setErrorMsg(error.message); setStatus('error'); return }
      // Hard navigation guarantees the dashboard's server request sees the
      // refreshed session.
      window.location.assign('/dashboard')
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ marginBottom: 26, textAlign: 'center' }}>
        <h1 className="display-title" style={{ fontSize: 28, margin: '0 0 8px' }}>
          Set a new password
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
          Choose a new password for your account.
        </p>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', boxShadow: 'var(--shadow-sm)' }}>
        {ready === false ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 18px' }}>
              This reset link is invalid or has expired. Request a fresh one to continue.
            </p>
            <Link href="/forgot-password" className="btn-primary" style={{ justifyContent: 'center', gap: 8 }}>
              Request a new link <ArrowRight size={15} />
            </Link>
          </div>
        ) : ready === null ? (
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0' }}>Checking your link…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-base"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={8}
                  required
                  autoFocus
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-base"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                minLength={8}
                required
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
              {status === 'loading' ? 'Saving…' : (<>Update password <ArrowRight size={15} /></>)}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
