'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownWideNarrow, ChevronDown, Clock, Plug, Search, Sparkles } from 'lucide-react'
import ConversationList, { type ConversationSummary } from './ConversationList'

export type InboxGroup = {
  id: string
  channel: 'GMAIL' | 'TELEGRAM'
  label: string
  conversations: ConversationSummary[]
}

type Filter = 'ALL' | 'HOT' | 'ATTENTION'
type Sort = 'priority' | 'recent'

const FILTERS: { key: Filter; label: string; dot?: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'HOT', label: 'Urgent', dot: 'var(--hot)' },
  { key: 'ATTENTION', label: 'High', dot: 'var(--attention)' },
]

function sortConvs(convs: ConversationSummary[], sort: Sort): ConversationSummary[] {
  const ts = (c: ConversationSummary) => (c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0)
  return [...convs].sort((a, b) =>
    sort === 'recent'
      ? ts(b) - ts(a)
      : b.priorityScore - a.priorityScore || ts(b) - ts(a),
  )
}

export default function InboxList({
  groups,
  total,
  hasConnection,
}: {
  groups: InboxGroup[]
  total: number
  hasConnection: boolean
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [sort, setSort] = useState<Sort>('priority')
  // Single-open accordion: only one mailbox group is expanded at a time.
  const [openId, setOpenId] = useState<string | null>(groups[0]?.id ?? null)

  const q = query.trim().toLowerCase()
  const searching = q.length > 0
  const filtering = filter !== 'ALL'

  // Counts for the filter chips (across all mailboxes).
  const counts = useMemo(() => {
    const all = groups.flatMap(g => g.conversations)
    return {
      ALL: all.length,
      HOT: all.filter(c => c.priority === 'HOT').length,
      ATTENTION: all.filter(c => c.priority === 'ATTENTION').length,
    }
  }, [groups])

  const visible = useMemo(() => {
    return groups
      .map(g => {
        let convs = g.conversations
        if (q) {
          convs = convs.filter(c =>
            c.contact.name.toLowerCase().includes(q) ||
            (c.contact.email ?? '').toLowerCase().includes(q) ||
            (c.subject ?? '').toLowerCase().includes(q) ||
            (c.lastMessage ?? '').toLowerCase().includes(q),
          )
        }
        if (filter !== 'ALL') convs = convs.filter(c => c.priority === filter)
        return { ...g, conversations: sortConvs(convs, sort) }
      })
      .filter(g => (searching || filtering ? g.conversations.length > 0 : true))
  }, [groups, q, filter, sort, searching, filtering])

  const nothingMatches = (searching || filtering) && visible.length === 0

  return (
    <>
      <div className="inbox-list-header" style={{ padding: '18px 18px 12px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Inbox</h1>
          {hasConnection && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total}</span>}
        </div>

        {/* AI search — semantic search is a stub for now; this filters by text. */}
        <div className="inbox-search">
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
          />
          <span className="inbox-search-badge" title="AI semantic search is coming soon — for now this filters by text">
            <Sparkles size={10} /> AI · beta
          </span>
        </div>

        {hasConnection && (
          <div className="inbox-controls">
            <div className="fchip-row" role="tablist" aria-label="Filter by priority">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  className={`fchip${filter === f.key ? ' active' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.dot && filter !== f.key && <span className="fchip-dot" style={{ background: f.dot }} />}
                  {f.label}
                  <span className="fchip-count">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="inbox-sort-btn"
              onClick={() => setSort(s => (s === 'priority' ? 'recent' : 'priority'))}
              title={sort === 'priority' ? 'Sorted by priority — click for newest first' : 'Sorted by newest — click for priority first'}
            >
              {sort === 'priority' ? <ArrowDownWideNarrow size={13} /> : <Clock size={13} />}
              {sort === 'priority' ? 'Priority' : 'Newest'}
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!hasConnection ? (
          <ConnectEmpty />
        ) : nothingMatches ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600 }}>
              {searching ? `No matches for “${query}”` : 'Nothing here'}
            </p>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>
              {searching ? 'Try a different name, subject or phrase.' : 'No conversations at this priority right now.'}
            </p>
          </div>
        ) : (
          visible.map(g => {
            const open = searching || filtering || openId === g.id
            return (
              <div key={g.id}>
                <button
                  type="button"
                  className="inbox-group-head"
                  aria-expanded={open}
                  onClick={() => setOpenId(prev => (prev === g.id ? null : g.id))}
                >
                  <span className="inbox-group-dot" style={{ background: g.channel === 'GMAIL' ? '#EA4335' : 'var(--accent)' }} />
                  <span className="inbox-group-label">{g.label}</span>
                  <span className="inbox-group-count">{g.conversations.length}</span>
                  <ChevronDown size={15} className="inbox-group-chevron" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                </button>
                {open && <ConversationList conversations={g.conversations} />}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

function ConnectEmpty() {
  return (
    <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <Plug size={22} style={{ color: 'var(--accent)' }} />
      </div>
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>No channels connected yet</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 240 }}>
          Connect Gmail to pull your conversations into Velnox and start prioritising them.
        </p>
      </div>
      <Link href="/integrations" className="btn-primary" style={{ fontSize: 13.5, padding: '9px 18px', textDecoration: 'none' }}>
        Connect a channel
      </Link>
    </div>
  )
}
