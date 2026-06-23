import { UserRound } from 'lucide-react'
import EmailFrame from '@/components/EmailFrame'
import { sanitizeMessageHtml, sanitizeEmailRich } from '@/lib/sanitize-email'
import { formatStamp, fullStamp } from '@/lib/format-time'

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]?.toUpperCase() ?? '').slice(0, 2).join('') || '?'
}

type Msg = {
  id: string
  direction: string
  content: string
  contentHtml: string | null
  sentAt: Date | string
}

/**
 * One email-style message card: a sender row (avatar · name · absolute time)
 * over the body. Plain-text and rich-HTML emails share the SAME card chrome —
 * the rich body renders in the sandboxed EmailFrame, flush inside the card.
 * Inbound = the contact (initials avatar); outbound = "You" (accent avatar +
 * an accent left edge). No per-member attribution is stored, so outbound is
 * always "You".
 */
export default function MessageCard({
  msg,
  contactName,
  now,
  cont,
}: {
  msg: Msg
  contactName: string
  now: Date
  cont: boolean
}) {
  const out = msg.direction === 'OUTBOUND'
  const rich = msg.contentHtml ? sanitizeEmailRich(msg.contentHtml) : null
  const isEmail = !!(rich && rich.html.length > 0)

  return (
    <article className={`msg-card ${out ? 'out' : 'in'}${cont ? ' cont' : ''}`}>
      <header className="msg-card-head">
        <span className={`msg-avatar ${out ? 'out' : 'in'}`} aria-hidden>
          {out ? <UserRound size={15} /> : initials(contactName)}
        </span>
        <span className="msg-sender">{out ? 'You' : contactName}</span>
        <time
          className="msg-time"
          dateTime={new Date(msg.sentAt).toISOString()}
          title={fullStamp(msg.sentAt)}
        >
          {formatStamp(msg.sentAt, now)}
        </time>
      </header>
      <div className={`msg-body${isEmail ? ' msg-body-email' : ''}`}>
        {isEmail ? (
          <EmailFrame html={rich!.html} hasImages={rich!.hasImages} />
        ) : (
          <div className="msg-html" dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(msg.content) }} />
        )}
      </div>
    </article>
  )
}
