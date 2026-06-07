import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ConversationList, { type ConversationSummary } from '@/components/ConversationList'
import Link from 'next/link'

// Demo data shown when the user has no real conversations yet.
const DEMO: ConversationSummary[] = [
  { id: 'demo-1', channel: 'TELEGRAM', subject: null, priority: 'HOT',       priorityScore: 90, lastMessageAt: new Date(Date.now() - 2*60*1000).toISOString(),       contact: { name: 'Alex Peterson', email: null },           lastMessage: 'Sounds good, price works — when can we start?',         unreadCount: 3 },
  { id: 'demo-2', channel: 'GMAIL',    subject: 'Re: Your proposal',         priority: 'ATTENTION', priorityScore: 60, lastMessageAt: new Date(Date.now() - 3*60*60*1000).toISOString(), contact: { name: 'Karina Lee',    email: 'karina@example.com' }, lastMessage: 'Still thinking it over, need to check with my team...', unreadCount: 1 },
  { id: 'demo-3', channel: 'TELEGRAM', subject: null,                         priority: 'COLD',      priorityScore: 20, lastMessageAt: new Date(Date.now() - 24*60*60*1000).toISOString(), contact: { name: 'Mark Johnson',  email: null },                 lastMessage: "Thanks, I'll follow up later. Busy right now.",         unreadCount: 0 },
]

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  // Shares the cached result from DashboardLayout — no second Supabase round-trip.
  const user = await getCurrentUser()

  let conversations: ConversationSummary[] = DEMO
  let isDemo = true

  if (user) {
    const dbConvs = await prisma.conversation.findMany({
      where: { userId: user.id },
      include: {
        contact: { select: { name: true, email: true } },
        messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { content: true } },
      },
      orderBy: [{ priorityScore: 'desc' }, { lastMessageAt: 'desc' }],
      take: 50,
    })

    if (dbConvs.length > 0) {
      isDemo = false
      conversations = dbConvs.map(c => ({
        id: c.id,
        channel: c.channel as ConversationSummary['channel'],
        subject: c.subject,
        priority: c.priority as ConversationSummary['priority'],
        priorityScore: c.priorityScore,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        contact: { name: c.contact.name, email: c.contact.email },
        lastMessage: c.messages[0]?.content.slice(0, 120) ?? null,
        unreadCount: 0,
      }))
    }
  }

  return (
    <div className="inbox-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: '100%', flex: 1, overflow: 'hidden' }}>

      {/* Left panel: conversation list — rendered once, router-cached across navigations */}
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF' }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Inbox</h1>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isDemo ? 'demo' : conversations.length}</span>
          </div>
          {isDemo && user && (
            <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 9, background: 'var(--accent-dim)', border: '1px solid rgba(79,92,244,0.15)' }}>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                No conversations yet.{' '}
                <Link href="/integrations" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>
                  Connect Gmail →
                </Link>
              </p>
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ConversationList conversations={conversations} />
        </div>
      </div>

      {/* Right panel: injected child page (empty state or conversation detail) */}
      <div className="inbox-detail" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
        {children}
      </div>
    </div>
  )
}
