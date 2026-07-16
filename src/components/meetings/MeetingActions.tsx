'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw } from 'lucide-react'

/** Poll a background job until it settles, then refresh the page data. */
async function pollJob(jobId: string, onDone: () => void) {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    try {
      const res = await fetch(`/api/jobs/${jobId}`)
      if (!res.ok) continue
      const job = (await res.json()) as { status?: string }
      if (job.status === 'COMPLETED' || job.status === 'FAILED') break
    } catch {
      /* transient */
    }
  }
  onDone()
}

/** "Refresh from Calendar" — enqueues a calendar sync and refreshes when done. */
export function RefreshMeetingsButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const refresh = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const res = await fetch('/api/meetings/sync', { method: 'POST' })
      if (res.ok) {
        const { jobId } = (await res.json()) as { jobId: string }
        await pollJob(jobId, () => router.refresh())
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [router])

  return (
    <button type="button" className="kn-secondary-btn" onClick={refresh} disabled={busy}>
      <RefreshCw size={13} className={busy ? 'kn-spin' : undefined} />
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}

/** Log a meeting that wasn't on the calendar; opens it for capture. */
export function LogMeetingButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) return
      const { id } = (await res.json()) as { id: string }
      router.push(`/meetings/${id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className="btn-primary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
      >
        <Plus size={14} />
        Log a meeting
      </button>
      {open && (
        <form
          className="kn-popover"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <label htmlFor="log-meeting-title" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
            What was the meeting about?
          </label>
          <input
            id="log-meeting-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Intro call with Acme"
            className="kn-popover-input"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="kn-secondary-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy} style={{ padding: '6px 12px', fontSize: 12.5 }}>
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      )}
    </span>
  )
}
