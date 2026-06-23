import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { messagePreview } from '@/lib/html'
import { compactAgo } from '@/lib/time'
import InboxList, { type InboxGroup } from '@/components/InboxList'
import type { ConversationSummary } from '@/components/ConversationList'

function channelLabel(type: string, email?: string | null): string {
  const name = type === 'GMAIL' ? 'Gmail' : type === 'TELEGRAM' ? 'Telegram' : type
  return email ? `${name} · ${email}` : name
}

/**
 * Async server component that loads + groups the organization's shared
 * conversations by the owning (active) inbox integration. Disconnected
 * integrations are excluded, so their chats disappear from the inbox. Rendered
 * inside a <Suspense> boundary (see inbox/layout.tsx) so the shell paints
 * instantly and this streams in.
 */
export default async function InboxListContent() {
  const ctx = await getOrgContext()

  let groups: InboxGroup[] = []
  let total = 0
  let hasConnection = false

  if (ctx) {
    const activeIntegration = await prisma.integration.findFirst({
      where: { organizationId: ctx.organization.id, isActive: true },
      select: { id: true },
    })
    hasConnection = Boolean(activeIntegration)

    // Only conversations whose integration is still active — disconnecting hides them.
    const dbConvs = await prisma.conversation.findMany({
      where: { organizationId: ctx.organization.id, integration: { isActive: true } },
      include: {
        contact: { select: { name: true, email: true } },
        integration: { select: { id: true, type: true, metadata: true } },
        messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { content: true, direction: true } },
        draft: { select: { status: true } },
        analysis: { select: { nextAction: true } },
        assignee: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: [{ priorityScore: 'desc' }, { lastMessageAt: 'desc' }],
      take: 100,
    })

    total = dbConvs.length

    const byIntegration = new Map<string, InboxGroup>()
    for (const c of dbConvs) {
      const integ = c.integration
      const meta = (integ.metadata as { email?: string } | null) ?? {}
      if (!byIntegration.has(integ.id)) {
        byIntegration.set(integ.id, {
          id: integ.id,
          channel: integ.type as InboxGroup['channel'],
          label: channelLabel(integ.type, meta.email),
          conversations: [],
        })
      }
      const summary: ConversationSummary = {
        id: c.id,
        channel: c.channel as ConversationSummary['channel'],
        subject: c.subject,
        priority: c.priority as ConversationSummary['priority'],
        priorityScore: c.priorityScore,
        category: c.category as ConversationSummary['category'],
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        timeLabel: compactAgo(c.lastMessageAt),
        contact: { name: c.contact.name, email: c.contact.email },
        lastMessage: c.messages[0] ? messagePreview(c.messages[0].content) : null,
        unreadCount: 0,
        awaitingReply: c.messages[0]?.direction === 'INBOUND',
        hasDraft: c.draft?.status === 'READY',
        nextAction: c.analysis?.nextAction ?? null,
        assigneeName: c.assignee ? c.assignee.user.name ?? c.assignee.user.email : null,
      }
      byIntegration.get(integ.id)!.conversations.push(summary)
    }
    groups = Array.from(byIntegration.values())
  }

  return <InboxList groups={groups} total={total} hasConnection={hasConnection} />
}

/** Lightweight skeleton shown while InboxListContent streams in. */
export function InboxListSkeleton() {
  return (
    <>
      <div className="inbox-list-header" style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Inbox</h1>
        </div>
        <div className="skeleton" style={{ height: 38, borderRadius: 10 }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="conv-item" style={{ pointerEvents: 'none' }}>
            <div className="skeleton" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div className="skeleton" style={{ height: 11, width: '45%', borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 10, width: '80%', borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
