'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader, Send, Sparkles, X } from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'
import type { DraftTone } from '@/types'

const TONES: { value: DraftTone; label: string }[] = [
  { value: 'WARM', label: 'Warm' },
  { value: 'CONCISE', label: 'Concise' },
  { value: 'FORMAL', label: 'Formal' },
  { value: 'MATCH', label: 'Match my style' },
]

/**
 * Smart Compose modal — describe the gist of a new email, let AI write
 * subject + body, edit, then send through the connected Gmail. Opened from the
 * inbox header and the command palette via the shared UI store.
 */
export default function ComposeModal() {
  const open = useUiStore((s) => s.composeOpen)
  const setOpen = useUiStore((s) => s.setComposeOpen)
  const router = useRouter()

  const [to, setTo] = useState('')
  const [instruction, setInstruction] = useState('')
  const [tone, setTone] = useState<DraftTone>('WARM')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [provider, setProvider] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function close() {
    setOpen(false)
    setTo('')
    setInstruction('')
    setTone('WARM')
    setSubject('')
    setBody('')
    setProvider(null)
    setError(null)
    setSent(false)
    setSending(false)
    setDrafting(false)
  }

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function draft() {
    if (!instruction.trim() || drafting) return
    setDrafting(true)
    setError(null)
    try {
      const res = await fetch('/api/compose/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: instruction.trim(), tone, to: to.trim() || undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Failed to draft')
      if (d.subject && !subject.trim()) setSubject(d.subject)
      setBody(d.body ?? '')
      setProvider(d.provider ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to draft')
    } finally {
      setDrafting(false)
    }
  }

  async function send() {
    if (!to.trim() || !body.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/compose/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim() || undefined, body: body.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Failed to send')
      setSent(true)
      setTimeout(() => {
        close()
        router.refresh()
      }, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send')
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="compose-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="compose-modal" role="dialog" aria-modal="true" aria-label="Compose email">
        <div className="compose-head">
          <h2>New email</h2>
          <button type="button" className="compose-x" onClick={close} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="composer-error" role="alert">
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            {error}
          </p>
        )}

        {sent ? (
          <div className="compose-sent">
            <Check size={18} />
            Sent!
          </div>
        ) : (
          <>
            <input
              className="compose-input"
              type="email"
              placeholder="To (email address)"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Recipient email"
            />

            <div className="compose-steer-row">
              <input
                className="compose-input"
                placeholder="What's the email about? e.g. “follow up on the May invoice”"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void draft()
                  }
                }}
                aria-label="What the email should say"
              />
              <select
                className="composer-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as DraftTone)}
                disabled={drafting}
                aria-label="Tone"
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="composer-tool composer-tool-ai"
                onClick={() => void draft()}
                disabled={drafting || !instruction.trim()}
              >
                {drafting ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                {drafting ? 'Drafting…' : 'AI draft'}
              </button>
            </div>

            <input
              className="compose-input"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-label="Subject"
            />

            <textarea
              className="compose-body"
              placeholder="Write your message… or let AI draft it from the line above."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-label="Message body"
            />

            {provider === 'local' && (
              <span className="composer-ai-label" title="Generated by the offline template — add a Gemini key for full AI drafts">
                offline template
              </span>
            )}

            <div className="compose-foot">
              <button type="button" className="compose-cancel" onClick={close}>
                Cancel
              </button>
              <button
                type="button"
                className="compose-send"
                onClick={() => void send()}
                disabled={sending || !to.trim() || !body.trim()}
              >
                {sending ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
