'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Inbox, Sparkles } from 'lucide-react'
import { avatarGradient, initialsOf } from '@/components/dashboard/avatar'
import EmptyNote from '@/components/dashboard/EmptyNote'
import { priorityMeta } from '@/lib/priority'
import { CATEGORY_META } from '@/lib/categories'
import type { EmailCategory } from '@/types'

export type ConversationSummary = {
  id: string
  channel: 'GMAIL' | 'TELEGRAM'
  subject: string | null
  priority: 'HOT' | 'ATTENTION' | 'COLD' | 'SPAM'
  priorityScore: number
  category: EmailCategory
  lastMessageAt: string | null
  /**
   * Pre-formatted "5m" / "3h" / "2d" label. Computed by the producer (server
   * component or search mapper) — never derived here from Date.now(), or
   * SSR/CSR clock skew breaks hydration and kills inbox interactivity.
   */
  timeLabel: string
  contact: { name: string; email: string | null }
  lastMessage: string | null
  unreadCount: number
  /** Latest message is inbound — the client is waiting on you. */
  awaitingReply?: boolean
  /** A READY AI auto-draft is waiting for this conversation. */
  hasDraft?: boolean
  /** AI's suggested next step — tooltip for the one-click reply action. */
  nextAction?: string | null
}

export default function ConversationList({ conversations }: { conversations: ConversationSummary[] }) {
  const pathname = usePathname()
  const router = useRouter()

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
        // Category tag — shown for everything except the catch-all Primary bucket
        // so the row visibly reflects where it was sorted.
        const cat = c.category && c.category !== 'PRIMARY' ? CATEGORY_META[c.category] : null
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
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{c.timeLabel}</span>
              </div>

              {c.subject && (
                <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.45 }}>
                  {c.subject}
                </p>
              )}

              {cat && (
                <span className="cat-tag" style={{ marginTop: 4, color: cat.color, background: `${cat.color}14` }}>
                  <span className="cat-tag-dot" style={{ background: cat.color }} />
                  {cat.label}
                </span>
              )}

              {c.hasDraft && (
                <span
                  className="cat-tag"
                  title="An AI reply draft is ready — open to review and send"
                  style={{ marginTop: 4, marginLeft: cat ? 6 : 0, color: 'var(--accent)', background: 'var(--accent-dim)' }}
                >
                  <Sparkles size={10} />
                  Draft ready
                </span>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <p style={{ flex: 1, margin: 0, color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5 }}>
                  {c.lastMessage ?? 'No preview'}
                </p>
                {c.awaitingReply && !c.hasDraft && (
                  <button
                    type="button"
                    className="conv-quick-reply"
                    title={c.nextAction ?? 'Draft a reply with AI'}
                    aria-label="Draft a reply with AI"
                    onClick={(e) => {
                      // Row is itself a <Link> — don't let the click bubble to it.
                      e.preventDefault()
                      e.stopPropagation()
                      router.push(`/inbox/${c.id}?draft=1`)
                    }}
                  >
                    <Sparkles size={11} /> Reply
                  </button>
                )}
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
