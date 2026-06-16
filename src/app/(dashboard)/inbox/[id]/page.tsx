import { Fragment } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeMessageHtml } from '@/lib/html'
import PriorityBadge from '@/components/ui/PriorityBadge'
import Composer from '@/components/Composer'
import CategoryMover from '@/components/CategoryMover'
import { getReadyDraft } from '@/services/draft.service'
import type { EmailCategory, PriorityLevel } from '@/types'

const RISK: Record<string, { label: string; color: string; bg: string; border: string }> = {
  LOW:      { label: 'Low risk',    color: 'var(--cold)',      bg: 'var(--cold-dim)',      border: 'var(--cold-border)'      },
  MEDIUM:   { label: 'Medium risk', color: 'var(--attention)', bg: 'var(--attention-dim)', border: 'var(--attention-border)' },
  HIGH:     { label: 'High risk',   color: 'var(--hot)',       bg: 'var(--hot-dim)',        border: 'var(--hot-border)'       },
  CRITICAL: { label: 'Critical',    color: 'var(--hot)',       bg: 'var(--hot-dim)',        border: 'var(--hot-border)'       },
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('') || '?'
}

function formatTime(d: Date | string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/** Day label for the separator: Today / Yesterday / "Mar 4" / "Mar 4, 2025". */
function dayLabel(d: Date, now: Date): string {
  const day = (x: Date) => Math.floor((x.getTime() - x.getTimezoneOffset() * 60000) / 86_400_000)
  const diff = day(now) - day(d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
  return d.toLocaleDateString('en-US', opts)
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ draft?: string }>
}) {
  const { id } = await params
  const { draft: draftParam } = await searchParams

  const user = await getCurrentUser()
  if (!user) notFound()

  // findFirst (not findUnique) so we can scope by owner + active integration —
  // prevents reading another user's conversation, and hides chats from
  // disconnected channels.
  const conv = await prisma.conversation.findFirst({
    where: { id, userId: user.id, integration: { isActive: true } },
    include: {
      contact: true,
      messages: { orderBy: { sentAt: 'asc' } },
      analysis: true,
    },
  })

  if (!conv) notFound()

  const analysis = conv.analysis
  const r = analysis ? (RISK[analysis.riskLevel] ?? RISK.LOW) : null
  // 'local' = heuristic fallback ran instead of the full AI model — label it.
  const analyzedBy = ((analysis?.analysisData as { provider?: string } | null)?.provider) ?? 'gemini'
  const channelName = conv.channel === 'GMAIL' ? 'Gmail' : 'Telegram'
  const now = new Date()

  // Pending auto-draft to pre-fill, and the one-click "?draft=1" intent.
  const readyDraft = await getReadyDraft(user.id, conv.id)
  const wantsAutoDraft = draftParam === '1'

  // Pre-compute grouping: day separators + "continuation" rows (same sender,
  // <10 min apart) that render tighter and without a repeated timestamp.
  const rows = conv.messages.map((msg, i) => {
    const prev = conv.messages[i - 1]
    const next = conv.messages[i + 1]
    const sentAt = new Date(msg.sentAt)
    const newDay = !prev || new Date(prev.sentAt).toDateString() !== sentAt.toDateString()
    const cont =
      !newDay &&
      prev !== undefined &&
      prev.direction === msg.direction &&
      sentAt.getTime() - new Date(prev.sentAt).getTime() < 10 * 60_000
    const groupEnd =
      !next ||
      next.direction !== msg.direction ||
      new Date(next.sentAt).getTime() - sentAt.getTime() >= 10 * 60_000 ||
      new Date(next.sentAt).toDateString() !== sentAt.toDateString()
    return { msg, sentAt, newDay, cont, groupEnd }
  })

  return (
    <div className="chat">
      {/* Header */}
      <div className="chat-header">
        <Link href="/inbox" className="thread-back">
          <ArrowLeft size={15} /> Inbox
        </Link>

        <div className="chat-head-row">
          <div className="chat-avatar">{initials(conv.contact.name)}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="chat-name">{conv.contact.name}</h2>
            <div className="chat-sub">
              <span className="chat-chip">{channelName}</span>
              {conv.contact.email && <span className="chat-email">{conv.contact.email}</span>}
            </div>
            {conv.subject && <p className="chat-subject">{conv.subject}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <CategoryMover conversationId={conv.id} current={conv.category as EmailCategory} />
            <PriorityBadge level={conv.priority as PriorityLevel} />
          </div>
        </div>

        {analysis && r && (
          <div className="chat-ai" style={{ background: r.bg, borderColor: r.border }}>
            <div className="chat-ai-head">
              <Sparkles size={13} style={{ color: r.color }} />
              <span style={{ color: r.color }}>
                {analyzedBy === 'local' ? 'Quick scan' : 'AI insight'} · {r.label}
              </span>
              {analyzedBy === 'local' && (
                <span
                  title="Generated by the offline heuristic — full AI analysis will replace it on the next run"
                  style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 6 }}
                >
                  offline mode
                </span>
              )}
            </div>
            <p className="chat-ai-summary">{analysis.summary}</p>
            {analysis.nextAction && (
              <p className="chat-ai-action">→ {analysis.nextAction}</p>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="chat-messages thread-messages">
        {rows.length === 0 ? (
          <div className="inbox-empty" style={{ padding: '60px 24px' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No messages yet</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              New messages in this thread will appear here after the next sync.
            </p>
          </div>
        ) : (
          rows.map(({ msg, sentAt, newDay, cont, groupEnd }) => {
            const out = msg.direction === 'OUTBOUND'
            return (
              <Fragment key={msg.id}>
                {newDay && (
                  <div className="chat-day-sep">
                    <span>{dayLabel(sentAt, now)}</span>
                  </div>
                )}
                <div className={`chat-row ${out ? 'out' : 'in'}${cont ? ' cont' : ''}`}>
                  <div
                    className={`msg-bubble msg-html ${out ? 'msg-bubble-out' : 'msg-bubble-in'}`}
                    dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(msg.content) }}
                  />
                  {groupEnd && <span className="chat-time">{formatTime(msg.sentAt)}</span>}
                </div>
              </Fragment>
            )
          })
        )}
      </div>

      {/* Reply composer — Gmail only for now */}
      {conv.channel === 'GMAIL' && conv.contact.email && (
        <Composer
          conversationId={conv.id}
          initialDraft={readyDraft}
          autoDraft={wantsAutoDraft && !readyDraft}
        />
      )}
    </div>
  )
}
