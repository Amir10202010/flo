import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ArrowUpRight, CalendarDays, Check, Mail, Video } from 'lucide-react'
import { requireOrgPage } from '@/lib/org'
import { getMeetingDetail, type AttendeeContext } from '@/services/meeting.service'
import { Reveal } from '@/components/dashboard/Motion'
import LocalTime from '@/components/meetings/LocalTime'
import MeetingBriefCard from '@/components/meetings/MeetingBriefCard'
import MeetingCapture from '@/components/meetings/MeetingCapture'
import ActionItems from '@/components/meetings/ActionItems'
import EntityChip from '@/components/knowledge/EntityChip'

export const metadata: Metadata = { title: 'Meeting — Velnox' }

const PROVIDER_LABEL: Record<string, string> = { GOOGLE_MEET: 'Google Meet', ZOOM: 'Zoom', OTHER: '' }

function AttendeeCard({ a }: { a: AttendeeContext }) {
  const initials = a.name
    .split(/[\s.]+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  return (
    <div className="mt-attendee">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="mt-avatar mt-avatar-lg" data-known={Boolean(a.contactId)}>{initials}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.name}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.company ? `${a.company} · ${a.email}` : a.email}
          </div>
        </div>
        {a.awaitingReply && (
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)', flexShrink: 0 }}>
            awaiting reply
          </span>
        )}
      </div>
      {a.relationshipSummary && (
        <p style={{ margin: '9px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {a.relationshipSummary}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 9, fontSize: 11.5, color: 'var(--text-muted)' }}>
        {a.threadCount > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Mail size={11} />
            {a.threadCount} thread{a.threadCount === 1 ? '' : 's'}
          </span>
        ) : (
          <span>first contact</span>
        )}
        {a.lastThread && (
          <Link href={`/inbox/${a.lastThread.id}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {a.lastThread.subject}
            </span>
            <ArrowUpRight size={11} style={{ flexShrink: 0 }} />
          </Link>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="kn-strip-label" style={{ marginBottom: 8 }}>{children}</div>
}

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgPage()
  const { id } = await params
  const meeting = await getMeetingDetail(ctx.userId, id)
  if (!meeting) notFound()

  const provider = PROVIDER_LABEL[meeting.provider]
  const debrief = meeting.debrief

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 880, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <Link href="/meetings" className="kn-back" style={{ marginBottom: 14, display: 'inline-flex' }}>
          <ArrowLeft size={13} />
          Meetings
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 className="page-title" style={{ margin: 0 }}>{meeting.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <CalendarDays size={13} />
                <LocalTime iso={meeting.startsAtIso} endIso={meeting.endsAtIso} />
              </span>
              {provider && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Video size={13} />
                  {provider}
                </span>
              )}
            </div>
          </div>
          {meeting.isUpcoming && meeting.joinUrl && (
            <a href={meeting.joinUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ flexShrink: 0 }}>
              Join meeting
            </a>
          )}
        </div>
      </Reveal>

      {/* ── Before: the AI brief. After: capture → debrief. ── */}
      <Reveal delay={0.06}>
        {meeting.isUpcoming ? (
          <MeetingBriefCard meetingId={meeting.id} initial={meeting.brief} />
        ) : debrief ? (
          <div className="widget" style={{ padding: '18px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>What happened</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI summary of your transcript</span>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-primary)' }}>{debrief.summary}</p>

            {debrief.decisions.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <SectionLabel>Decisions</SectionLabel>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {debrief.decisions.map((d) => (
                    <li key={d} className="mt-fact-row">
                      <Check size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-primary)' }}>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {debrief.actionItems.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <SectionLabel>Action items</SectionLabel>
                <ActionItems items={debrief.actionItems} />
              </div>
            )}

            {debrief.risks.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <SectionLabel>Risks raised</SectionLabel>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {debrief.risks.map((r) => (
                    <li key={r} className="mt-fact-row">
                      <AlertTriangle size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-primary)' }}>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {debrief.followUps.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <SectionLabel>Suggested follow-ups</SectionLabel>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {debrief.followUps.map((f) => (
                    <li key={f} style={{ display: 'flex', gap: 9, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', marginTop: 7, flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {meeting.linked.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <SectionLabel>Added to your knowledge</SectionLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {meeting.linked.map((c) => (
                    <EntityChip key={c.ref} nodeRef={c.ref} type={c.type} label={c.label} />
                  ))}
                </div>
              </div>
            )}

            {meeting.transcript && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Transcript
                </summary>
                <pre className="mt-transcript">{meeting.transcript}</pre>
                <MeetingCapture meetingId={meeting.id} hasTranscript pendingDebrief={false} recapture />
              </details>
            )}
          </div>
        ) : (
          <MeetingCapture meetingId={meeting.id} hasTranscript={Boolean(meeting.transcript)} pendingDebrief={meeting.pendingDebrief} />
        )}
      </Reveal>

      {/* ── Who you're meeting / met ── */}
      {meeting.attendees.length > 0 && (
        <Reveal delay={0.1}>
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>{meeting.isUpcoming ? 'Who you’re meeting' : 'Who was there'}</SectionLabel>
            <div className="mt-attendee-grid">
              {meeting.attendees.map((a) => (
                <AttendeeCard key={a.email} a={a} />
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* ── Context: threads, open follow-ups, previous meetings ── */}
      {(meeting.recentThreads.length > 0 || meeting.openReminders.length > 0 || meeting.previousMeetings.length > 0) && (
        <Reveal delay={0.14}>
          <div className="mt-context-grid">
            {meeting.recentThreads.length > 0 && (
              <div>
                <SectionLabel>Recent conversations</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {meeting.recentThreads.map((t) => (
                    <Link key={t.id} href={t.href} className="graph-conv-link">
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.subject}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {t.contactName}{t.agoLabel ? ` · ${t.agoLabel}` : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {meeting.openReminders.length > 0 && (
                <div>
                  <SectionLabel>Open follow-ups</SectionLabel>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {meeting.openReminders.map((r) => (
                      <li key={r.id} style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>{r.note}</li>
                    ))}
                  </ul>
                </div>
              )}
              {meeting.previousMeetings.length > 0 && (
                <div>
                  <SectionLabel>Previous meetings</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {meeting.previousMeetings.map((m) => (
                      <Link key={m.id} href={`/meetings/${m.id}`} className="graph-conv-link">
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.title}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 5 }}>
                          <LocalTime iso={m.startsAtIso} mode="date" />
                          {m.summary ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {m.summary}</span> : null}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      )}
    </div>
  )
}
