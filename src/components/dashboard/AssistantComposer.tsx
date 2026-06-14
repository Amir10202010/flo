'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, CornerDownLeft, Loader2, Sparkles, TriangleAlert, User } from 'lucide-react'

const SUGGESTED = [
  'Who should I follow up with today?',
  'Summarize my at-risk clients',
  'Draft a check-in email to my quietest client',
  'What changed in my pipeline this week?',
]

interface Source {
  label: string
  href: string
}

interface AssistantTurn {
  question: string
  answer: string
  sources: Source[]
  followUps: string[]
  degraded: boolean
}

interface ApiAnswer {
  answer: string
  sources: Source[]
  followUps: string[]
  mode: 'gemini' | 'local'
  degraded: boolean
}

/**
 * Assistant composer — real workspace Q&A. Submitting POSTs to /api/assistant,
 * which answers from the user's live workspace (threads, analyses, engagement)
 * and returns grounded source links + suggested follow-ups.
 */
export default function AssistantComposer() {
  const reduced = useReducedMotion()
  const [value, setValue] = useState('')
  const [turns, setTurns] = useState<AssistantTurn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (turns.length || loading) threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [turns, loading])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || loading) return
    setValue('')
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || 'The assistant could not answer right now.')
      }
      const data = (await res.json()) as ApiAnswer
      setTurns((prev) => [
        ...prev,
        { question: q, answer: data.answer, sources: data.sources ?? [], followUps: data.followUps ?? [], degraded: data.degraded },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault()
    void ask(value)
  }

  const latestFollowUps = turns.length ? turns[turns.length - 1].followUps : []

  return (
    <div style={{ width: '100%', maxWidth: 640 }}>
      <form
        onSubmit={submit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 6px 6px 16px',
          borderRadius: 14,
          border: '1.5px solid var(--border)',
          background: '#FFFFFF',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Sparkles size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask about your clients, threads or pipeline…"
          aria-label="Ask the assistant"
          disabled={loading}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            fontSize: 14,
            color: 'var(--text-primary)',
            background: 'transparent',
            fontFamily: 'var(--font-sans)',
            padding: '10px 0',
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !value.trim()}
          style={{ fontSize: 13, padding: '9px 15px', flexShrink: 0 }}
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <>
              Ask
              <CornerDownLeft size={13} />
            </>
          )}
        </button>
      </form>

      {/* Conversation thread */}
      {(turns.length > 0 || loading || error) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16, textAlign: 'left' }}>
          {turns.map((t, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Question */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-end', maxWidth: '90%' }}>
                <span
                  style={{
                    padding: '8px 13px',
                    borderRadius: '12px 12px 4px 12px',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {t.question}
                </span>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    background: 'var(--surface-2, #EEF0FB)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <User size={13} />
                </span>
              </div>

              {/* Answer */}
              <AnswerBubble turn={t} reduced={!!reduced} />
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12.5 }}>
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
              Reading your workspace…
            </div>
          )}

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 13px',
                borderRadius: 11,
                background: 'rgba(220,38,38,0.06)',
                border: '1px solid rgba(220,38,38,0.2)',
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <TriangleAlert size={14} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          <div ref={threadEndRef} />
        </div>
      )}

      {/* Suggested prompts (initial) / follow-ups (after an answer) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
        {(turns.length ? latestFollowUps : SUGGESTED).map((s) => (
          <button key={s} type="button" className="prompt-chip" disabled={loading} onClick={() => void ask(s)}>
            <Sparkles size={11} style={{ color: 'var(--accent)' }} />
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function AnswerBubble({ turn, reduced }: { turn: AssistantTurn; reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'flex', gap: 8, alignSelf: 'flex-start', maxWidth: '95%' }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          background: 'linear-gradient(135deg, #4F5CF4, #6D44F5)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Sparkles size={12} />
      </span>
      <div
        style={{
          padding: '11px 14px',
          borderRadius: '12px 12px 12px 4px',
          background: 'var(--accent-dim)',
          border: '1px solid rgba(79,92,244,0.18)',
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          minWidth: 0,
        }}
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>{turn.answer}</div>

        {turn.sources.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 11 }}>
            {turn.sources.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: '#FFFFFF',
                  border: '1px solid var(--border)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                }}
              >
                {s.label}
                <ArrowUpRight size={11} />
              </Link>
            ))}
          </div>
        )}

        {turn.degraded && (
          <div style={{ marginTop: 9, fontSize: 11, color: 'var(--text-muted)' }}>
            Quick scan · offline mode — connect a Gemini key for richer answers.
          </div>
        )}
      </div>
    </motion.div>
  )
}
