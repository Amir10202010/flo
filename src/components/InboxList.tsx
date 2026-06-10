'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, ChevronDown, Plug, Sparkles } from 'lucide-react'
import ConversationList, { type ConversationSummary } from './ConversationList'

export type InboxGroup = {
  id: string
  channel: 'GMAIL' | 'TELEGRAM'
  label: string
  conversations: ConversationSummary[]
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
  // Single-open accordion: only one mailbox group is expanded at a time.
  const [openId, setOpenId] = useState<string | null>(groups[0]?.id ?? null)

  const q = query.trim().toLowerCase()
  const searching = q.length > 0

  const filtered = useMemo(() => {
    if (!q) return groups
    return groups
      .map(g => ({
        ...g,
        conversations: g.conversations.filter(c =>
          c.contact.name.toLowerCase().includes(q) ||
          (c.contact.email ?? '').toLowerCase().includes(q) ||
          (c.subject ?? '').toLowerCase().includes(q) ||
          (c.lastMessage ?? '').toLowerCase().includes(q),
        ),
      }))
      .filter(g => g.conversations.length > 0)
  }, [groups, q])

  return (
    <>
      <div className="inbox-list-header" style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
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
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!hasConnection ? (
          <ConnectEmpty />
        ) : searching && filtered.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>No matches for “{query}”.</p>
          </div>
        ) : (
          filtered.map(g => {
            const open = searching || openId === g.id
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
