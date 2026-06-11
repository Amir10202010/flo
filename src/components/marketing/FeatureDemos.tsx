'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Search, Sparkles, Check, Bot, Zap, PartyPopper, ShieldCheck } from 'lucide-react'

/* Shared step-machine hook: loops through `durations`, or jumps to `final` when
 * the user prefers reduced motion. */
function useTimeline(durations: number[], final: number) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => setStep(s => (s + 1) % durations.length), durations[step])
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, reduce])
  // Reduced motion → resolve straight to the final frame.
  return { step: reduce ? final : step, reduce }
}

function Chrome({ url }: { url: string }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
      </div>
      <div style={{ flex: 1, maxWidth: 230, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{url}</span>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   1 · AI chat search → deal closes
   ════════════════════════════════════════════════════════════════════════════ */
const SEARCH_QUERY = 'who asked about the premium plan?'
const SEARCH_RESULTS = [
  { ini: 'MR', bg: 'rgba(220,43,85,0.1)', col: '#DC2B55', name: 'Maria Rossi', snippet: 'Is the premium plan worth it for a small team?', match: true },
  { ini: 'TK', bg: 'rgba(79,92,244,0.1)', col: '#4F5CF4', name: 'Tom Keller', snippet: 'Can you send over the contract draft?', match: false },
  { ini: 'JD', bg: 'rgba(194,98,10,0.1)', col: '#C2620A', name: 'Jana Diehl', snippet: 'Thanks, talk next week!', match: false },
]
const SEARCH_DUR = [1300, 1900, 1300, 1600, 1400, 1500, 2400]

export function SearchDemo() {
  const { step, reduce } = useTimeline(SEARCH_DUR, 6)
  const [chars, setChars] = useState(0)

  // Typewriter only runs during the "typing" step; the displayed text is
  // derived from `step` so other steps never need a synchronous reset.
  useEffect(() => {
    if (reduce || step !== 1) return
    let c = 0
    const id = setInterval(() => {
      c += 1
      setChars(Math.min(c, SEARCH_QUERY.length))
      if (c >= SEARCH_QUERY.length) clearInterval(id)
    }, 55)
    return () => clearInterval(id)
  }, [step, reduce])

  const typed = step === 0 ? 0 : step >= 2 ? SEARCH_QUERY.length : chars

  const filtering = step >= 2
  const opened = step >= 3
  const analyzing = step === 3
  const sent = step >= 4
  const replied = step >= 5
  const won = step >= 6

  return (
    <div className="scene" style={{ minHeight: 420 }}>
      <Chrome url="flo.app/inbox" />
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 376 }}>
        {/* Search bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 11, border: `1.5px solid ${step >= 1 ? 'var(--accent)' : 'var(--border)'}`, background: '#FFFFFF', boxShadow: step >= 1 ? '0 0 0 3px rgba(79,92,244,0.12)' : 'var(--shadow-xs)', transition: 'all 0.2s' }}>
          <Search size={16} style={{ color: step >= 1 ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>
            {SEARCH_QUERY.slice(0, typed)}
            {!reduce && step === 1 && <span className="animate-blink" style={{ color: 'var(--accent)' }}>|</span>}
            {step === 0 && <span style={{ color: 'var(--text-muted)' }}>Search conversations…</span>}
          </span>
        </div>

        {filtering && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={12} style={{ color: 'var(--accent)' }} /> 1 match found by meaning, not just keywords
          </motion.p>
        )}

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SEARCH_RESULTS.map(r => {
            const dim = filtering && !r.match
            const highlight = filtering && r.match
            return (
              <motion.div
                key={r.name}
                animate={{ opacity: dim ? 0.32 : 1, scale: highlight ? 1 : 0.998 }}
                transition={{ duration: 0.4 }}
                style={{
                  padding: '11px 13px', borderRadius: 11, background: '#FFFFFF', display: 'flex', gap: 11, alignItems: 'center',
                  border: `1px solid ${highlight ? 'rgba(79,92,244,0.4)' : 'var(--border)'}`,
                  boxShadow: highlight ? '0 6px 20px rgba(79,92,244,0.12)' : 'var(--shadow-xs)',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: r.bg, color: r.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{r.ini}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                    {highlight && won && <span className="priority-badge priority-cold" style={{ fontSize: 9 }}>Won</span>}
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.snippet}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Opened deal flow */}
        <AnimatePresence>
          {opened && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
              style={{ marginTop: 'auto', padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}
            >
              {won ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PartyPopper size={15} style={{ color: '#16A34A' }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16A34A' }}>Maria upgraded to Premium — deal won 🎉</span>
                </div>
              ) : analyzing ? (
                <div className="ai-shimmer" style={{ padding: '8px 11px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={13} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>AI is drafting the perfect reply…</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sent && (
                    <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
                      <div className="msg-bubble msg-bubble-out" style={{ fontSize: 12.5 }}>Great choice! Premium is perfect for small teams — I’ll upgrade you now and send the invoice. 🚀</div>
                    </div>
                  )}
                  {replied && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                      <div className="msg-bubble msg-bubble-in" style={{ fontSize: 12.5 }}>Perfect, let’s do it! 🙌</div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   2 · Configure an auto-reply bot from your own content
   ════════════════════════════════════════════════════════════════════════════ */
const BOT_DUR = [1500, 1200, 1500, 1600, 2600]

export function BotSetupDemo() {
  const { step } = useTimeline(BOT_DUR, 4)
  const on = step >= 1
  const incoming = step >= 2
  const generating = step === 3
  const answered = step >= 4

  return (
    <div className="scene" style={{ minHeight: 420 }}>
      <Chrome url="flo.app/bot" />
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 376 }}>
        {/* Knowledge card */}
        <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
            <Bot size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)' }}>Bot knowledge</span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            “We’re open 9–6 Mon–Sat. Same-day delivery in the city for orders before 3pm. Free returns within 14 days.”
          </p>
        </div>

        {/* Auto-reply toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, border: `1px solid ${on ? 'rgba(79,92,244,0.3)' : 'var(--border)'}`, background: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Zap size={15} style={{ color: on ? 'var(--accent)' : 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Auto-reply</span>
          </div>
          <div style={{ width: 42, height: 24, borderRadius: 999, padding: 3, background: on ? 'var(--accent)' : 'var(--border)', transition: 'background 0.25s', display: 'flex' }}>
            <motion.div animate={{ x: on ? 18 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
        </div>

        {/* Live thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, justifyContent: 'flex-end' }}>
          <AnimatePresence>
            {incoming && (
              <motion.div key="in" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div className="msg-bubble msg-bubble-in" style={{ fontSize: 12.5 }}>Hi! Do you offer same-day delivery?</div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {generating && (
              <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ alignSelf: 'flex-end' }}>
                <div style={{ display: 'inline-flex', gap: 4, padding: '11px 14px', borderRadius: '13px 13px 3px 13px', background: 'var(--accent)' }}>
                  <span className="typing-dot" style={{ background: '#fff' }} /><span className="typing-dot" style={{ background: '#fff', animationDelay: '0.15s' }} /><span className="typing-dot" style={{ background: '#fff', animationDelay: '0.3s' }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {answered && (
              <motion.div key="out" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} style={{ alignSelf: 'flex-end', maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div className="msg-bubble msg-bubble-out" style={{ fontSize: 12.5 }}>Yes! Same-day delivery in the city for orders placed before 3pm. 🚚</div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Bot size={11} style={{ color: 'var(--accent)' }} /> Sent by bot · from your knowledge
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   3 · Connect Gmail in one click
   ════════════════════════════════════════════════════════════════════════════ */
const GMAIL_DUR = [1400, 1400, 1700, 1800, 2400]

export function GmailConnectDemo() {
  const { step } = useTimeline(GMAIL_DUR, 4)
  const popup = step === 1 || step === 2
  const choosing = step === 2
  const connected = step >= 3
  const syncing = step === 3
  const done = step >= 4

  return (
    <div className="scene" style={{ minHeight: 420 }}>
      <Chrome url="flo.app/integrations" />
      <div style={{ padding: 18, position: 'relative', minHeight: 376 }}>
        <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Integrations</p>

        {/* Gmail card */}
        <motion.div
          animate={{ borderColor: connected ? 'rgba(40,170,90,0.4)' : 'var(--border)' }}
          style={{ padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: '#FFFFFF', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(234,67,53,0.08)', border: '1px solid rgba(234,67,53,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="/icons/gmail.svg" alt="Gmail" width={20} height={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Gmail</div>
              <div style={{ fontSize: 11.5, color: connected ? '#16A34A' : 'var(--text-muted)', fontWeight: connected ? 600 : 400 }}>
                {done ? 'Connected · 50 conversations synced' : connected ? 'Connected' : 'Not connected'}
              </div>
            </div>
          </div>
          <AnimatePresence mode="wait">
            {connected ? (
              <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'rgba(40,200,100,0.1)', color: '#16A34A', fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>
                <Check size={14} /> Done
              </motion.span>
            ) : (
              <motion.button key="btn" animate={{ scale: step === 1 ? 0.94 : 1 }} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12.5, flexShrink: 0 }}>
                Connect
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Sync progress */}
        <AnimatePresence>
          {connected && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>{done ? 'Sync complete' : 'Importing conversations…'}</span>
                <span>{done ? '50 / 50' : ''}</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: done ? '100%' : syncing ? '70%' : '0%' }}
                  transition={{ duration: syncing ? 1.6 : 0.5, ease: 'easeInOut' }}
                  style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#4F5CF4,#7C4DFF)' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* OAuth popup */}
        <AnimatePresence>
          {popup && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(12,18,60,0.18)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0 }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
                style={{ width: 260, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}
              >
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={15} style={{ color: '#16A34A' }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Sign in with Google</span>
                </div>
                <motion.div
                  animate={{ background: choosing ? 'var(--accent-dim)' : '#FFFFFF' }}
                  style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 11 }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#4b6bff,#9b6bff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>A</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Amir M.</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>amir@company.com</div>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
