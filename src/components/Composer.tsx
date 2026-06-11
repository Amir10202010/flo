'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader, Send } from 'lucide-react'

export default function Composer({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function autoGrow() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }

  async function send() {
    const trimmed = body.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to send')
      }
      setBody('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      router.refresh() // re-fetch the server component to show the new message
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="composer">
      {error && (
        <p className="composer-error" role="alert">
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {error}
        </p>
      )}
      <div className="composer-row">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => { setBody(e.target.value); autoGrow() }}
          onKeyDown={onKeyDown}
          placeholder="Write a reply…"
          rows={1}
          disabled={sending}
          aria-label="Reply"
        />
        <button
          onClick={() => void send()}
          disabled={sending || !body.trim()}
          className="composer-send"
          aria-label="Send reply"
        >
          {sending ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
        </button>
      </div>
      <p className="composer-hint">Enter to send · Shift+Enter for a new line</p>
    </div>
  )
}
