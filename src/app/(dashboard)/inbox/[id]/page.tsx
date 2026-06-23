import { Fragment } from 'react'
import { notFound } from 'next/navigation'
import { requireOrgPage } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import MessageCard from '@/components/inbox/MessageCard'
import ThreadLayout from '@/components/inbox/ThreadLayout'
import ThreadContextRail from '@/components/inbox/ThreadContextRail'
import Composer from '@/components/Composer'
import { getReadyDraft } from '@/services/draft.service'
import { dayLabel } from '@/lib/format-time'
import type { EmailCategory } from '@/types'

function initials(name: string): string {
  return name.split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('') || '?'
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

  const ctx = await requireOrgPage()

  // findFirst (not findUnique) so we can scope by org + active integration —
  // prevents reading another org's conversation, and hides chats from
  // disconnected channels.
  const conv = await prisma.conversation.findFirst({
    where: { id, organizationId: ctx.organization.id, integration: { isActive: true } },
    include: {
      contact: true,
      messages: { orderBy: { sentAt: 'asc' } },
      analysis: true,
    },
  })

  if (!conv) notFound()

  const analysis = conv.analysis
  // 'local' = heuristic fallback ran instead of the full AI model — label it.
  const analyzedBy = ((analysis?.analysisData as { provider?: string } | null)?.provider) ?? 'gemini'
  const channelName = conv.channel === 'GMAIL' ? 'Gmail' : 'Telegram'
  const now = new Date()

  // Pending auto-draft to pre-fill, and the one-click "?draft=1" intent.
  const readyDraft = await getReadyDraft(ctx.organization.id, conv.id)
  const wantsAutoDraft = draftParam === '1'

  // Pre-compute grouping: day separators + "continuation" rows (same sender,
  // <10 min apart) that render tighter against the previous card.
  const rows = conv.messages.map((msg, i) => {
    const prev = conv.messages[i - 1]
    const sentAt = new Date(msg.sentAt)
    const newDay = !prev || new Date(prev.sentAt).toDateString() !== sentAt.toDateString()
    const cont =
      !newDay &&
      prev !== undefined &&
      prev.direction === msg.direction &&
      sentAt.getTime() - new Date(prev.sentAt).getTime() < 10 * 60_000
    return { msg, sentAt, newDay, cont }
  })

  // Slim identity — avatar · name · channel · email · subject. No priority badge,
  // no AI banner: AI + assignment + tags + notes all live in the context rail.
  const header = (
    <div className="chat-id">
      <div className="chat-avatar">{initials(conv.contact.name)}</div>
      <div className="chat-id-text">
        <h2 className="chat-name">{conv.contact.name}</h2>
        <div className="chat-sub">
          <span className="chat-chip">{channelName}</span>
          {conv.contact.email && <span className="chat-email">{conv.contact.email}</span>}
          {conv.subject && <span className="chat-subject">{conv.subject}</span>}
        </div>
      </div>
    </div>
  )

  const messages =
    rows.length === 0 ? (
      <div className="inbox-empty" style={{ padding: '60px 24px' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No messages yet</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          New messages in this thread will appear here after the next sync.
        </p>
      </div>
    ) : (
      rows.map(({ msg, sentAt, newDay, cont }) => (
        <Fragment key={msg.id}>
          {newDay && (
            <div className="chat-day-sep">
              <span>{dayLabel(sentAt, now)}</span>
            </div>
          )}
          <MessageCard msg={msg} contactName={conv.contact.name} now={now} cont={cont} />
        </Fragment>
      ))
    )

  // Reply composer — Gmail only for now.
  const composer =
    conv.channel === 'GMAIL' && conv.contact.email ? (
      <Composer
        conversationId={conv.id}
        initialDraft={readyDraft}
        autoDraft={wantsAutoDraft && !readyDraft}
      />
    ) : null

  const rail = (
    <ThreadContextRail
      conversationId={conv.id}
      initialAssigneeId={conv.assigneeId}
      initialState={conv.state as 'OPEN' | 'SNOOZED' | 'CLOSED'}
      category={conv.category as EmailCategory}
      analysis={
        analysis
          ? {
              summary: analysis.summary,
              riskLevel: analysis.riskLevel,
              nextAction: analysis.nextAction,
              provider: analyzedBy,
            }
          : null
      }
    />
  )

  return <ThreadLayout header={header} messages={messages} composer={composer} rail={rail} />
}
