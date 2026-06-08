'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader } from 'lucide-react'

export default function Composer({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px', background: '#FFFFFF', flexShrink: 0 }}>
      {error && (
        <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--hot)' }}>{error}</p>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a reply…  (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={sending}
          style={{
            flex: 1,
            resize: 'none',
            maxHeight: 160,
            minHeight: 42,
            padding: '11px 14px',
            borderRadius: 10,
            border: '1.5px solid var(--border)',
            background: 'var(--bg-surface)',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          onClick={() => void send()}
          disabled={sending || !body.trim()}
          className="btn-primary"
          style={{ padding: '11px 16px', opacity: sending || !body.trim() ? 0.6 : 1 }}
          aria-label="Send reply"
        >
          {sending ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}
