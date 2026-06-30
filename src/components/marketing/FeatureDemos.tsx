'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion, animate } from 'framer-motion'
import { Search, Sparkles, Check, Zap, PartyPopper, ShieldCheck, ShieldAlert, MessagesSquare, Flame, Gauge, TrendingUp, UserRound, Tag } from 'lucide-react'
import { HealthRing } from '@/components/dashboard/HealthRing'
import { SPRING, EASE_OUT, bubbleIn, sceneStagger, sceneItem } from './demo-motion'

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

/* Scene shell: browser chrome + staggered build-in of the inner blocks, so
 * each demo assembles like a real app painting its UI rather than popping in. */
function SceneBody({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={sceneStagger}
      style={style}
    >
      {children}
    </motion.div>
  )
}

/* Email-style message card — a compact visual copy of the real .msg-card, so
 * the demos render the same thread chrome as the redesigned inbox. */
function DemoEmailCard({ out, sender, ini, text }: { out: boolean; sender: string; ini?: string; text: string }) {
  return (
    <article className={`msg-card ${out ? 'out' : 'in'}`} style={{ marginTop: 0 }}>
      <header className="msg-card-head" style={{ padding: '9px 13px 0' }}>
        <span className={`msg-avatar ${out ? 'out' : 'in'}`} style={{ width: 26, height: 26, fontSize: 10 }} aria-hidden>
          {out ? <UserRound size={13} /> : ini}
        </span>
        <span className="msg-sender" style={{ fontSize: 12 }}>{sender}</span>
        <time className="msg-time" style={{ fontSize: 10.5 }}>just now</time>
      </header>
      <div className="msg-body" style={{ padding: '5px 13px 11px', fontSize: 12 }}>{text}</div>
    </article>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   1 · AI chat search → deal closes
   ════════════════════════════════════════════════════════════════════════════ */
const SEARCH_QUERY = 'who asked about the enterprise plan?'
const SEARCH_RESULTS = [
  { ini: 'MR', bg: 'rgba(220,43,85,0.1)', col: '#DC2B55', name: 'Maria Rossi', snippet: 'Is the Enterprise plan right for a growing team?', match: true },
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

  const focused = step === 1
  const filtering = step >= 2
  const opened = step >= 3
  const analyzing = step === 3
  const sent = step >= 4
  const replied = step >= 5
  const won = step >= 6

  return (
    <div className="scene" style={{ minHeight: 420 }}>
      <Chrome url="usevelnox.com/inbox" />
      <SceneBody style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 376 }}>
        {/* Search bar — lifts slightly while it has focus, like a real input */}
        <motion.div variants={sceneItem}>
          <motion.div
            animate={{ scale: focused ? 1.012 : 1, y: focused ? -1 : 0 }}
            transition={SPRING.snap}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 11, border: `1.5px solid ${step >= 1 ? 'var(--accent)' : 'var(--border)'}`, background: '#FFFFFF', boxShadow: step >= 1 ? '0 0 0 3px rgba(79,92,244,0.12), 0 6px 18px rgba(79,92,244,0.08)' : 'var(--shadow-xs)', transition: 'border-color 0.25s, box-shadow 0.25s' }}
          >
            <Search size={16} style={{ color: step >= 1 ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0, transition: 'color 0.25s' }} />
            <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>
              {SEARCH_QUERY.slice(0, typed)}
              {!reduce && step === 1 && <span className="animate-blink" style={{ color: 'var(--accent)' }}>|</span>}
              {step === 0 && <span style={{ color: 'var(--text-muted)' }}>Search conversations…</span>}
            </span>
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {filtering && (
            <motion.p
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Sparkles size={12} style={{ color: 'var(--accent)' }} /> 1 match found by meaning, not just keywords
            </motion.p>
          )}
        </AnimatePresence>

        {/* Results — the match lifts toward you, the rest fall out of focus */}
        <motion.div variants={sceneItem} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SEARCH_RESULTS.map(r => {
            const dim = filtering && !r.match
            const highlight = filtering && r.match
            return (
              <motion.div
                key={r.name}
                animate={{
                  opacity: dim ? 0.3 : 1,
                  scale: highlight ? 1.015 : 1,
                  y: highlight ? -2 : 0,
                  filter: dim ? 'blur(1.4px)' : 'blur(0px)',
                }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                style={{
                  padding: '11px 13px', borderRadius: 11, background: '#FFFFFF', display: 'flex', gap: 11, alignItems: 'center',
                  border: `1px solid ${highlight ? 'rgba(79,92,244,0.4)' : 'var(--border)'}`,
                  boxShadow: highlight ? '0 8px 24px rgba(79,92,244,0.14)' : 'var(--shadow-xs)',
                  transition: 'border-color 0.3s, box-shadow 0.3s',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: r.bg, color: r.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{r.ini}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                    <AnimatePresence>
                      {highlight && won && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                          transition={SPRING.snap}
                          className="priority-badge priority-cold" style={{ fontSize: 9 }}
                        >
                          Won
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.snippet}</p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Opened deal flow */}
        <AnimatePresence>
          {opened && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              transition={SPRING.panel}
              style={{ marginTop: 'auto', padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={won ? 'won' : analyzing ? 'gen' : 'thread'}
                  initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                >
                  {won ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.snap, delay: 0.08 }} style={{ display: 'inline-flex' }}>
                        <PartyPopper size={15} style={{ color: '#16A34A' }} />
                      </motion.span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16A34A' }}>Maria upgraded to Enterprise — deal won 🎉</span>
                    </div>
                  ) : analyzing ? (
                    <div className="ai-shimmer" style={{ padding: '8px 11px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={13} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>AI is drafting the reply — review before send…</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sent && (
                        <motion.div {...bubbleIn} transition={SPRING.pop}>
                          <DemoEmailCard out sender="You" text="Great choice! Enterprise is built for teams as you scale — I’ll set you up now and send the invoice. 🚀" />
                        </motion.div>
                      )}
                      {replied && (
                        <motion.div {...bubbleIn} transition={SPRING.pop}>
                          <DemoEmailCard out={false} sender="Maria Rossi" ini="MR" text="Perfect, let’s do it! 🙌" />
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </SceneBody>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   2 · Route every message automatically (real team routing rules)
   ════════════════════════════════════════════════════════════════════════════ */
const RULE_DUR = [1500, 1300, 1500, 1500, 3000]
//               idle  toggle incoming match  routed

export function RoutingRulesDemo() {
  const { step, reduce } = useTimeline(RULE_DUR, 4)
  const on = step >= 1
  const incoming = step >= 2
  const routing = step === 3
  const routed = step >= 4

  return (
    <div className="scene" style={{ minHeight: 420 }}>
      <Chrome url="usevelnox.com/settings" />
      <SceneBody style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 376 }}>
        {/* Rule card — mirrors the real RulesPanel row: name + summary + on/off */}
        <motion.div
          variants={sceneItem}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12,
            border: `1px solid ${on ? 'rgba(79,92,244,0.3)' : 'var(--border)'}`,
            boxShadow: on ? '0 0 0 3px rgba(79,92,244,0.06)' : 'none',
            background: '#FFFFFF', transition: 'border-color 0.3s, box-shadow 0.3s',
          }}
        >
          <span style={{ width: 34, height: 34, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--accent-dim)' : 'var(--bg-subtle)', color: on ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0, transition: 'background 0.3s, color 0.3s' }}>
            <Zap size={16} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Route Acme invoices</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              When domain acme.com &amp; subject ~ “invoice” → assign Finance, priority high
            </div>
          </div>
          {/* on/off toggle — flips on at step 1 with a ripple */}
          <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
            <AnimatePresence>
              {step === 1 && (
                <motion.span
                  key="ring"
                  initial={{ opacity: 0.55, scale: 0.75 }}
                  animate={{ opacity: 0, scale: 1.8 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ position: 'absolute', inset: -4, borderRadius: 999, border: '2px solid rgba(79,92,244,0.5)', pointerEvents: 'none' }}
                />
              )}
            </AnimatePresence>
            <div style={{ width: 42, height: 24, borderRadius: 999, padding: 3, background: on ? 'var(--accent)' : 'var(--border)', transition: 'background 0.25s', display: 'flex' }}>
              <motion.div animate={{ x: on ? 18 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        </motion.div>

        {/* Live: an incoming thread flows through the rule and lands routed */}
        <motion.div variants={sceneItem} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11, justifyContent: 'flex-end' }}>
          <AnimatePresence>
            {incoming && (
              <motion.div
                key="incoming"
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={SPRING.pop}
                style={{
                  position: 'relative', overflow: 'hidden', padding: '11px 13px', borderRadius: 12, background: '#FFFFFF',
                  border: `1px solid ${routed ? 'rgba(40,170,90,0.4)' : 'var(--border)'}`,
                  boxShadow: 'var(--shadow-xs)', transition: 'border-color 0.4s',
                }}
              >
                <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(194,98,10,0.1)', color: '#C2620A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>AC</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>billing@acme.com</span>
                      <AnimatePresence>
                        {routed && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.snap}
                            className="priority-badge priority-hot" style={{ fontSize: 9, flexShrink: 0 }}
                          >
                            High
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Invoice #5821 is overdue — please advise</p>
                    <AnimatePresence>
                      {routed && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.3 }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, overflow: 'hidden' }}
                        >
                          <span className="cat-tag" style={{ color: 'var(--text-secondary)' }}><UserRound size={10} /> Finance</span>
                          <span className="cat-tag"><Tag size={10} /> Billing</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* routing shimmer sweeps the row while the rule matches */}
                {routing && !reduce && (
                  <motion.div
                    initial={{ left: '-35%' }} animate={{ left: '110%' }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: 'linear-gradient(90deg, transparent, rgba(79,92,244,0.12), transparent)', pointerEvents: 'none' }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {routing && (
              <motion.div
                key="routing-label"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}
              >
                <Sparkles size={12} /> Rule matched — routing to the right person…
              </motion.div>
            )}
            {routed && (
              <motion.div
                key="routed-label"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#16A34A', fontWeight: 600 }}
              >
                <Check size={13} /> Auto-assigned to Finance — no manual triage
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </SceneBody>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   3 · Connect Gmail in one click
   ════════════════════════════════════════════════════════════════════════════ */
const GMAIL_DUR = [1400, 1400, 1700, 1900, 3000]

const SYNCED_ROWS = [
  { ini: 'MR', bg: 'rgba(220,43,85,0.1)', col: '#DC2B55', name: 'Maria Rossi', snippet: 'Is the Enterprise plan worth it?', badge: 'Urgent', cls: 'priority-hot', assignee: 'You' },
  { ini: 'TK', bg: 'rgba(194,98,10,0.1)', col: '#C2620A', name: 'Tom Keller', snippet: 'Can you send the contract draft?', badge: 'High', cls: 'priority-attention', assignee: 'Priya' },
  { ini: 'JD', bg: 'rgba(79,92,244,0.1)', col: '#4F5CF4', name: 'Jana Diehl', snippet: 'Thanks, talk next week!', badge: 'Normal', cls: 'priority-cold', assignee: 'Sam' },
]

export function GmailConnectDemo() {
  const { step } = useTimeline(GMAIL_DUR, 4)
  const popup = step === 1 || step === 2
  const choosing = step === 2
  const connected = step >= 3
  const syncing = step === 3
  const done = step >= 4

  return (
    <div className="scene" style={{ minHeight: 420 }}>
      <Chrome url="usevelnox.com/integrations" />
      <SceneBody style={{ padding: 18, position: 'relative', minHeight: 376 }}>
        <motion.p variants={sceneItem} style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Integrations</motion.p>

        {/* Gmail card */}
        <motion.div
          variants={sceneItem}
          style={{
            padding: 16, borderRadius: 14,
            border: `1px solid ${connected ? 'rgba(40,170,90,0.4)' : 'var(--border)'}`,
            background: '#FFFFFF', boxShadow: 'var(--shadow-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
            transition: 'border-color 0.4s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(234,67,53,0.08)', border: '1px solid rgba(234,67,53,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="/icons/gmail.svg" alt="Gmail" width={20} height={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Gmail</div>
              <div style={{ fontSize: 11.5, color: connected ? '#16A34A' : 'var(--text-muted)', fontWeight: connected ? 600 : 400, transition: 'color 0.3s' }}>
                {done ? 'Connected · 50 conversations synced' : connected ? 'Connected' : 'Not connected'}
              </div>
            </div>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            {connected ? (
              <motion.span
                key="ok"
                initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }}
                transition={SPRING.snap}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'rgba(40,200,100,0.1)', color: '#16A34A', fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}
              >
                <Check size={14} /> Done
              </motion.span>
            ) : (
              <motion.button
                key="btn"
                exit={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: step === 1 ? 0.94 : 1 }}
                transition={SPRING.snap}
                className="btn-primary" style={{ padding: '8px 16px', fontSize: 12.5, flexShrink: 0 }}
              >
                Connect
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Sync progress + first conversations landing in */}
        <AnimatePresence>
          {connected && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING.panel} style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>{done ? 'Sync complete' : 'Importing conversations…'}</span>
                <span>{done ? '50 / 50' : ''}</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: done ? '100%' : syncing ? '76%' : '0%' }}
                  transition={done ? { duration: 0.45, ease: 'easeOut' } : { duration: 1.7, ease: [0.3, 0.6, 0.4, 1] }}
                  style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#4F5CF4,#7C4DFF)' }}
                />
              </div>

              {/* Threads appear as they sync: skeletons → prioritised rows */}
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  {syncing && [0, 1, 2].map(i => (
                    <motion.div
                      key={`skel-${i}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                      transition={{ ...SPRING.pop, delay: i * 0.1 }}
                      className="skeleton"
                      style={{ height: 44, borderRadius: 11 }}
                    />
                  ))}
                  {done && SYNCED_ROWS.map((r, i) => (
                    <motion.div
                      key={r.ini}
                      initial={{ opacity: 0, y: 14, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ ...SPRING.pop, delay: i * 0.12 }}
                      style={{ padding: '9px 12px', borderRadius: 11, border: '1px solid var(--border)', background: '#FFFFFF', boxShadow: 'var(--shadow-xs)', display: 'flex', gap: 10, alignItems: 'center' }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: r.bg, color: r.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{r.ini}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</div>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.snippet}</p>
                        <span className="cat-tag" style={{ marginTop: 4, color: 'var(--text-secondary)' }}><UserRound size={10} /> {r.assignee}</span>
                      </div>
                      <span className={`priority-badge ${r.cls}`} style={{ fontSize: 8.5, flexShrink: 0, alignSelf: 'flex-start' }}>{r.badge}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* OAuth popup */}
        <AnimatePresence>
          {popup && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(12,18,60,0.18)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0, zIndex: 5 }}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 14, filter: 'blur(4px)' }}
                animate={{ scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ scale: 0.95, opacity: 0, filter: 'blur(2px)' }}
                transition={SPRING.panel}
                style={{ width: 260, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}
              >
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={15} style={{ color: '#16A34A' }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Sign in with Google</span>
                </div>
                <div
                  style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 11, background: choosing ? 'var(--accent-dim)' : '#FFFFFF', transition: 'background 0.3s' }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#4b6bff,#9b6bff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>A</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Amir M.</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>amir@company.com</div>
                  </div>
                  <AnimatePresence>
                    {choosing && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={SPRING.snap} style={{ display: 'inline-flex' }}>
                        <Check size={14} style={{ color: 'var(--accent)' }} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </SceneBody>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   4 · Executive dashboard — the workspace assembles itself
   ════════════════════════════════════════════════════════════════════════════ */
const DASH_DUR = [900, 1600, 1900, 2100, 3200]
//               shell stats command risk  hold

/** Animated counter for stat values; resolves instantly under reduced motion. */
function CountUp({ to, active, reduce }: { to: number; active: boolean; reduce: boolean }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!active || reduce) return
    const controls = animate(0, to, { duration: 0.9, ease: 'easeOut', onUpdate: (v: number) => setN(Math.round(v)) })
    return () => controls.stop()
  }, [active, reduce, to])
  return <>{reduce ? to : active ? n : 0}</>
}

const statLabel: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}

export function DashboardDemo() {
  const { step, reduce } = useTimeline(DASH_DUR, 4)
  const statsIn = step >= 1
  const commandIn = step >= 2
  const riskIn = step >= 3

  return (
    <div className="scene" style={{ minHeight: 420 }}>
      <Chrome url="usevelnox.com/dashboard" />
      <SceneBody style={{ padding: 16, minHeight: 376, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {/* Header — paints first, like the real dashboard shell */}
        <motion.div variants={sceneItem} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Good to see you, Amir</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Thursday, June 11 · 3 teammates online</div>
          </div>
          <AnimatePresence>
            {statsIn && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                transition={SPRING.snap}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 600, color: 'var(--success)', background: 'var(--success-dim)', border: '1px solid var(--success-border)', borderRadius: 100, padding: '4px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <span className="animate-pulse-s" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)' }} />
                Synced just now
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Executive stats — health ring draws, numbers count up */}
        <motion.div variants={sceneItem} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 9 }}>
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ opacity: statsIn ? 1 : 0, y: statsIn ? 0 : 14, scale: statsIn ? 1 : 0.97 }}
              transition={{ ...SPRING.pop, delay: statsIn ? i * 0.1 : 0 }}
              className="widget"
              style={{ padding: '11px 12px', borderRadius: 13 }}
            >
              {i === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {statsIn && <HealthRing score={78} size={42} />}
                  <div style={{ minWidth: 0 }}>
                    <span style={statLabel}><Gauge size={11} /> Health</span>
                    <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>Held back by 2 unanswered</div>
                  </div>
                </div>
              ) : i === 1 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={statLabel}><MessagesSquare size={11} /> Conversations</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9.5, fontWeight: 700, color: 'var(--success)', background: 'var(--success-dim)', borderRadius: 6, padding: '1px 5px' }}>
                      <TrendingUp size={10} /> +12%
                    </span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--text-primary)' }}>
                    <CountUp to={48} active={statsIn} reduce={!!reduce} />
                  </div>
                  <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text-muted)' }}>9 active this week</div>
                </>
              ) : (
                <>
                  <span style={statLabel}><Flame size={11} /> High priority</span>
                  <div style={{ marginTop: 8, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--hot)' }}>
                    <CountUp to={3} active={statsIn} reduce={!!reduce} />
                  </div>
                  <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text-muted)' }}>2 urgent · 1 high</div>
                </>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* AI Command Center — next best action lands */}
        <AnimatePresence>
          {commandIn && (
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              transition={SPRING.panel}
              className="widget" style={{ borderRadius: 14 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(79,92,244,0.15)', flexShrink: 0 }}>
                  <Sparkles size={11} />
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>AI Command Center</span>
                <span className="module-pill" style={{ marginLeft: 'auto', fontSize: 8.5, color: 'var(--success)', background: 'var(--success-dim)', border: '1px solid var(--success-border)' }}>LIVE</span>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(79,92,244,0.06), rgba(124,77,255,0.05))', border: '1px solid rgba(79,92,244,0.2)', borderRadius: 11, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Zap size={10} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--accent)', textTransform: 'uppercase' }}>Next best action</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: 'var(--attention)', whiteSpace: 'nowrap' }}>waiting 2h</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 9.5, background: 'linear-gradient(135deg,#DC2B55,#F2709C)', color: '#fff' }}>AP</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Alex Peterson</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Project kickoff — full package</div>
                    </div>
                    <span className="cat-tag" style={{ flexShrink: 0, color: 'var(--text-secondary)' }}><UserRound size={10} /> Unassigned</span>
                    <span className="priority-badge priority-hot" style={{ fontSize: 8.5, flexShrink: 0 }}>Urgent</span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>AI suggests:</strong> Reply with a concrete start date — client is ready to buy.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Risk Monitor — a quiet client gets flagged */}
        <AnimatePresence>
          {riskIn && (
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              transition={SPRING.pop}
              className="widget" style={{ borderRadius: 13, padding: '10px 12px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <span style={{ width: 26, height: 26, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--attention-dim)', color: 'var(--attention)', border: '1px solid var(--attention-border)', flexShrink: 0 }}>
                <ShieldAlert size={13} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>Karina Lee is going quiet</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>No reply in 3 days — follow up before the deal cools</div>
              </div>
              <span className="priority-badge priority-attention" style={{ fontSize: 8.5, flexShrink: 0 }}>High</span>
            </motion.div>
          )}
        </AnimatePresence>
      </SceneBody>
    </div>
  )
}
