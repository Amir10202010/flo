'use client'

import { useState } from 'react'
import { CircleCheck, Loader, Send, TriangleAlert } from 'lucide-react'

type State = 'idle' | 'sending' | 'sent' | 'error'

/**
 * "Send now" for the weekly digest — POSTs a preview copy to the workspace
 * owner mailbox (GMAIL_USER_EMAIL) without consuming the Monday schedule.
 */
export default function SendDigestButton() {
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function send() {
    if (state === 'sending') return
    setState('sending')
    setMessage(null)
    try {
      const res = await fetch('/api/digest/send', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to send the digest')
      setState('sent')
      setMessage(`Sent to ${data.to}`)
    } catch (e) {
      setState('error')
      setMessage(e instanceof Error ? e.message : 'Failed to send the digest')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <button
        type="button"
        className="btn-primary"
        style={{ fontSize: 13 }}
        disabled={state === 'sending'}
        onClick={send}
      >
        {state === 'sending' ? (
          <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
        ) : state === 'sent' ? (
          <CircleCheck size={13} />
        ) : (
          <Send size={13} />
        )}
        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent' : 'Send me a copy now'}
      </button>
      {message && (
        <span
          role={state === 'error' ? 'alert' : undefined}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: state === 'error' ? 'var(--hot)' : 'var(--success)' }}
        >
          {state === 'error' && <TriangleAlert size={11} />}
          {message}
        </span>
      )}
    </div>
  )
}
