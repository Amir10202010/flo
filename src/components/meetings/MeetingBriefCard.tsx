'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { MeetingBriefData } from '@/services/meeting.service'

/**
 * The AI pre-meeting brief. Cached briefs render instantly; otherwise one
 * generation call runs on first view with a quiet shimmer. When no AI
 * provider is configured the card disappears entirely — the deterministic
 * sections below carry the page (module honesty: nothing fake).
 */
export default function MeetingBriefCard({
  meetingId,
  initial,
}: {
  meetingId: string
  initial: MeetingBriefData | null
}) {
  const [brief, setBrief] = useState<MeetingBriefData | null>(initial)
  const [state, setState] = useState<'idle' | 'loading' | 'unavailable'>(initial ? 'idle' : 'loading')
  const requested = useRef(false)

  useEffect(() => {
    if (brief || requested.current) return
    requested.current = true
    ;(async () => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/brief`, { method: 'POST' })
        if (!res.ok) {
          setState('unavailable')
          return
        }
        const data = (await res.json()) as { brief: MeetingBriefData | null }
        if (data.brief) {
          setBrief(data.brief)
          setState('idle')
        } else {
          setState('unavailable')
        }
      } catch {
        setState('unavailable')
      }
    })()
  }, [brief, meetingId])

  if (state === 'unavailable') return null

  return (
    <div className="widget" style={{ padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span className="widget-icon-ai" style={{ width: 26, height: 26, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={13} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Meeting brief</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI · from your real threads and notes</span>
      </div>

      {state === 'loading' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ height: 13, borderRadius: 5, width: '92%' }} />
          <div className="skeleton" style={{ height: 13, borderRadius: 5, width: '84%' }} />
          <div className="skeleton" style={{ height: 13, borderRadius: 5, width: '55%' }} />
        </div>
      ) : (
        brief && (
          <>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-primary)' }}>{brief.brief}</p>
            {brief.talkingPoints.length > 0 && (
              <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {brief.talkingPoints.map((point) => (
                  <li key={point} style={{ display: 'flex', gap: 9, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', marginTop: 7, flexShrink: 0 }} />
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      )}
    </div>
  )
}
