'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, Lock, Mail, Send, TriangleAlert } from 'lucide-react'
import { Reveal } from '@/components/dashboard/Motion'
import ModulePill from '@/components/dashboard/ModulePill'

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

function StatusChip({ tone, children }: { tone: 'success' | 'syncing' | 'muted'; children: React.ReactNode }) {
  const color = tone === 'success' ? 'var(--success)' : tone === 'syncing' ? 'var(--accent)' : 'var(--text-muted)'
  const bg    = tone === 'success' ? 'var(--success-dim)' : tone === 'syncing' ? 'var(--accent-dim)' : 'var(--spam-dim)'
  const bord  = tone === 'success' ? 'var(--success-border)' : tone === 'syncing' ? 'rgba(79,92,244,0.22)' : 'var(--spam-border)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${bord}`, borderRadius: 100, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {tone === 'syncing'
        ? <Loader2 size={11} className="animate-spin" />
        : <span className={tone === 'success' ? 'animate-pulse-s' : undefined} style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />}
      {children}
    </span>
  )
}

function Banner({ tone, icon, children }: { tone: 'info' | 'error'; icon: React.ReactNode; children: React.ReactNode }) {
  const styles = tone === 'error'
    ? { background: 'var(--hot-dim)', border: '1px solid var(--hot-border)', color: 'var(--hot)' }
    : { background: 'var(--accent-dim)', border: '1px solid rgba(79,92,244,0.2)', color: 'var(--accent)' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, marginBottom: 14, ...styles }}>
      <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>{children}</span>
    </div>
  )
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

  const syncFailed = Boolean(syncResult && !syncResult.stillRunning && syncResult.errors.length > 0 && syncResult.synced === 0)

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 820, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: '0 0 5px', fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Integrations
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Connect your channels to see every client conversation in one place.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        {justConnected && (
          <Banner tone="info" icon={<CheckCircle2 size={16} />}>
            Gmail connected — importing your conversations…
          </Banner>
        )}

        {connectError && (
          <Banner tone="error" icon={<TriangleAlert size={16} />}>
            Connection error: {connectError}. Please try again.
          </Banner>
        )}

        {syncResult && (
          <div style={{ padding: '13px 16px', borderRadius: 12, background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', marginBottom: 14, display: 'flex', gap: 11 }}>
            <span style={{ flexShrink: 0, marginTop: 1, color: syncFailed ? 'var(--hot)' : syncResult.stillRunning ? 'var(--accent)' : 'var(--success)', display: 'flex' }}>
              {syncFailed ? <TriangleAlert size={16} /> : syncResult.stillRunning ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: '0 0 3px', fontSize: 13.5, color: syncFailed ? 'var(--hot)' : 'var(--text-primary)', fontWeight: 600 }}>
                {syncResult.stillRunning ? 'Import still running' : syncResult.errors.length === 0 ? 'Sync complete' : syncResult.synced > 0 ? 'Sync completed with errors' : 'Sync failed'}
              </p>
              {syncResult.stillRunning ? (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  The first import can take a few minutes — your conversations keep appearing in the inbox while it runs. Check back shortly.
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
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
          </div>
        )}
      </Reveal>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Gmail */}
        <Reveal delay={0.1}>
          <div className="integration-card" style={{ padding: 22, borderRadius: 16, background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', overflow: 'hidden', position: 'relative' }}>
            {/* Indeterminate sync bar across the top edge */}
            {syncing && <div className="ai-shimmer" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3 }} />}

            <div className="integration-card-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div className="integration-info" style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(234,67,53,0.08)', border: '1px solid rgba(234,67,53,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail size={20} style={{ color: '#EA4335' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Gmail</span>
                    {!loading && gmail && (
                      syncing
                        ? <StatusChip tone="syncing">Syncing</StatusChip>
                        : <StatusChip tone="success">Connected</StatusChip>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loading ? 'Loading…' : gmail
                      ? (syncing ? 'Importing your conversations…' : `Last synced ${formatRelative(gmail.syncedAt)}`)
                      : 'Threads, contacts and replies — analyzed as they arrive'}
                  </div>
                </div>
              </div>

              <div className="integration-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {loading ? null : gmail ? (
                  <button className="btn-danger-ghost integration-btn" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : (
                  <a href="/api/auth/gmail" className="btn-primary integration-btn" style={{ fontSize: 13, padding: '9px 18px' }}>
                    Connect
                  </a>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        {/* Telegram — in development */}
        <Reveal delay={0.15}>
          <div className="integration-card" style={{ padding: 22, borderRadius: 16, background: '#FFFFFF', border: '1px dashed var(--border)' }}>
            <div className="integration-card-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div className="integration-info" style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(42,171,238,0.08)', border: '1px solid rgba(42,171,238,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Send size={18} style={{ color: '#2AABEE' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Telegram</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>Client DMs in the same prioritized inbox — in development</div>
                </div>
              </div>
              <div style={{ flexShrink: 0, alignSelf: 'flex-start' }}>
                <ModulePill status="soon" />
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '4px 4px 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <Lock size={12} style={{ flexShrink: 0 }} />
            OAuth tokens are encrypted at rest. Disconnect any time — imported threads are hidden immediately.
          </p>
        </Reveal>
      </div>
    </div>
  )
}

export default function IntegrationsClient() {
  return <Suspense><IntegrationsContent /></Suspense>
}
