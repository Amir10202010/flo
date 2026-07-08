'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Lock, Mail, Plug, Plus, TriangleAlert } from 'lucide-react'
import RequestAccessForm from '@/components/integrations/RequestAccessForm'
import { track } from '@/lib/analytics'

type Integration = { type: string; isActive: boolean; syncedAt: string | null; email: string | null }

function Banner({ tone, icon, children }: { tone: 'info' | 'error'; icon: React.ReactNode; children: React.ReactNode }) {
  const styles =
    tone === 'error'
      ? { background: 'var(--hot-dim)', border: '1px solid var(--hot-border)', color: 'var(--hot)' }
      : { background: 'var(--accent-dim)', border: '1px solid rgba(79,92,244,0.2)', color: 'var(--accent)' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 11, background: styles.background, border: styles.border }}>
      <span style={{ flexShrink: 0, display: 'flex', color: styles.color }}>{icon}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}

/** Connected shared inboxes for the org + the invite-only request-access flow.
 * Connect starts the Gmail OAuth flow; disconnect deactivates the integration.
 * Replaces the standalone /integrations page (the OAuth callback redirects here
 * with ?connected / ?error). */
function InboxesPanelInner({ canManage }: { canManage: boolean }) {
  const searchParams = useSearchParams()
  const justConnected = searchParams.get('connected')
  const connectError = searchParams.get('error')

  const [items, setItems] = useState<Integration[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showRequest, setShowRequest] = useState(false)

  async function load() {
    const r = await fetch('/api/integrations').then((x) => (x.ok ? x.json() : null)).catch(() => null)
    setItems(Array.isArray(r) ? r : [])
    setLoaded(true)
  }
  useEffect(() => {
    const run = async () => { await load() }
    void run()
  }, [])

  async function disconnect(type: string) {
    if (!confirm('Disconnect this shared inbox? Its threads will be hidden until reconnected.')) return
    await fetch('/api/integrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) })
    load()
  }

  const active = items.filter((i) => i.isActive)
  const hasActive = active.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {justConnected && (
        <Banner tone="info" icon={<CheckCircle2 size={16} />}>Gmail connected — importing your conversations…</Banner>
      )}
      {connectError && (
        <Banner tone="error" icon={<TriangleAlert size={16} />}>Connection error: {connectError}. Please try again.</Banner>
      )}

      <div className="card" style={{ padding: '6px 8px' }}>
        {loaded && !hasActive && (
          <div style={{ padding: '22px 14px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>No shared inbox connected</p>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>Connect a Gmail mailbox your team works out of.</p>
          </div>
        )}
        {active.map((i) => (
          <div key={i.type + i.email} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px' }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Mail size={16} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{i.email ?? i.type}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {i.type === 'GMAIL' ? 'Gmail' : i.type} · {i.syncedAt ? 'synced' : 'sync pending'}
              </div>
            </div>
            {canManage && (
              <button type="button" onClick={() => disconnect(i.type)} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>Disconnect</button>
            )}
          </div>
        ))}
      </div>

      {/* Already connected + can manage → straight to connecting another mailbox. */}
      {canManage && hasActive && (
        <a href="/api/auth/gmail" onClick={() => track('gmail_connect_clicked', { context: 'add-another' })} className="btn-primary" style={{ alignSelf: 'flex-start', gap: 7, fontSize: 13.5, padding: '10px 16px' }}>
          <Plus size={15} /> Connect another inbox
        </a>
      )}

      {/* Nothing connected yet → invite-only request flow (with an approved escape hatch). */}
      {canManage && loaded && !hasActive && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button type="button" className="btn-primary" onClick={() => setShowRequest((v) => !v)} style={{ alignSelf: 'flex-start', gap: 7, fontSize: 13.5, padding: '10px 16px' }}>
            <Plus size={15} /> Request access
          </button>
          <p style={{ margin: '10px 2px 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 540 }}>
            Velnox is invite-only while we finish Google verification. Request access with the Gmail you want to connect — or{' '}
            <a href="/api/auth/gmail" onClick={() => track('gmail_connect_clicked', { context: 'approved' })} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              connect if you&apos;re already approved
            </a>
            .
          </p>
          {showRequest && <RequestAccessForm />}
        </div>
      )}

      {!canManage && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plug size={13} /> Only admins can connect or disconnect inboxes.
        </p>
      )}

      <p style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '2px 2px 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        <Lock size={12} style={{ flexShrink: 0 }} />
        OAuth tokens are encrypted at rest. Disconnect any time — imported threads are hidden immediately.
      </p>
    </div>
  )
}

export default function InboxesPanel({ canManage }: { canManage: boolean }) {
  // useSearchParams (for the ?connected / ?error connect-flow banners) needs a
  // Suspense boundary — same pattern the old IntegrationsClient used.
  return (
    <Suspense>
      <InboxesPanelInner canManage={canManage} />
    </Suspense>
  )
}
