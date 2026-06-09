'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Sparkles, Check, ArrowRight, PartyPopper } from 'lucide-react'
import Cursor from './Cursor'

/* ── Static data ──────────────────────────────────────────────────────────── */
const CONVS = [
  { ini: 'AP', bg: 'rgba(220,43,85,0.1)', col: '#DC2B55', name: 'Alex Peterson', priority: 'HOT',  cls: 'priority-hot',       preview: 'Sounds good, the price works. When could we start?', meta: 'Telegram · 2m', unread: 3 },
  { ini: 'KL', bg: 'rgba(194,98,10,0.1)', col: '#C2620A', name: 'Karina Lee',    priority: 'ATTN', cls: 'priority-attention', preview: 'Still thinking it over, need to check with my team…', meta: 'Gmail · 3h',    unread: 1 },
  { ini: 'MJ', bg: 'rgba(79,92,244,0.1)', col: '#4F5CF4', name: 'Mark Johnson',  priority: 'COLD', cls: 'priority-cold',      preview: "Thanks, I'll follow up later. Busy right now.",        meta: 'Telegram · 1d', unread: 0 },
]

const BASE_MESSAGES = [
  { out: false, text: 'Hi! Saw your proposal — is the full package $3,800?', time: '14:30' },
  { out: true,  text: 'Yes — that covers full setup and a 2-year warranty.', time: '14:35' },
  { out: false, text: 'Sounds good, the price works. When could we start?', time: '14:52' },
]

const SUGGESTED = 'Perfect — we can start this Monday. I’ll send the onboarding details now. Welcome aboard! 🎉'
const CLIENT_REPLY = 'Amazing, Monday works for us. Let’s do it! 🙌'

/* Timeline: cumulative step machine. Each entry = ms the step is held. */
const DURATIONS = [1500, 1100, 1700, 1900, 950, 520, 950, 1100, 1300, 2600]
//                idle  hover analyz suggest move click sent  typing reply  won/hold

export default function ProductDemo() {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)

  const sceneRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const sendRef = useRef<HTMLButtonElement>(null)

  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false })

  /* Advance the timeline (looping). Reduced motion → hold the final frame. */
  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => setStep(s => (s + 1) % DURATIONS.length), DURATIONS[step])
    return () => clearTimeout(t)
  }, [step, reduce])

  // When the user prefers reduced motion, render the resolved final frame.
  const s = reduce ? 9 : step

  /* Drive the cursor toward the relevant element for the current step. */
  useLayoutEffect(() => {
    if (reduce) return
    const scene = sceneRef.current
    if (!scene) return
    const sr = scene.getBoundingClientRect()

    const center = (el: HTMLElement | null, fallback: { x: number; y: number }) => {
      if (!el) return fallback
      const r = el.getBoundingClientRect()
      return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 }
    }
    const parked = { x: sr.width * 0.78, y: sr.height * 0.84 }

    let target = parked
    if (step >= 1 && step <= 3) target = center(chatRef.current, parked)
    else if (step >= 4 && step <= 5) target = center(sendRef.current, parked)
    else if (step >= 6) target = parked

    setCursor({ x: target.x, y: target.y, visible: true })
  }, [step, reduce])

  const hoveringChat = s >= 1 && s <= 3
  const analyzing = s === 2
  const showSuggestion = s >= 3 && s <= 5
  const clicking = s === 5
  const sentVisible = s >= 6
  const clientTyping = s === 7
  const clientReplyVisible = s >= 8
  const won = s >= 9

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div ref={sceneRef} className="scene">
        {/* Browser chrome */}
        <div style={{ padding: '10px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
          </div>
          <div style={{ flex: 1, maxWidth: 240, height: 26, borderRadius: 6, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(79,92,244,0.4)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>flo.app/inbox</span>
          </div>
        </div>

        {/* App layout */}
        <div className="demo-app-layout" style={{ display: 'flex' }}>
          {/* Sidebar */}
          <div className="demo-sidebar" style={{ width: 200, borderRight: '1px solid var(--border-light)', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0, background: 'var(--bg-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>flo</span>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', marginBottom: 7, display: 'inline-block' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[{ label: 'Inbox', active: true, count: 3 }, { label: 'Integrations', active: false }, { label: 'Settings', active: false }].map(item => (
                <div key={item.label} style={{ padding: '7px 10px', borderRadius: 8, background: item.active ? 'var(--accent-dim)' : 'transparent', color: item.active ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 13, fontWeight: item.active ? 600 : 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {item.label}
                  {item.count && <span style={{ background: 'var(--accent)', color: '#fff', width: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.count}</span>}
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', background: 'var(--bg-elevated)', borderRadius: 9, border: '1px solid var(--border-light)' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#4b6bff,#9b6bff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>AM</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Amir</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Team Lead</div>
              </div>
            </div>
          </div>

          {/* Conversation list */}
          <div className="demo-conv-list" style={{ borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Inbox</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>3 conversations</span>
            </div>
            {CONVS.map((c, i) => {
              const selected = i === 0
              const isHot = i === 0
              return (
                <div
                  key={i}
                  ref={isHot ? chatRef : undefined}
                  style={{
                    padding: '11px 14px', borderBottom: i < 2 ? '1px solid var(--border-light)' : 'none',
                    background: selected ? 'rgba(79,92,244,0.06)' : (isHot && hoveringChat ? 'var(--bg-hover)' : '#FFFFFF'),
                    borderLeft: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`,
                    display: 'flex', gap: 10, alignItems: 'flex-start', transition: 'background 0.2s',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.bg, color: c.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{c.ini}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      <span className={`priority-badge ${isHot && won ? 'priority-cold' : c.cls}`} style={{ fontSize: 9 }}>{isHot && won ? 'WON' : c.priority}</span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>{c.preview}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.meta}</span>
                      {c.unread > 0 && <span style={{ width: 17, height: 17, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Thread + AI */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-subtle)' }}>
            {/* Thread header + AI panel */}
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-light)', background: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Alex Peterson</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Telegram · last message 2 minutes ago</div>
                </div>
                <span className={`priority-badge ${won ? 'priority-cold' : 'priority-hot'}`}>{won ? 'WON' : 'HOT'}</span>
              </div>

              {/* Zoom + crossfade to accentuate the AI as it works. */}
              <motion.div
                animate={{ scale: analyzing ? 1.04 : 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                style={{ transformOrigin: 'center top' }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={won ? 'won' : analyzing ? 'analyzing' : 'risk'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <AIPanel analyzing={analyzing} won={won} />
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', position: 'relative' }}>
              {BASE_MESSAGES.map((m, i) => (
                <Bubble key={i} out={m.out} text={m.text} time={m.time} />
              ))}

              <AnimatePresence>
                {sentVisible && (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
                  >
                    <div className="msg-bubble msg-bubble-out" style={{ maxWidth: '78%', fontSize: 13 }}>{SUGGESTED}</div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      14:53 <Check size={11} style={{ color: 'var(--accent)' }} />
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {clientTyping && (
                  <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div style={{ display: 'inline-flex', gap: 4, padding: '11px 14px', borderRadius: '13px 13px 13px 3px', background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
                      <span className="typing-dot" /><span className="typing-dot" style={{ animationDelay: '0.15s' }} /><span className="typing-dot" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {clientReplyVisible && (
                  <motion.div
                    key="reply"
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                  >
                    <div className="msg-bubble msg-bubble-in" style={{ maxWidth: '78%', fontSize: 13 }}>{CLIENT_REPLY}</div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>14:54</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {won && <Confetti />}
            </div>

            {/* AI suggestion composer */}
            <AnimatePresence>
              {showSuggestion && (
                <motion.div
                  key="suggestion"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 24 }}
                  style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)', background: '#FFFFFF' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Sparkles size={12} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>AI suggested reply</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                    <div style={{ flex: 1, padding: '9px 12px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {SUGGESTED}
                    </div>
                    <motion.button
                      ref={sendRef}
                      animate={{ scale: clicking ? 0.94 : 1, boxShadow: clicking ? '0 0 0 4px rgba(79,92,244,0.18)' : '0 1px 3px rgba(79,92,244,0.3)' }}
                      className="btn-primary"
                      style={{ padding: '9px 16px', fontSize: 12.5, flexShrink: 0 }}
                    >
                      Send <ArrowRight size={13} />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {!reduce && <Cursor x={cursor.x} y={cursor.y} visible={cursor.visible} clicking={clicking} />}
      </div>
    </div>
  )
}

/* ── AI panel (analyzing → risk → won) ────────────────────────────────────── */
function AIPanel({ analyzing, won }: { analyzing: boolean; won: boolean }) {
  if (won) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        style={{ padding: '10px 13px', borderRadius: 9, background: 'rgba(40,200,100,0.08)', border: '1px solid rgba(40,170,90,0.25)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <PartyPopper size={14} style={{ color: '#16A34A' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', letterSpacing: '0.04em' }}>Deal won — client confirmed</span>
        </div>
      </motion.div>
    )
  }
  if (analyzing) {
    return (
      <div className="ai-shimmer" style={{ padding: '10px 13px', borderRadius: 9, border: '1px solid rgba(79,92,244,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={13} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--accent)' }}>AI is analyzing this conversation</span>
          <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
            <span className="typing-dot" style={{ background: 'var(--accent)' }} />
            <span className="typing-dot" style={{ background: 'var(--accent)', animationDelay: '0.15s' }} />
            <span className="typing-dot" style={{ background: 'var(--accent)', animationDelay: '0.3s' }} />
          </span>
        </div>
      </div>
    )
  }
  return (
    <div style={{ padding: '10px 13px', borderRadius: 9, background: 'rgba(220,43,85,0.05)', border: '1px solid rgba(220,43,85,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2B55', animation: 'pulse 2s ease-in-out infinite' }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2B55', letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI · HIGH RISK</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 5px', lineHeight: 1.5 }}>Client is ready to buy. A delay over 2h will reduce conversion.</p>
      <p style={{ fontSize: 12, color: 'var(--accent)', margin: 0, fontWeight: 600 }}>→ Reply with a concrete start date</p>
    </div>
  )
}

/* ── Static message bubble ────────────────────────────────────────────────── */
function Bubble({ out, text, time }: { out: boolean; text: string; time: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: out ? 'flex-end' : 'flex-start' }}>
      <div className={`msg-bubble ${out ? 'msg-bubble-out' : 'msg-bubble-in'}`} style={{ maxWidth: '78%', fontSize: 13 }}>{text}</div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{time}</span>
    </div>
  )
}

/* ── Confetti burst on win ────────────────────────────────────────────────── */
// Deterministic pseudo-random so the confetti is stable across renders
// (avoids Math.random() during render, which React's purity rule forbids).
const seeded = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({
      id: i,
      x: (seeded(i + 1) - 0.5) * 260,
      y: -60 - seeded(i + 2) * 120,
      rot: seeded(i + 3) * 360,
      color: ['#4F5CF4', '#7C4DFF', '#16A34A', '#FEBC2E', '#DC2B55'][i % 5],
      delay: seeded(i + 4) * 0.15,
      size: 6 + seeded(i + 5) * 5,
    })),
    [],
  )
  return (
    <div style={{ position: 'absolute', left: '50%', top: '55%', width: 0, height: 0, pointerEvents: 'none' }}>
      {pieces.map(p => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rot }}
          transition={{ duration: 1.4, delay: p.delay, ease: 'easeOut' }}
          style={{ position: 'absolute', width: p.size, height: p.size * 0.6, borderRadius: 1, background: p.color }}
        />
      ))}
    </div>
  )
}
