'use client'

import Link from 'next/link'
import { Activity, BrainCircuit, Mail, RefreshCw, Send, TriangleAlert } from 'lucide-react'
import type { TimelineEvent } from '@/services/dashboard.service'
import WidgetShell from './WidgetShell'
import EmptyNote from './EmptyNote'

const KIND_STYLE: Record<TimelineEvent['kind'], { icon: React.ReactNode; color: string; bg: string }> = {
  email: { icon: <Mail size={12} />, color: 'var(--accent)', bg: 'var(--accent-dim)' },
  reply: { icon: <Send size={12} />, color: 'var(--success)', bg: 'var(--success-dim)' },
  analysis: { icon: <BrainCircuit size={12} />, color: '#7C4DDF', bg: 'rgba(124, 77, 223, 0.08)' },
  risk: { icon: <TriangleAlert size={12} />, color: 'var(--hot)', bg: 'var(--hot-dim)' },
  sync: { icon: <RefreshCw size={12} />, color: 'var(--text-muted)', bg: 'var(--bg-elevated)' },
}

/** Workspace activity feed: emails, replies, AI analyses, risk flags, syncs. */
export default function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <WidgetShell
      icon={<Activity size={14} />}
      title="Activity"
      sub="Latest events across your inbox"
      status="live"
    >
      {events.length === 0 ? (
        <EmptyNote
          icon={<Activity size={17} />}
          title="No activity yet"
          hint="Emails, AI analyses and syncs will stream in here."
        />
      ) : (
        <div style={{ padding: '10px 16px 14px', position: 'relative' }}>
          {/* Rail */}
          <div style={{ position: 'absolute', left: 27, top: 18, bottom: 20, width: 1, background: 'var(--border-light)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {events.map((e) => {
              const s = KIND_STYLE[e.kind]
              const inner = (
                <>
                  <span
                    style={{
                      width: 23,
                      height: 23,
                      borderRadius: 7,
                      background: s.bg,
                      color: s.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      position: 'relative',
                      zIndex: 1,
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    {s.icon}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.title}
                    </div>
                    {e.detail && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.detail}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{e.timeAgo}</span>
                </>
              )
              const rowStyle: React.CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 4px',
                borderRadius: 9,
                textDecoration: 'none',
                minWidth: 0,
              }
              return e.href ? (
                <Link key={e.id} href={e.href} className="row-link" style={rowStyle}>
                  {inner}
                </Link>
              ) : (
                <div key={e.id} style={rowStyle}>
                  {inner}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </WidgetShell>
  )
}
