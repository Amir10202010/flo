'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

/**
 * Post-meeting capture: paste the transcript (Meet, Zoom, anything) or type
 * what happened — one AI pass turns it into the debrief and links it into the
 * knowledge base. While the debrief job runs, the card shows progress and
 * refreshes the page when it lands.
 */
export default function MeetingCapture({
  meetingId,
  hasTranscript,
  pendingDebrief,
  recapture = false,
}: {
  meetingId: string
  hasTranscript: boolean
  pendingDebrief: boolean
  /** Render as the small "Replace transcript" affordance under a debrief. */
  recapture?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(!hasTranscript && !recapture)
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'processing' | 'error'>(
    pendingDebrief ? 'processing' : 'idle',
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll for the debrief landing (either from a fresh capture or a page load
  // that found the job still running), then pull fresh server data.
  useEffect(() => {
    if (state !== 'processing') return
    let ticks = 0
    pollTimer.current = setInterval(() => {
      ticks += 1
      router.refresh()
      if (ticks > 40 && pollTimer.current) clearInterval(pollTimer.current) // ~2 min cap
    }, 3000)
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [state, router])

  // When the server data catches up (debrief present), this component is
  // remounted without pendingDebrief — nothing to clean up client-side.

  async function submit() {
    setState('submitting')
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/meetings/${meetingId}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setErrorMsg(data?.error ?? 'Something went wrong — try again')
        setState('error')
        return
      }
      setState('processing')
    } catch {
      setErrorMsg('Something went wrong — try again')
      setState('error')
    }
  }

  if (state === 'processing') {
    return (
      <div className="widget" style={{ padding: '18px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="widget-icon-ai kn-pulse" style={{ width: 26, height: 26, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={13} />
        </span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Analyzing the meeting…</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Summary, decisions and action items are being extracted and linked into your knowledge.
          </div>
        </div>
      </div>
    )
  }

  if (recapture && !open) {
    return (
      <button type="button" className="kn-secondary-btn" onClick={() => setOpen(true)} style={{ marginTop: 4 }}>
        Replace transcript
      </button>
    )
  }

  return (
    <div className="widget" style={{ padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        Capture this meeting
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Paste the transcript from Meet or Zoom — or just type what happened. Velnox writes the summary, pulls out
        decisions and action items, and connects everything to the right people and topics.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder="Paste the transcript or type your notes…"
        aria-label="Meeting transcript or notes"
        className="mt-capture-input"
      />
      {errorMsg && <div style={{ fontSize: 12, color: 'var(--hot)', marginTop: 8 }}>{errorMsg}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        {recapture && (
          <button type="button" className="kn-secondary-btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={submit}
          disabled={state === 'submitting' || text.trim().length < 40}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
        >
          <Sparkles size={13} />
          {state === 'submitting' ? 'Uploading…' : 'Analyze meeting'}
        </button>
      </div>
    </div>
  )
}
