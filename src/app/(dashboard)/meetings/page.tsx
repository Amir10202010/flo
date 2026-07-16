import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, FileText, Sparkles, Video } from 'lucide-react'
import { requireOrgPage } from '@/lib/org'
import { getMeetingsPage, type MeetingListItem } from '@/services/meeting.service'
import { Reveal } from '@/components/dashboard/Motion'
import ModulePill from '@/components/dashboard/ModulePill'
import LocalTime from '@/components/meetings/LocalTime'
import { LogMeetingButton, RefreshMeetingsButton } from '@/components/meetings/MeetingActions'

export const metadata: Metadata = { title: 'Meetings — Velnox' }

const PROVIDER_LABEL: Record<string, string> = {
  GOOGLE_MEET: 'Meet',
  ZOOM: 'Zoom',
  OTHER: '',
}

function AttendeeStack({ meeting }: { meeting: MeetingListItem }) {
  const shown = meeting.attendees.slice(0, 4)
  const extra = meeting.attendees.length - shown.length
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
      {shown.map((a, i) => {
        const label = a.name || a.email.split('@')[0]
        const initials = label
          .split(/[\s.]+/)
          .map((p) => p[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
        return (
          <span
            key={a.email}
            title={`${label}${a.contactId ? ' · in your contacts' : ''}`}
            className="mt-avatar"
            data-known={Boolean(a.contactId)}
            style={{ marginLeft: i === 0 ? 0 : -6 }}
          >
            {initials}
          </span>
        )
      })}
      {extra > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 5 }}>+{extra}</span>}
    </span>
  )
}

function MeetingRow({ meeting, past }: { meeting: MeetingListItem; past: boolean }) {
  const provider = PROVIDER_LABEL[meeting.provider]
  return (
    <Link href={`/meetings/${meeting.id}`} className="mt-row">
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meeting.title}
          </span>
          {provider && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
              <Video size={11} />
              {provider}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
          <LocalTime iso={meeting.startsAtIso} endIso={meeting.endsAtIso} />
        </div>
      </div>
      <AttendeeStack meeting={meeting} />
      <span className="mt-row-cta">
        {past ? (
          meeting.hasDebrief ? (
            <>
              <FileText size={12} />
              Debrief
            </>
          ) : (
            <>
              <Sparkles size={12} />
              Capture
            </>
          )
        ) : (
          <>
            <Sparkles size={12} />
            Brief
          </>
        )}
        <ArrowUpRight size={12} />
      </span>
    </Link>
  )
}

export default async function MeetingsPage() {
  const ctx = await requireOrgPage()
  const data = await getMeetingsPage(ctx.userId)

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 880, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <h1 className="page-title" style={{ margin: 0 }}>Meetings</h1>
              <ModulePill status="beta" />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Walk in prepared, walk out with everything remembered.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {data.calendarConnected && <RefreshMeetingsButton />}
            <LogMeetingButton />
          </div>
        </div>
      </Reveal>

      {!data.calendarConnected && (
        <Reveal delay={0.05}>
          <div className="widget" style={{ padding: '20px 22px', marginBottom: 24, display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-elevated)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
              <CalendarDays size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {data.hasIntegration ? 'Turn on calendar detection' : 'Connect your Gmail first'}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 520 }}>
                {data.hasIntegration
                  ? 'Meetings on your Google Calendar appear here automatically, with attendees matched to your contacts and an AI brief before each one. Reconnecting adds read-only calendar access to your existing Google connection.'
                  : 'Meeting intelligence works through your Google connection. Connect Gmail in Settings and meetings follow.'}
              </p>
            </div>
            <a href={data.hasIntegration ? '/api/auth/gmail' : '/settings?tab=connections'} className="btn-primary" style={{ flexShrink: 0 }}>
              {data.hasIntegration ? 'Enable meetings' : 'Open Settings'}
            </a>
          </div>
        </Reveal>
      )}

      {data.upcoming.length > 0 && (
        <Reveal delay={0.08}>
          <div style={{ marginBottom: 28 }}>
            <div className="kn-strip-label" style={{ marginBottom: 8 }}>Upcoming</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.upcoming.map((m) => (
                <MeetingRow key={m.id} meeting={m} past={false} />
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {data.past.length > 0 && (
        <Reveal delay={0.12}>
          <div>
            <div className="kn-strip-label" style={{ marginBottom: 8 }}>Past</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.past.map((m) => (
                <MeetingRow key={m.id} meeting={m} past />
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {data.calendarConnected && data.upcoming.length === 0 && data.past.length === 0 && (
        <Reveal delay={0.08}>
          <div className="widget" style={{ padding: '52px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--bg-elevated)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <CalendarDays size={20} />
            </span>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>No meetings with other people yet</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.55, margin: 0 }}>
              Calendar events with at least one other attendee show up here — or log a call you just had and capture it.
            </p>
          </div>
        </Reveal>
      )}
    </div>
  )
}
