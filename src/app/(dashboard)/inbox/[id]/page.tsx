import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const RISK: Record<string, { label: string; color: string; bg: string; border: string }> = {
  LOW:      { label: 'Low risk',    color: 'var(--cold)',      bg: 'var(--cold-dim)',      border: 'var(--cold-border)'      },
  MEDIUM:   { label: 'Medium risk', color: 'var(--attention)', bg: 'var(--attention-dim)', border: 'var(--attention-border)' },
  HIGH:     { label: 'High risk',   color: 'var(--hot)',       bg: 'var(--hot-dim)',        border: 'var(--hot-border)'       },
  CRITICAL: { label: 'Critical',    color: 'var(--hot)',       bg: 'var(--hot-dim)',        border: 'var(--hot-border)'       },
}

function formatTime(d: Date | string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Demo conversations: show a friendly placeholder
  if (id.startsWith('demo-')) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40, textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFFFFF', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: 'var(--shadow-xs)' }}>
          💬
        </div>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Demo conversation</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 260 }}>
            Connect Gmail to see real conversations with messages and AI analysis.
          </p>
        </div>
      </div>
    )
  }

  // Re-uses the cached result from DashboardLayout + InboxLayout — no third round-trip.
  const user = await getCurrentUser()
  if (!user) notFound()

  const conv = await prisma.conversation.findUnique({
    where: { id, userId: user.id },
    include: {
      contact: true,
      messages: { orderBy: { sentAt: 'asc' } },
      analysis: true,
    },
  })

  if (!conv) notFound()

  const analysis = conv.analysis
  const r = analysis ? (RISK[analysis.riskLevel] ?? RISK.LOW) : null

  return (
    <>
      {/* Thread header */}
      <div className="thread-header" style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: '#FFFFFF' }}>
        <Link
          href="/inbox"
          className="thread-back"
          style={{ display: 'none', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', textDecoration: 'none' }}
        >
          <ArrowLeft size={15} />
          Inbox
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: analysis ? 14 : 0 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {conv.contact.name}
            </h2>
            {conv.subject && (
              <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.subject}</p>
            )}
            {conv.contact.email && (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.contact.email}</p>
            )}
          </div>
          <span
            className={`priority-badge priority-${conv.priority.toLowerCase()}`}
            style={{ flexShrink: 0, marginTop: 2 }}
          >
            {conv.priority}
          </span>
        </div>

        {analysis && r && (
          <div style={{ padding: '11px 14px', borderRadius: 10, background: r.bg, border: `1px solid ${r.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: r.color, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                AI · {r.label}
              </span>
            </div>
            <p style={{ margin: '0 0 5px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {analysis.summary}
            </p>
            {analysis.nextAction && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
                → {analysis.nextAction}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="thread-messages" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {conv.messages.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            No messages yet.
          </p>
        ) : (
          conv.messages.map(msg => (
            <div
              key={msg.id}
              style={{ display: 'flex', flexDirection: 'column', alignItems: msg.direction === 'OUTBOUND' ? 'flex-end' : 'flex-start' }}
            >
              <div className={`msg-bubble ${msg.direction === 'OUTBOUND' ? 'msg-bubble-out' : 'msg-bubble-in'}`}>
                {msg.content}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {formatTime(msg.sentAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  )
}
