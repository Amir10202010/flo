'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { avatarGradient, initialsOf } from '@/components/dashboard/avatar'
import EmptyNote from '@/components/dashboard/EmptyNote'
import { priorityMeta } from '@/lib/priority'

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
  /** Latest message is inbound — the client is waiting on you. */
  awaitingReply?: boolean
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return `${Math.floor(days / 7)}w`
}

export default function ConversationList({ conversations }: { conversations: ConversationSummary[] }) {
  const pathname = usePathname()

  if (!conversations.length) {
    return (
      <EmptyNote
        icon={<Inbox size={16} />}
        title="No conversations yet"
        hint="Threads from this mailbox appear here as they sync."
      />
    )
  }

  return (
    <div>
      {conversations.map(c => {
        const m = priorityMeta(c.priority)
        // Only elevated priorities earn a badge — keeping Normal/Low rows quiet
        // makes the urgent ones actually stand out.
        const showBadge = c.priority === 'HOT' || c.priority === 'ATTENTION'
        // Selected state driven by the URL path — no prop needed
        const isSelected = pathname === `/inbox/${c.id}`

        return (
          // <Link> so Next prefetches the conversation route (+ its loading.tsx)
          // on hover/viewport — clicks open near-instantly instead of cold.
          <Link
            key={c.id}
            href={`/inbox/${c.id}`}
            className={`conv-item${isSelected ? ' selected' : ''}`}
            aria-current={isSelected ? 'page' : undefined}
            aria-label={`Conversation with ${c.contact.name}`}
          >
            <div
              className="avatar"
              style={{ background: avatarGradient(c.contact.name), color: '#fff', width: 36, height: 36, fontSize: 11.5 }}
            >
              {initialsOf(c.contact.name)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {c.contact.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{relativeTime(c.lastMessageAt)}</span>
              </div>

              {c.subject && (
                <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.45 }}>
                  {c.subject}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <p style={{ flex: 1, margin: 0, color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5 }}>
                  {c.lastMessage ?? 'No preview'}
                </p>
                {showBadge && (
                  <span className={`priority-badge ${m.className}`} title={m.description} style={{ flexShrink: 0 }}>
                    <span className="priority-dot" aria-hidden />
                    {m.label}
                  </span>
                )}
                {c.unreadCount > 0 && (
                  <span style={{ background: 'var(--accent)', color: '#fff', minWidth: 18, height: 18, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, padding: '0 5px', flexShrink: 0 }}>
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
