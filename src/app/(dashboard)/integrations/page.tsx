'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail, CheckCircle, AlertCircle, Loader } from 'lucide-react'

type Integration = { type: 'GMAIL' | 'TELEGRAM'; isActive: boolean; syncedAt: string | null }
type SyncResult  = { synced: number; created: number; updated: number; errors: string[]; queuedAnalyses?: number; stillRunning?: boolean }

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

  const gmail = integrations.find(i => i.type === 'GMAIL' && i.isActive)

  async function handleSync() {
    setSyncing(true); setSyncResult(null)
    try {
      // Sync now runs in the background worker: enqueue, then poll for the result.
      const queued = await fetch('/api/integrations/gmail/sync', { method: 'POST' }).then(r => r.json())
      if (!queued.jobId) {
        setSyncResult({ synced: 0, created: 0, updated: 0, errors: [queued.error ?? 'Could not queue sync'] })
        return
      }

      const result = await pollJob(queued.jobId)
      if (result) {
        setSyncResult(result as SyncResult)
      } else {
        // Poll window elapsed but the job hasn't failed — it's still working in
        // the background. Not an error: the inbox keeps filling as it runs.
        setSyncResult({ synced: 0, created: 0, updated: 0, errors: [], stillRunning: true })
      }
      const fresh = await fetch('/api/integrations').then(r => r.json()).catch(() => null)
      if (Array.isArray(fresh)) setIntegrations(fresh)
    } catch {
      setSyncResult({ synced: 0, created: 0, updated: 0, errors: ['Network error'] })
    } finally {
      setSyncing(false)
    }
  }

  /** Poll a job until it finishes (or times out after ~2 min). */
  async function pollJob(jobId: string): Promise<unknown | null> {
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1500))
      const job = await fetch(`/api/jobs/${jobId}`).then(r => r.ok ? r.json() : null).catch(() => null)
      if (!job) continue
      if (job.status === 'COMPLETED') return job.result
      if (job.status === 'FAILED') return { synced: 0, created: 0, updated: 0, errors: [job.error ?? 'Sync failed'] }
    }
    return null
  }

  // Declared after handleSync so the effect below can reference it safely.
  useEffect(() => {
    let active = true
    fetch('/api/integrations')
      .then(r => r.ok ? r.json() : [])
      .then((data: Integration[]) => {
        if (!active) return
        const list = Array.isArray(data) ? data : []
        setIntegrations(list)
        // Auto-sync immediately after connecting — no manual Sync button.
        if (justConnected && list.some(i => i.type === 'GMAIL' && i.isActive)) {
          void handleSync()
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justConnected])

  async function handleDisconnect() {
    setDisconnecting(true)
    await fetch('/api/integrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'GMAIL' }) }).catch(() => {})
    setIntegrations(prev => prev.filter(i => i.type !== 'GMAIL'))
    setSyncResult(null); setDisconnecting(false)
  }

  return (
    <div className="dash-page" style={{ padding: '40px 40px', maxWidth: 760 }}>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>Integrations</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Connect your channels to see all conversations in one place.</p>
      </div>

      {justConnected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid rgba(79,92,244,0.2)', marginBottom: 20 }}>
          <CheckCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>Gmail connected — importing your conversations…</span>
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
          <p style={{ margin: '0 0 4px', fontSize: 14, color: !syncResult.stillRunning && syncResult.errors.length > 0 && syncResult.synced === 0 ? 'var(--hot)' : 'var(--text-primary)', fontWeight: 600 }}>
            {syncResult.stillRunning ? 'Import still running' : syncResult.errors.length === 0 ? 'Sync complete' : syncResult.synced > 0 ? 'Sync completed with errors' : 'Sync failed'}
          </p>
          {syncResult.stillRunning ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              The first import can take a few minutes — your conversations keep appearing in the inbox while it runs. Check back shortly.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              {syncResult.synced} conversations processed · {syncResult.created} created · {syncResult.updated} updated
              {typeof syncResult.queuedAnalyses === 'number' && syncResult.queuedAnalyses > 0 && ` · ${syncResult.queuedAnalyses} queued for AI analysis`}
              {syncResult.errors.length > 0 && ` · ${syncResult.errors.length} ${syncResult.errors.length === 1 ? 'error' : 'errors'}`}
            </p>
          )}
          {syncResult.errors.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--hot)', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {syncResult.errors.slice(0, 3).map((e, i) => (
                <li key={i} style={{ overflowWrap: 'anywhere' }}>{e}</li>
              ))}
              {syncResult.errors.length > 3 && (
                <li style={{ listStyle: 'none', color: 'var(--text-muted)' }}>…and {syncResult.errors.length - 3} more</li>
              )}
            </ul>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Gmail */}
        <div className="integration-card" style={{ padding: 22, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
          <div className="integration-card-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div className="integration-info" style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(234,67,53,0.08)', border: '1px solid rgba(234,67,53,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Mail size={20} style={{ color: '#EA4335' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Gmail</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {loading ? 'Loading…' : gmail
                    ? (syncing ? 'Syncing your conversations…' : `Connected · synced ${formatRelative(gmail.syncedAt)}`)
                    : 'Not connected'}
                </div>
              </div>
            </div>

            <div className="integration-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {loading ? null : gmail ? (
                <>
                  {syncing && (
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                      <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Syncing…
                    </span>
                  )}
                  <button className="integration-btn" onClick={handleDisconnect} disabled={disconnecting} style={{ fontSize: 13, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--hot-border)', background: 'var(--hot-dim)', color: 'var(--hot)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </>
              ) : (
                <a href="/api/auth/gmail" className="btn-primary integration-btn" style={{ fontSize: 13, padding: '8px 18px', textDecoration: 'none' }}>
                  Connect
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Telegram — coming soon */}
        <div className="integration-card" style={{ padding: 22, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--border)', opacity: 0.55 }}>
          <div className="integration-card-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div className="integration-info" style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(42,171,238,0.08)', border: '1px solid rgba(42,171,238,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 20 }}>✈</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Telegram</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Coming soon</div>
              </div>
            </div>
            <div className="integration-soon-pill" style={{ fontSize: 12, color: 'var(--text-muted)', padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', flexShrink: 0, alignSelf: 'flex-start' }}>Soon</div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  return <Suspense><IntegrationsContent /></Suspense>
}
