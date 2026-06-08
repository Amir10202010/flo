import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ConversationList, { type ConversationSummary } from '@/components/ConversationList'
import InboxShell from '@/components/InboxShell'
import { ensurePlainText } from '@/lib/html'
import { Mail } from 'lucide-react'
import Link from 'next/link'

type Group = {
  id: string
  channel: 'GMAIL' | 'TELEGRAM'
  label: string
  conversations: ConversationSummary[]
}

// Demo data shown when the user has no real conversations yet.
const DEMO: ConversationSummary[] = [
  { id: 'demo-1', channel: 'TELEGRAM', subject: null, priority: 'HOT',       priorityScore: 90, lastMessageAt: new Date(Date.now() - 2*60*1000).toISOString(),       contact: { name: 'Alex Peterson', email: null },           lastMessage: 'Sounds good, price works — when can we start?',         unreadCount: 3 },
  { id: 'demo-2', channel: 'GMAIL',    subject: 'Re: Your proposal',         priority: 'ATTENTION', priorityScore: 60, lastMessageAt: new Date(Date.now() - 3*60*60*1000).toISOString(), contact: { name: 'Karina Lee',    email: 'karina@example.com' }, lastMessage: 'Still thinking it over, need to check with my team...', unreadCount: 1 },
  { id: 'demo-3', channel: 'TELEGRAM', subject: null,                         priority: 'COLD',      priorityScore: 20, lastMessageAt: new Date(Date.now() - 24*60*60*1000).toISOString(), contact: { name: 'Mark Johnson',  email: null },                 lastMessage: "Thanks, I'll follow up later. Busy right now.",         unreadCount: 0 },
]

function channelLabel(type: string, email?: string | null): string {
  const name = type === 'GMAIL' ? 'Gmail' : type === 'TELEGRAM' ? 'Telegram' : type
  return email ? `${name} — ${email}` : name
}

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  // Shares the cached result from DashboardLayout — no second Supabase round-trip.
  const user = await getCurrentUser()

  let groups: Group[] = [{ id: 'demo', channel: 'GMAIL', label: 'Demo inbox', conversations: DEMO }]
  let isDemo = true
  let total = DEMO.length

  if (user) {
    const dbConvs = await prisma.conversation.findMany({
      where: { userId: user.id },
      include: {
        contact: { select: { name: true, email: true } },
        integration: { select: { id: true, type: true, metadata: true } },
        messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { content: true } },
      },
      orderBy: [{ priorityScore: 'desc' }, { lastMessageAt: 'desc' }],
      take: 100,
    })

    if (dbConvs.length > 0) {
      isDemo = false
      total = dbConvs.length

      // Group conversations by their owning integration (mailbox/account).
      const byIntegration = new Map<string, Group>()
      for (const c of dbConvs) {
        const integ = c.integration
        const meta = (integ.metadata as { email?: string } | null) ?? {}
        if (!byIntegration.has(integ.id)) {
          byIntegration.set(integ.id, {
            id: integ.id,
            channel: integ.type as Group['channel'],
            label: channelLabel(integ.type, meta.email),
            conversations: [],
          })
        }
        byIntegration.get(integ.id)!.conversations.push({
          id: c.id,
          channel: c.channel as ConversationSummary['channel'],
          subject: c.subject,
          priority: c.priority as ConversationSummary['priority'],
          priorityScore: c.priorityScore,
          lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
          contact: { name: c.contact.name, email: c.contact.email },
          lastMessage: c.messages[0] ? ensurePlainText(c.messages[0].content).slice(0, 120) : null,
          unreadCount: 0,
        })
      }
      groups = Array.from(byIntegration.values())
    }
  }

  const list = (
    <>
      <div className="inbox-list-header" style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Inbox</h1>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isDemo ? 'demo' : total}</span>
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
        {groups.map((g) => (
          <div key={g.id}>
            {/* Account / mailbox header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '10px 16px 8px',
                position: 'sticky',
                top: 0,
                background: 'var(--bg-subtle)',
                borderBottom: '1px solid var(--border-light)',
                zIndex: 1,
              }}
            >
              <Mail size={13} style={{ color: g.channel === 'GMAIL' ? '#EA4335' : 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {g.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                {g.conversations.length}
              </span>
            </div>
            <ConversationList conversations={g.conversations} />
          </div>
        ))}
      </div>
    </>
  )

  // InboxShell (client) reads the route to decide which pane to show on mobile —
  // the list, or the conversation thread (children), with a back button to return.
  return <InboxShell list={list} detail={children} />
}
