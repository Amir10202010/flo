'use client'

import { useRouter, usePathname } from 'next/navigation'

export type ConversationSummary = {
  id: string
  channel: 'GMAIL' | 'TELEGRAM'
  subject: string | null
  priority: 'HOT' | 'ATTENTION' | 'COLD' | 'SPAM'
  priorityScore: number
  lastMessageAt: string | null
  contact: { name: string; email: string | null }
  lastMessage: string | null
  unreadCount: number
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('')
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

const P: Record<string, { badge: string; avatarBg: string; avatarColor: string }> = {
  HOT:       { badge: 'priority-badge priority-hot',       avatarBg: 'rgba(220,43,85,0.1)',   avatarColor: 'var(--hot)'       },
  ATTENTION: { badge: 'priority-badge priority-attention', avatarBg: 'rgba(194,98,10,0.1)',   avatarColor: 'var(--attention)' },
  COLD:      { badge: 'priority-badge priority-cold',      avatarBg: 'rgba(79,92,244,0.1)',   avatarColor: 'var(--cold)'      },
  SPAM:      { badge: 'priority-badge priority-spam',      avatarBg: 'rgba(141,147,190,0.1)', avatarColor: 'var(--spam-text)' },
}

export default function ConversationList({ conversations }: { conversations: ConversationSummary[] }) {
  const router = useRouter()
  const pathname = usePathname()

  if (!conversations.length) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>No conversations</p>
      </div>
    )
  }

  return (
    <div>
      {conversations.map(c => {
        const p = P[c.priority] ?? P.SPAM
        // Selected state driven by the URL path — no prop needed
        const isSelected = pathname === `/inbox/${c.id}`

        return (
          <div
            key={c.id}
            className={`conv-item${isSelected ? ' selected' : ''}`}
            onClick={() => router.push(`/inbox/${c.id}`)}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`Conversation with ${c.contact.name}`}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && router.push(`/inbox/${c.id}`)}
          >
            <div
              className="avatar"
              style={{ background: p.avatarBg, color: p.avatarColor, width: 34, height: 34, fontSize: 11 }}
            >
              {initials(c.contact.name)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {c.contact.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{relativeTime(c.lastMessageAt)}</span>
                  <span className={p.badge}>{c.priority}</span>
                </div>
              </div>

              <p style={{ margin: '3px 0 0', color: 'var(--text-secondary)', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>
                {c.subject ? <><span style={{ color: 'var(--text-muted)' }}>{c.subject}</span> · </> : null}
                {c.lastMessage ?? '—'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                  {c.channel === 'GMAIL' ? '✉ Gmail' : '✈ Telegram'}
                </span>
                {c.unreadCount > 0 && (
                  <span style={{ background: 'var(--accent)', color: '#fff', width: 18, height: 18, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
