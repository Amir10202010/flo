import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeMessageHtml } from '@/lib/html'
import Composer from '@/components/Composer'

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

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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
  const channelName = conv.channel === 'GMAIL' ? 'Gmail' : 'Telegram'

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
          <span className={`priority-badge priority-${conv.priority.toLowerCase()}`} style={{ flexShrink: 0 }}>
            {conv.priority}
          </span>
        </div>

        {analysis && r && (
          <div className="chat-ai" style={{ background: r.bg, borderColor: r.border }}>
            <div className="chat-ai-head">
              <Sparkles size={13} style={{ color: r.color }} />
              <span style={{ color: r.color }}>AI insight · {r.label}</span>
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
        {conv.messages.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            No messages yet.
          </p>
        ) : (
          conv.messages.map(msg => {
            const out = msg.direction === 'OUTBOUND'
            return (
              <div key={msg.id} className={`chat-row ${out ? 'out' : 'in'}`}>
                <div
                  className={`msg-bubble msg-html ${out ? 'msg-bubble-out' : 'msg-bubble-in'}`}
                  dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(msg.content) }}
                />
                <span className="chat-time">{formatTime(msg.sentAt)}</span>
              </div>
            )
          })
        )}
      </div>

      {/* Reply composer — Gmail only for now */}
      {conv.channel === 'GMAIL' && conv.contact.email && (
        <Composer conversationId={conv.id} />
      )}
    </div>
  )
}
