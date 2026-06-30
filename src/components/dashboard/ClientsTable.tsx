'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ChevronRight, Search, Users } from 'lucide-react'
import type { ClientRow } from '@/services/clients.service'
import WidgetShell from './WidgetShell'
import ContactAvatar from './ContactAvatar'
import RiskBadge from './RiskBadge'
import EmptyNote from './EmptyNote'
import ContactNotesButton from './ContactNotesButton'

type SortKey = 'name' | 'threads' | 'engagement' | 'lastActivity'

const SENTIMENT_DOT: Record<string, { color: string; label: string }> = {
  POSITIVE: { color: 'var(--success)', label: 'Positive' },
  NEUTRAL: { color: 'var(--text-muted)', label: 'Neutral' },
  NEGATIVE: { color: 'var(--hot)', label: 'Negative' },
}

function engagementColor(v: number) {
  return v >= 60 ? 'var(--success)' : v >= 35 ? 'var(--attention)' : 'var(--hot)'
}

function SortHead({
  k,
  sortKey,
  sortDir,
  onToggle,
  width,
  children,
}: {
  k: SortKey
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onToggle: (k: SortKey) => void
  width?: number
  children: React.ReactNode
}) {
  const active = sortKey === k
  return (
    <th
      className="sortable"
      style={{ width }}
      onClick={() => onToggle(k)}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: active ? 'var(--accent)' : undefined }}>
        {children}
        {active && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </span>
    </th>
  )
}

export default function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('engagement')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q))
      : rows
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name) * dir
        case 'threads':
          return (a.threads - b.threads) * dir
        case 'engagement':
          return (a.engagement - b.engagement) * dir
        case 'lastActivity': {
          const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0
          const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0
          return (ta - tb) * dir
        }
      }
    })
  }, [rows, query, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sortHeadProps = { sortKey, sortDir, onToggle: toggleSort }

  return (
    <WidgetShell
      icon={<Users size={14} />}
      title="Client directory"
      sub={`${rows.length} ${rows.length === 1 ? 'contact' : 'contacts'} · engagement and risk update with every sync`}
      status="live"
      action={
        <div className="inbox-search" style={{ width: 230, padding: '7px 10px', flexShrink: 0 }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients…"
            aria-label="Search clients"
          />
        </div>
      }
    >
      {visible.length === 0 ? (
        <EmptyNote
          icon={<Users size={17} />}
          title={query ? `No clients matching “${query}”` : 'No clients yet'}
          hint={query ? 'Try a different name or email.' : 'Contacts appear automatically as conversations sync.'}
        />
      ) : (
        <>
        <div className="clients-table-wrap">
          <table className="clients-table">
            <thead>
              <tr>
                <SortHead k="name" {...sortHeadProps}>Client</SortHead>
                <th style={{ width: 90 }}>Channel</th>
                <SortHead k="threads" width={84} {...sortHeadProps}>Threads</SortHead>
                <SortHead k="engagement" width={170} {...sortHeadProps}>Engagement</SortHead>
                <th style={{ width: 120 }}>Risk</th>
                <th style={{ width: 110 }}>Sentiment</th>
                <SortHead k="lastActivity" width={120} {...sortHeadProps}>Last activity</SortHead>
                <th style={{ width: 56 }}>Notes</th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const sentiment = r.sentiment ? SENTIMENT_DOT[r.sentiment] : null
                return (
                  <tr
                    key={r.id}
                    style={{ cursor: r.href ? 'pointer' : 'default' }}
                    onClick={() => r.href && router.push(r.href)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                        <ContactAvatar name={r.name} size={32} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                              {r.name}
                            </span>
                            {r.awaitingReply && (
                              <span title="Awaiting your reply" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--attention)', flexShrink: 0 }} />
                            )}
                          </div>
                          {r.email && (
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                              {r.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="chat-chip">{r.channel === 'GMAIL' ? 'Gmail' : 'Telegram'}</span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.threads}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 90, height: 5, borderRadius: 4, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                          <div style={{ width: `${r.engagement}%`, height: '100%', borderRadius: 4, background: engagementColor(r.engagement) }} />
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', width: 22 }}>{r.engagement}</span>
                      </div>
                    </td>
                    <td>{r.risk ? <RiskBadge level={r.risk} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>
                      {sentiment ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: sentiment.color }} />
                          {sentiment.label}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.lastActivityAgo ?? '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <ContactNotesButton contactId={r.id} contactName={r.name} count={r.noteCount} />
                    </td>
                    <td>
                      <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: the 8-column table can't fit a phone, so each client is a card. */}
        <div className="clients-cards">
          {visible.map((r) => {
            const sentiment = r.sentiment ? SENTIMENT_DOT[r.sentiment] : null
            return (
              <button key={r.id} type="button" className="client-card" onClick={() => r.href && router.push(r.href)}>
                <ContactAvatar name={r.name} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    {r.awaitingReply && <span title="Awaiting your reply" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--attention)', flexShrink: 0 }} />}
                  </div>
                  {r.email && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{r.email}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{r.threads} threads</span>
                    <span style={{ color: 'var(--text-muted)' }}>· {r.lastActivityAgo ?? 'no activity'}</span>
                    {sentiment && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        ·<span style={{ width: 7, height: 7, borderRadius: '50%', background: sentiment.color }} />{sentiment.label}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, flexShrink: 0 }}>
                  {r.risk ? <RiskBadge level={r.risk} /> : null}
                  <span style={{ fontSize: 12, fontWeight: 700, color: engagementColor(r.engagement) }}>{r.engagement}</span>
                </div>
              </button>
            )
          })}
        </div>
        </>
      )}
    </WidgetShell>
  )
}
