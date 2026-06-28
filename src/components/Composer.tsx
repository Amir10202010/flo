'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, ChevronDown, Loader, PencilLine, RotateCcw, Send, Sparkles } from 'lucide-react'
import TemplateMenu from '@/components/TemplateMenu'
import { handleUpgrade } from '@/lib/upgrade'
import type { DraftTone } from '@/types'

const TONES: { value: DraftTone; label: string }[] = [
  { value: 'WARM', label: 'Warm' },
  { value: 'CONCISE', label: 'Concise' },
  { value: 'FORMAL', label: 'Formal' },
  { value: 'MATCH', label: 'Match my style' },
]

export default function Composer({
  conversationId,
  initialDraft = null,
  autoDraft = false,
}: {
  conversationId: string
  /** A pre-generated auto-draft to pre-fill (Phase 3). */
  initialDraft?: { body: string; provider: string } | null
  /** Generate a draft immediately on open — used by the one-click action (Phase 4). */
  autoDraft?: boolean
}) {
  const router = useRouter()
  const [body, setBody] = useState(initialDraft?.body ?? '')
  const [sending, setSending] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tone, setTone] = useState<DraftTone>('WARM')
  const [steer, setSteer] = useState('')
  const [showSteer, setShowSteer] = useState(false)
  const [toneOpen, setToneOpen] = useState(false)
  const [aiProvider, setAiProvider] = useState<string | null>(initialDraft?.provider ?? null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const toneRef = useRef<HTMLDivElement>(null)
  const didInit = useRef(false)

  function autoGrow() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  async function draft() {
    if (drafting) return
    setDrafting(true)
    setError(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, steer: steer.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (handleUpgrade(res, data)) return
      if (!res.ok) throw new Error(data.error ?? 'Failed to draft a reply')
      setBody(data.body ?? '')
      setAiProvider(data.provider ?? null)
      requestAnimationFrame(() => {
        autoGrow()
        textareaRef.current?.focus()
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to draft a reply')
    } finally {
      setDrafting(false)
    }
  }

  // Mount: consume a handed-in auto-draft (clears the list "draft ready" badge),
  // or kick off a draft once when the one-click action requested it.
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    if (initialDraft) {
      requestAnimationFrame(autoGrow)
      // Fire-and-forget: mark the stored draft consumed (Phase 3 endpoint).
      fetch(`/api/conversations/${conversationId}/draft`, { method: 'DELETE' }).catch(() => {})
    } else if (autoDraft) {
      // Defer so we don't call setState synchronously inside the effect body.
      requestAnimationFrame(() => void draft())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close the tone menu on an outside click.
  useEffect(() => {
    if (!toneOpen) return
    function onDown(e: MouseEvent) {
      if (toneRef.current && !toneRef.current.contains(e.target as Node)) setToneOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [toneOpen])

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
      setAiProvider(null)
      setSteer('')
      setShowSteer(false)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      router.refresh() // re-fetch the server component to show the new message
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  function insertTemplate(text: string) {
    setBody((b) => (b.trim() ? `${b.trimEnd()}\n\n${text}` : text))
    requestAnimationFrame(() => {
      autoGrow()
      textareaRef.current?.focus()
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const busy = sending || drafting
  const hasContent = body.trim().length > 0

  return (
    <div className="composer">
      {error && (
        <p className="composer-error" role="alert">
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {error}
        </p>
      )}

      <div className="composer-block">
        {showSteer && (
          <input
            className="composer-steer"
            value={steer}
            onChange={(e) => setSteer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void draft()
              }
            }}
            placeholder="Tell the AI what to say… (e.g. “confirm we ship Friday”)"
            maxLength={500}
            disabled={busy}
            aria-label="What the AI draft should say"
          />
        )}

        <div className="composer-row">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              autoGrow()
            }}
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

        <div className="composer-tools">
          <button
            type="button"
            className="composer-tool composer-tool-ai"
            onClick={() => void draft()}
            disabled={busy}
            title={hasContent ? 'Generate a different draft' : 'Let AI draft a reply for you'}
          >
            {drafting ? (
              <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
            ) : hasContent ? (
              <RotateCcw size={13} />
            ) : (
              <Sparkles size={13} />
            )}
            {drafting ? 'Drafting…' : hasContent ? 'Regenerate' : 'AI draft'}
          </button>

          <div className="composer-tone" ref={toneRef}>
            <button
              type="button"
              className="composer-tone-btn"
              onClick={() => setToneOpen((o) => !o)}
              disabled={busy}
              aria-haspopup="menu"
              aria-expanded={toneOpen}
              title="Tone of the AI draft"
            >
              {TONES.find((t) => t.value === tone)?.label}
              <ChevronDown size={12} />
            </button>
            {toneOpen && (
              <div className="composer-tone-menu" role="menu">
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={tone === t.value}
                    className="composer-tone-item"
                    data-active={tone === t.value}
                    onClick={() => {
                      setTone(t.value)
                      setToneOpen(false)
                    }}
                  >
                    {t.label}
                    {tone === t.value && <Check size={13} style={{ color: 'var(--accent)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className={`composer-tool${showSteer ? ' active' : ''}`}
            onClick={() => setShowSteer((s) => !s)}
            disabled={busy}
            title="Add a one-line instruction for the draft"
          >
            <PencilLine size={13} /> Steer
          </button>

          <TemplateMenu onPick={insertTemplate} disabled={busy} />

          {aiProvider === 'local' && (
            <span
              className="composer-ai-label"
              title="Generated by the offline template — add a Gemini key for full AI drafts"
            >
              offline template
            </span>
          )}

          <span className="composer-hint composer-hint-inline">Enter to send · Shift+Enter for a new line</span>
        </div>
      </div>
    </div>
  )
}
