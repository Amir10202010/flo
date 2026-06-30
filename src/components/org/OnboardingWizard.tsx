'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, Check, Mail, Plus, Users, X } from 'lucide-react'

type Step = 'create' | 'team'

/** Multi-step first-run onboarding: create the workspace, then optionally invite
 * teammates and connect a shared inbox. Each step persists immediately. */
export default function OnboardingWizard({ defaultName = '' }: { defaultName?: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('create')
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // team step
  const [invites, setInvites] = useState<string[]>([])
  const [emailDraft, setEmailDraft] = useState('')
  const [sent, setSent] = useState(0)

  async function createOrg(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter a workspace name'); return }
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/orgs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }) })
      if (!r.ok) { const d = await r.json().catch(() => null); setError(d?.error ?? 'Could not create workspace'); return }
      setStep('team')
    } catch { setError('Network error — try again') } finally { setBusy(false) }
  }

  function addEmail() {
    const e = emailDraft.trim().toLowerCase()
    if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !invites.includes(e)) {
      setInvites((p) => [...p, e]); setEmailDraft('')
    }
  }

  async function sendInvites() {
    setBusy(true)
    let ok = 0
    for (const email of invites) {
      const r = await fetch('/api/orgs/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role: 'MEMBER' }) })
      if (r.ok) ok++
    }
    setSent(ok); setInvites([]); setBusy(false)
  }

  function finish() {
    router.push('/dashboard'); router.refresh()
  }

  return (
    <div style={{ width: '100%', maxWidth: 460 }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
        {(['create', 'team'] as Step[]).map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: step === s || (s === 'create' && step === 'team') ? 'var(--accent)' : 'var(--bg-subtle)', color: step === s || (s === 'create' && step === 'team') ? '#fff' : 'var(--text-muted)' }}>
              {s === 'create' && step === 'team' ? <Check size={13} /> : i + 1}
            </span>
            {i === 0 && <span style={{ width: 28, height: 2, background: 'var(--border)' }} />}
          </div>
        ))}
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 16, padding: '26px 24px', boxShadow: 'var(--shadow-sm)' }}>
        {step === 'create' ? (
          <form onSubmit={createOrg}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <Building2 size={17} style={{ color: 'var(--accent)' }} />
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Name your workspace</h2>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>This is what your team will see.</p>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." autoFocus maxLength={80}
              style={{ width: '100%', padding: '11px 12px', fontSize: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none', marginBottom: error ? 8 : 18 }}
            />
            {error && <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--hot)' }}>{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy} style={{ width: '100%', justifyContent: 'center', gap: 8 }}>
              {busy ? 'Creating…' : 'Continue'} {!busy && <ArrowRight size={15} />}
            </button>
          </form>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <Users size={17} style={{ color: 'var(--accent)' }} />
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Invite your team</h2>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)' }}>Add teammates by email — they&apos;ll get an invite link. Optional.</p>

            <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
              <input
                type="email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}
                placeholder="teammate@company.com"
                style={{ flex: 1, padding: '10px 11px', fontSize: 13.5, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
              />
              <button type="button" onClick={addEmail} className="btn-ghost" style={{ padding: '0 12px' }}><Plus size={16} /></button>
            </div>

            {invites.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {invites.map((e) => (
                  <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', padding: '3px 9px' }}>
                    <Mail size={11} /> {e}
                    <button type="button" onClick={() => setInvites((p) => p.filter((x) => x !== e))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', padding: 0 }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}

            {invites.length > 0 && (
              <button type="button" onClick={sendInvites} disabled={busy} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginBottom: 12, fontSize: 13.5 }}>
                {busy ? 'Sending…' : `Send ${invites.length} invite${invites.length === 1 ? '' : 's'}`}
              </button>
            )}
            {sent > 0 && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--success)' }}>✓ Sent {sent} invite{sent === 1 ? '' : 's'}.</p>}

            <a href="/settings?tab=connections" className="btn-ghost" style={{ width: '100%', justifyContent: 'center', gap: 7, marginBottom: 8, fontSize: 13.5 }}>
              <Mail size={15} /> Set up your shared inbox
            </a>
            <p style={{ margin: '0 0 12px', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, textAlign: 'center' }}>
              Velnox is invite-only while we finish Google verification — you&apos;ll request access to the Gmail you want to connect.
            </p>

            <button type="button" onClick={finish} className="btn-primary" style={{ width: '100%', justifyContent: 'center', gap: 8 }}>
              Go to dashboard <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
