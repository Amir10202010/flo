'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail, CheckCircle, RefreshCw, AlertCircle, Loader } from 'lucide-react'

type Integration = { type: 'GMAIL' | 'TELEGRAM'; isActive: boolean; syncedAt: string | null }
type SyncResult  = { synced: number; created: number; updated: number; errors: string[] }

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function IntegrationsContent() {
  const searchParams = useSearchParams()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)

  const justConnected = searchParams.get('connected')
  const connectError  = searchParams.get('error')

  useEffect(() => {
    fetch('/api/integrations')
      .then(r => r.ok ? r.json() : [])
      .then((data: Integration[]) => setIntegrations(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [justConnected])

  const gmail = integrations.find(i => i.type === 'GMAIL' && i.isActive)

  async function handleSync() {
    setSyncing(true); setSyncResult(null)
    try {
      const data = await fetch('/api/integrations/gmail/sync', { method: 'POST' }).then(r => r.json())
      setSyncResult(data)
      const fresh = await fetch('/api/integrations').then(r => r.json())
      if (Array.isArray(fresh)) setIntegrations(fresh)
    } catch {
      setSyncResult({ synced: 0, created: 0, updated: 0, errors: ['Network error'] })
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    await fetch('/api/integrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'GMAIL' }) }).catch(() => {})
    setIntegrations(prev => prev.filter(i => i.type !== 'GMAIL'))
    setSyncResult(null); setDisconnecting(false)
  }

  return (
    <div style={{ padding: '40px 40px', maxWidth: 760 }}>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>Integrations</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Connect your channels to see all conversations in one place.</p>
      </div>

      {justConnected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid rgba(79,92,244,0.2)', marginBottom: 20 }}>
          <CheckCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>Gmail connected. Click <strong>Sync</strong> to import your conversations.</span>
        </div>
      )}

      {connectError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'var(--hot-dim)', border: '1px solid var(--hot-border)', marginBottom: 20 }}>
          <AlertCircle size={16} style={{ color: 'var(--hot)', flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>Connection error: {connectError}. Please try again.</span>
        </div>
      )}

      {syncResult && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', marginBottom: 20 }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>Sync complete</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            {syncResult.synced} conversations processed · {syncResult.created} created · {syncResult.updated} updated
            {syncResult.errors.length > 0 && ` · ${syncResult.errors.length} errors`}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Gmail */}
        <div style={{ padding: 22, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(234,67,53,0.08)', border: '1px solid rgba(234,67,53,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Mail size={20} style={{ color: '#EA4335' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Gmail</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {loading ? 'Loading…' : gmail
                    ? `Connected · synced ${formatRelative(gmail.syncedAt)}`
                    : 'Not connected'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {loading ? null : gmail ? (
                <>
                  <button onClick={handleSync} disabled={syncing} className="btn-ghost" style={{ fontSize: 13, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {syncing
                      ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Syncing…</>
                      : <><RefreshCw size={13} /> Sync</>}
                  </button>
                  <button onClick={handleDisconnect} disabled={disconnecting} style={{ fontSize: 13, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--hot-border)', background: 'var(--hot-dim)', color: 'var(--hot)', cursor: 'pointer' }}>
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </>
              ) : (
                <a href="/api/auth/gmail" className="btn-primary" style={{ fontSize: 13, padding: '7px 16px', textDecoration: 'none' }}>
                  Connect
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Telegram — coming soon */}
        <div style={{ padding: 22, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--border)', opacity: 0.55 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(42,171,238,0.08)', border: '1px solid rgba(42,171,238,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 20 }}>✈</span>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Telegram</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Coming soon</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>Soon</div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  return <Suspense><IntegrationsContent /></Suspense>
}
