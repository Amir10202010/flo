'use client'

import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { CornerDownLeft, Sparkles } from 'lucide-react'

const SUGGESTED = [
  'Who should I follow up with today?',
  'Summarize my at-risk clients',
  'Draft a check-in email to my quietest client',
  'What changed in my pipeline this week?',
]

/**
 * Assistant beta composer — fully interactive UI, honest about availability:
 * submitting shows the private-beta notice instead of pretending to answer.
 */
export default function AssistantComposer() {
  const reduced = useReducedMotion()
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!value.trim()) return
    setSubmitted(true)
  }

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
          onChange={(e) => {
            setValue(e.target.value)
            setSubmitted(false)
          }}
          placeholder="Ask about your clients, threads or pipeline…"
          aria-label="Ask the assistant"
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
        <button type="submit" className="btn-primary" style={{ fontSize: 13, padding: '9px 15px', flexShrink: 0 }}>
          Ask
          <CornerDownLeft size={13} />
        </button>
      </form>

      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              marginTop: 10,
              padding: '11px 14px',
              borderRadius: 11,
              background: 'var(--accent-dim)',
              border: '1px solid rgba(79,92,244,0.22)',
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              textAlign: 'left',
            }}
          >
            <strong style={{ color: 'var(--accent)', fontWeight: 700 }}>The assistant is in private beta.</strong>{' '}
            Your workspace is on the Early Access list — workspace Q&amp;A unlocks here first. Meanwhile, every thread already gets AI
            summaries, risk flags and next steps in the inbox.
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
        {SUGGESTED.map((s) => (
          <button
            key={s}
            type="button"
            className="prompt-chip"
            onClick={() => {
              setValue(s)
              setSubmitted(false)
            }}
          >
            <Sparkles size={11} style={{ color: 'var(--accent)' }} />
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
