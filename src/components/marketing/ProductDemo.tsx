'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  motion, AnimatePresence, useReducedMotion,
  useMotionValue, useSpring, useTransform,
} from 'framer-motion'
import {
  Sparkles, Check, Send, Search, UserRound, ChevronDown, RotateCcw, PencilLine,
  LayoutDashboard, Inbox as InboxIcon, Users, Lightbulb, ShieldAlert, ChartColumn,
  Bot, ArrowDownWideNarrow, type LucideIcon,
} from 'lucide-react'
import Cursor from './Cursor'
import { SPRING, bubbleIn, lineStagger, lineIn } from './demo-motion'

/* ── Static data — mirrors the real shared-inbox /inbox page ───────────────── */
const ALEX_GRAD = 'linear-gradient(135deg,#DC2B55,#F2709C)'

const CONVS = [
  {
    grad: ALEX_GRAD, ini: 'AP', name: 'Alex Peterson',
    subject: 'Project kickoff — full package', preview: 'Is the full package $3,800? And when could we start?',
    time: '2m', badge: 'Urgent', cls: 'priority-hot', unread: 2,
  },
  {
    grad: 'linear-gradient(135deg,#C2620A,#F6A23B)', ini: 'KL', name: 'Karina Lee',
    subject: 'Proposal follow-up', preview: 'Still checking with my team…',
    time: '3h', badge: 'High', cls: 'priority-attention', unread: 0, assignee: 'Priya',
  },
  {
    grad: 'linear-gradient(135deg,#4F5CF4,#7C4DFF)', ini: 'MJ', name: 'Mark Johnson',
    subject: 'Invoice #214', preview: "Thanks, I'll follow up later.",
    time: '1d', badge: null, cls: '', unread: 0, assignee: 'You',
  },
]

/* Icon-only platform nav — the real shell's sidebar, collapsed for the scene. */
const NAV_ICONS: { icon: LucideIcon; active?: boolean }[] = [
  { icon: LayoutDashboard },
  { icon: InboxIcon, active: true },
  { icon: Users },
  { icon: Lightbulb },
  { icon: ShieldAlert },
  { icon: ChartColumn },
  { icon: Bot },
]

const BASE_MESSAGES = [
  { out: false, text: 'Thanks for the proposal — it looks great.', time: '9:18 AM' },
  { out: false, text: 'Quick one: is the full package $3,800? And when could we start?', time: '9:24 AM', cont: true },
]

const SUGGESTED =
  "Hi Alex — yes, the full package is $3,800 (full setup + a 2-year warranty). We can kick off this Monday; I'll send the onboarding details today. Excited to get started! 🎉"
const CLIENT_REPLY = "Perfect — Monday works for us. Let's do it! 🙌"

/* Timeline: cumulative step machine. Each entry = ms the step is held.
 * 0 idle · 1 analyzing · 2 insight · 3 assign · 4 note · 5 draft · 6 send ·
 * 7 client typing · 8 reply · 9 resolved */
const DURATIONS = [1600, 1300, 1900, 1350, 1900, 2400, 950, 1100, 1800, 2900]

export default function ProductDemo() {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)

  const sceneRef = useRef<HTMLDivElement>(null)
  const aiToolRef = useRef<HTMLButtonElement>(null)
  const sendRef = useRef<HTMLButtonElement>(null)

  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false })

  /* Gentle pointer-follow tilt so the scene reads as a physical surface. */
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [1.6, -1.6]), { stiffness: 140, damping: 22 })
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-2, 2]), { stiffness: 140, damping: 22 })

  const onTilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  const resetTilt = () => { px.set(0); py.set(0) }

  /* Advance the timeline (looping). Reduced motion → hold the final frame. */
  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => setStep(s => (s + 1) % DURATIONS.length), DURATIONS[step])
    return () => clearTimeout(t)
  }, [step, reduce])

  // When the user prefers reduced motion, render the resolved final frame.
  const s = reduce ? 9 : step

  /* The AI "drafts" the reply character by character during step 5. The counter
   * resets via rAF (not synchronously in the effect body); the one stale frame
   * is invisible because the composer text mounts from the placeholder. */
  const [draftChars, setDraftChars] = useState(0)
  useEffect(() => {
    if (reduce || step !== 5) return
    let c = 0
    const raf = requestAnimationFrame(() => setDraftChars(0))
    const id = setInterval(() => {
      c += 3
      setDraftChars(Math.min(c, SUGGESTED.length))
      if (c >= SUGGESTED.length) clearInterval(id)
    }, 22)
    return () => { cancelAnimationFrame(raf); clearInterval(id) }
  }, [step, reduce])

  const analyzing = s === 1
  const insightShown = s >= 2
  const assigned = s >= 3
  const noteShown = s >= 4
  const draftInComposer = s === 5
  const sentVisible = s >= 6
  const clientTyping = s === 7
  const replyVisible = s >= 8
  const resolved = s >= 9

  const typedDone = reduce || draftChars >= SUGGESTED.length
  const draftText = draftInComposer ? (reduce ? SUGGESTED : SUGGESTED.slice(0, draftChars)) : ''

  /* Drive the cursor toward the relevant control for the current step. Measured
   * twice more after the camera spring settles (rects move while it glides). */
  useLayoutEffect(() => {
    if (reduce) return
    const measure = () => {
      const scene = sceneRef.current
      if (!scene) return
      const sr = scene.getBoundingClientRect()
      const center = (el: HTMLElement | null, fallback: { x: number; y: number }) => {
        if (!el) return fallback
        const r = el.getBoundingClientRect()
        return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 }
      }
      const parked = { x: sr.width * 0.74, y: sr.height * 0.86 }
      let target = parked
      if (step === 5) target = center(aiToolRef.current, parked)
      else if (step === 6) target = center(sendRef.current, parked)
      setCursor({ x: target.x, y: target.y, visible: true })
    }
    measure()
    const t1 = setTimeout(measure, 450)
    const t2 = setTimeout(measure, 900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [step, reduce])

  /* Alex's list row mirrors the app: assignee flips to You, the preview/time
   * update once the reply is sent, unread clears, Urgent → Won on resolve. */
  const alexAssignee = assigned ? 'You' : null
  const alexPreview = replyVisible ? CLIENT_REPLY : sentVisible ? `You: ${SUGGESTED.replace(' 🎉', '')}` : CONVS[0].preview
  const alexTime = sentVisible ? 'now' : CONVS[0].time

  return (
    <div style={{ position: 'relative', width: '100%', perspective: 1400 }} onPointerMove={onTilt} onPointerLeave={resetTilt}>
      <motion.div ref={sceneRef} className="scene" style={{ rotateX, rotateY }}>
        {/* Browser chrome */}
        <div style={{ padding: '10px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
          </div>
          <div style={{ flex: 1, maxWidth: 240, height: 26, borderRadius: 6, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(79,92,244,0.4)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>usevelnox.com/inbox</span>
          </div>
        </div>

        {/* App layout — full static frame (no camera dolly) */}
        <div className="demo-app-layout" style={{ display: 'flex' }}>
          {/* Icon nav — the real platform sidebar, collapsed */}
          <div
            className="demo-icon-nav"
            style={{ width: 54, borderRight: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '14px 0', flexShrink: 0 }}
          >
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', marginBottom: 12 }} />
            {NAV_ICONS.map((n, i) => (
              <span
                key={i}
                style={{
                  width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: n.active ? 'var(--accent-dim)' : 'transparent',
                  color: n.active ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <n.icon size={15} />
              </span>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#4b6bff,#9b6bff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: '#fff' }}>A</div>
          </div>

          {/* Conversation list — search, filter chips, mailbox group, rows */}
          <div
            className="demo-conv-list"
            style={{ borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', background: '#FFFFFF', overflow: 'hidden' }}
          >
            <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Inbox</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>3</span>
              </div>

              <div className="inbox-search" style={{ padding: '6px 9px', marginBottom: 9 }}>
                <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>Search conversations…</span>
                <span className="inbox-search-badge"><Sparkles size={9} /> AI · beta</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className="fchip active" style={{ fontSize: 10.5, padding: '3px 9px' }}>All <span className="fchip-count">3</span></span>
                <span className="fchip" style={{ fontSize: 10.5, padding: '3px 9px' }}><span className="fchip-dot" style={{ background: 'var(--hot)' }} />Urgent <span className="fchip-count">1</span></span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                  <ArrowDownWideNarrow size={11} /> Priority
                </span>
              </div>
            </div>

            <div className="inbox-group-head" style={{ padding: '9px 14px', cursor: 'default' }}>
              <span className="inbox-group-dot" style={{ background: '#EA4335' }} />
              <span className="inbox-group-label" style={{ fontSize: 11 }}>support@acme.co</span>
              <span className="inbox-group-count">3</span>
              <ChevronDown size={13} className="inbox-group-chevron" />
            </div>

            {CONVS.map((c, i) => {
              const isHot = i === 0
              const selected = isHot
              const preview = isHot ? alexPreview : c.preview
              const time = isHot ? alexTime : c.time
              const assignee = isHot ? alexAssignee : c.assignee
              const unreadGone = isHot && sentVisible
              return (
                <div
                  key={i}
                  className={`conv-item${selected ? ' selected' : ''}`}
                  style={{ padding: '10px 12px', gap: 9, cursor: 'default' }}
                >
                  <div className="avatar" style={{ background: c.grad, color: '#fff', width: 32, height: 32, fontSize: 10.5 }}>{c.ini}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{c.name}</span>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span key={time} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {time}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                    <p style={{ margin: '1px 0 0', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.45 }}>{c.subject}</p>

                    {assignee && (
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={assignee}
                          initial={isHot ? { opacity: 0, scale: 0.7 } : false}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={SPRING.snap}
                          className="cat-tag"
                          style={{ marginTop: 4, color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}
                        >
                          <UserRound size={10} /> {assignee}
                        </motion.span>
                      </AnimatePresence>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.p key={preview} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} style={{ flex: 1, margin: 0, color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5, minWidth: 0 }}>
                          {preview}
                        </motion.p>
                      </AnimatePresence>
                      {isHot ? (
                        <FlipBadge won={resolved} fontSize={9} />
                      ) : c.badge ? (
                        <span className={`priority-badge ${c.cls}`} style={{ fontSize: 9, flexShrink: 0 }}>{c.badge}</span>
                      ) : null}
                      <AnimatePresence>
                        {c.unread > 0 && !unreadGone && (
                          <motion.span
                            exit={{ scale: 0, opacity: 0 }}
                            transition={SPRING.snap}
                            style={{ background: 'var(--accent)', color: '#fff', minWidth: 16, height: 16, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, padding: '0 4px', flexShrink: 0 }}
                          >
                            {c.unread}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Thread pane — slim header + email-style message cards + composer */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-subtle)' }}>
            {/* Slim identity header — no priority badge, no AI banner (those live in the rail) */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: '#FFFFFF', flexShrink: 0 }}>
              <div className="chat-id">
                <div className="chat-avatar" style={{ width: 36, height: 36, fontSize: 12, background: ALEX_GRAD }}>AP</div>
                <div className="chat-id-text">
                  <h2 className="chat-name" style={{ fontSize: 14 }}>Alex Peterson</h2>
                  <div className="chat-sub" style={{ marginTop: 3 }}>
                    <span className="chat-chip" style={{ fontSize: 10, padding: '1px 7px' }}>Gmail</span>
                    <span className="chat-email" style={{ fontSize: 11 }}>alex@peterson.co</span>
                    <span className="chat-subject" style={{ fontSize: 11 }}>Project kickoff</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages — pinned to the bottom like a scrolled thread */}
            <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden', position: 'relative' }}>
              <div className="chat-day-sep" style={{ marginBottom: 2, flexShrink: 0 }}><span>Today</span></div>

              {BASE_MESSAGES.map((m, i) => (
                <DemoCard key={i} out={m.out} cont={!!m.cont} sender="Alex Peterson" ini="AP" text={m.text} time={m.time} />
              ))}

              <AnimatePresence>
                {sentVisible && (
                  <motion.div key="sent" layout="position" {...bubbleIn} transition={SPRING.pop} style={{ flexShrink: 0 }}>
                    <DemoCard out sender="You" text={SUGGESTED} time="just now" sending />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                {clientTyping && (
                  <motion.div
                    key="typing"
                    layout="position"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.16 } }}
                    transition={SPRING.pop}
                    style={{ display: 'inline-flex', gap: 4, marginTop: 12, padding: '11px 14px', borderRadius: 12, background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', alignSelf: 'flex-start', flexShrink: 0 }}
                  >
                    <span className="typing-dot" /><span className="typing-dot" style={{ animationDelay: '0.15s' }} /><span className="typing-dot" style={{ animationDelay: '0.3s' }} />
                  </motion.div>
                )}
                {replyVisible && (
                  <motion.div key="reply" layout="position" {...bubbleIn} transition={SPRING.pop} style={{ flexShrink: 0 }}>
                    <DemoCard out={false} sender="Alex Peterson" ini="AP" text={CLIENT_REPLY} time="just now" />
                  </motion.div>
                )}
              </AnimatePresence>

              {resolved && <Confetti />}
            </div>

            {/* Composer — redesigned single block; the AI fills it in (review before send) */}
            <div className="composer" style={{ padding: '10px 14px 12px', flexShrink: 0 }}>
              <div
                className="composer-block"
                style={{
                  padding: '7px 7px 7px 12px',
                  borderColor: draftInComposer ? 'var(--accent)' : undefined,
                  boxShadow: draftInComposer ? '0 0 0 3px rgba(79,92,244,0.1)' : undefined,
                }}
              >
                <div className="composer-row" style={{ alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.5, padding: '4px 0', minHeight: 21, color: draftText ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {draftText || 'Write a reply…'}
                    {draftInComposer && !typedDone && <span className="animate-blink" style={{ color: 'var(--accent)' }}>|</span>}
                  </div>
                  <motion.button
                    ref={sendRef}
                    className="composer-send"
                    animate={{
                      scale: s === 6 ? 0.86 : 1,
                      opacity: draftText ? 1 : 0.45,
                      boxShadow: s === 6 ? '0 0 0 4px rgba(79,92,244,0.18)' : '0 0 0 0px rgba(79,92,244,0)',
                    }}
                    transition={{ scale: SPRING.snap, opacity: { duration: 0.25 } }}
                    style={{ width: 30, height: 30 }}
                  >
                    <Send size={13} />
                  </motion.button>
                </div>

                <div className="composer-tools" style={{ marginTop: 7, paddingTop: 7 }}>
                  <motion.button
                    ref={aiToolRef}
                    type="button"
                    className="composer-tool composer-tool-ai"
                    animate={{ scale: s === 5 ? 0.95 : 1 }}
                    transition={SPRING.snap}
                    style={{ fontSize: 10.5, padding: '4px 9px' }}
                  >
                    {draftInComposer && !typedDone ? (
                      <>
                        <Sparkles size={11} className="animate-pulse-s" /> Drafting…
                      </>
                    ) : sentVisible ? (
                      <><RotateCcw size={11} /> Regenerate</>
                    ) : (
                      <><Sparkles size={11} /> AI draft</>
                    )}
                  </motion.button>
                  <span className="composer-tone-btn" style={{ fontSize: 10.5, padding: '4px 9px' }}>
                    Warm <ChevronDown size={11} />
                  </span>
                  <span className="composer-tool" style={{ fontSize: 10.5, padding: '4px 9px' }}>
                    <PencilLine size={11} /> Steer
                  </span>
                  <AnimatePresence>
                    {draftInComposer && (
                      <motion.span
                        initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        className="composer-ai-label" style={{ marginLeft: 'auto', color: 'var(--accent)', fontStyle: 'normal', fontWeight: 600 }}
                      >
                        Review before send
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* Context rail — the single AI surface + thread properties + team notes.
              Hidden on phones (.demo-context-rail) so the thread pane isn't crushed. */}
          <div
            className="demo-context-rail"
            style={{ width: 232, flexShrink: 0, borderLeft: '1px solid var(--border)', background: '#FFFFFF', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            {/* AI insight */}
            <section className="rail-section" style={{ padding: '13px 14px' }}>
              <div className="rail-ai-head" style={{ marginBottom: 8 }}>
                <span className="rail-ai-icon" style={{ width: 20, height: 20 }}><Sparkles size={12} /></span>
                <span className="rail-ai-title" style={{ fontSize: 11.5 }}>AI insight</span>
                <AnimatePresence>
                  {insightShown && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                      transition={SPRING.snap}
                      className="rail-risk" style={{ color: 'var(--hot)', fontSize: 10.5 }}
                    >
                      <span className="rail-risk-dot" style={{ background: 'var(--hot)' }} />
                      High risk
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait">
                {analyzing ? (
                  <motion.div
                    key="analyzing"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="ai-shimmer" style={{ borderRadius: 8, padding: '9px 11px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <Sparkles size={12} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>Analyzing…</span>
                  </motion.div>
                ) : insightShown ? (
                  <motion.div key="insight" initial="hidden" animate="visible" variants={lineStagger}>
                    <motion.p variants={lineIn} className="rail-ai-summary" style={{ fontSize: 12 }}>Client is ready to buy — confirm the price and a start date.</motion.p>
                    <motion.p variants={lineIn} className="rail-ai-action" style={{ fontSize: 12, margin: 0 }}>→ Reply with a concrete start date</motion.p>
                  </motion.div>
                ) : (
                  <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Not analyzed yet. Insight appears after the next sync.
                  </motion.p>
                )}
              </AnimatePresence>
            </section>

            {/* Properties */}
            <section className="rail-section" style={{ padding: '13px 14px' }}>
              <h3 className="rail-label" style={{ marginBottom: 9 }}>Properties</h3>

              <div className="rail-prop" style={{ marginBottom: 8 }}>
                <span className="rail-prop-k" style={{ width: 48, fontSize: 11 }}>Assignee</span>
                <div className="rail-prop-v">
                  <div className="rail-select" style={{ padding: '5px 9px', fontSize: 11.5 }}>
                    <UserRound size={12} />
                    <span className="rail-select-label">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={assigned ? 'you' : 'unassigned'}
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                          transition={SPRING.snap}
                          style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: assigned ? 'var(--text-primary)' : 'var(--text-muted)' }}
                        >
                          {assigned ? 'You' : 'Unassigned'}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    <ChevronDown size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                </div>
              </div>

              <div className="rail-prop" style={{ marginBottom: 8 }}>
                <span className="rail-prop-k" style={{ width: 48, fontSize: 11 }}>Status</span>
                <div className="rail-seg">
                  {(['Open', 'Snoozed', 'Closed'] as const).map(label => {
                    const active = resolved ? label === 'Closed' : label === 'Open'
                    return (
                      <span key={label} className="rail-seg-btn" data-active={active} style={{ fontSize: 10, padding: '5px 0', textAlign: 'center' }}>{label}</span>
                    )
                  })}
                </div>
              </div>

              <div className="rail-prop" style={{ marginBottom: 0 }}>
                <span className="rail-prop-k" style={{ width: 48, fontSize: 11 }}>Tags</span>
                <div className="rail-prop-v">
                  <span className="rail-tag-chip" style={{ color: '#DC2B55', background: '#DC2B551a', borderColor: '#DC2B5555', fontSize: 10.5 }}>Hot lead</span>
                </div>
              </div>
            </section>

            {/* Internal notes — team only */}
            <section className="rail-section" style={{ padding: '13px 14px', borderBottom: 'none' }}>
              <h3 className="rail-label" style={{ marginBottom: 9 }}>Internal notes <span className="rail-label-hint">· only your team</span></h3>
              <AnimatePresence>
                {noteShown ? (
                  <motion.div
                    key="note"
                    initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={SPRING.pop}
                    className="rail-note" style={{ padding: '7px 9px' }}
                  >
                    <div className="rail-note-head">
                      <span className="rail-note-author" style={{ fontSize: 11 }}>Priya</span>
                      <span className="rail-note-time" style={{ fontSize: 10 }}>just now</span>
                    </div>
                    <p className="rail-note-body" style={{ fontSize: 11.5 }}>Pricing approved ✅ — green light to close.</p>
                  </motion.div>
                ) : (
                  <motion.p key="note-empty" exit={{ opacity: 0 }} style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Add an internal note…
                  </motion.p>
                )}
              </AnimatePresence>
            </section>
          </div>
        </div>

        {!reduce && <Cursor x={cursor.x} y={cursor.y} visible={cursor.visible} clicking={s === 6} />}
      </motion.div>
    </div>
  )
}

/* ── Email-style message card (visual copy of the real .msg-card) ─────────── */
function DemoCard({
  out, cont, sender, ini, text, time, sending,
}: {
  out: boolean; cont?: boolean; sender: string; ini?: string; text: string; time: string; sending?: boolean
}) {
  return (
    <article className={`msg-card ${out ? 'out' : 'in'}${cont ? ' cont' : ''}`} style={{ marginTop: cont ? 6 : 12, flexShrink: 0 }}>
      <header className="msg-card-head" style={{ padding: '9px 13px 0' }}>
        <span className={`msg-avatar ${out ? 'out' : 'in'}`} style={{ width: 26, height: 26, fontSize: 10 }} aria-hidden>
          {out ? <UserRound size={13} /> : ini}
        </span>
        <span className="msg-sender" style={{ fontSize: 12 }}>{sender}</span>
        <time className="msg-time" style={{ fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {time}
          {sending && <Check size={11} style={{ color: 'var(--accent)' }} />}
        </time>
      </header>
      <div className="msg-body" style={{ padding: '5px 13px 11px', fontSize: 12 }}>{text}</div>
    </article>
  )
}

/* ── Priority badge that flips Urgent → Won with a spring ─────────────────── */
function FlipBadge({ won, fontSize }: { won: boolean; fontSize?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={won ? 'won' : 'urgent'}
          initial={{ opacity: 0, scale: 0.55, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 8 }}
          transition={SPRING.snap}
          className={`priority-badge ${won ? 'priority-cold' : 'priority-hot'}`}
          style={fontSize ? { fontSize } : undefined}
        >
          {won ? 'Won' : 'Urgent'}
        </motion.span>
      </AnimatePresence>
    </span>
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
    () => Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: (seeded(i + 1) - 0.5) * 280,
      y: -70 - seeded(i + 2) * 130,
      rot: seeded(i + 3) * 360,
      color: ['#4F5CF4', '#7C4DFF', '#16A34A', '#FEBC2E', '#DC2B55'][i % 5],
      delay: seeded(i + 4) * 0.18,
      size: 6 + seeded(i + 5) * 5,
    })),
    [],
  )
  return (
    <div style={{ position: 'absolute', left: '50%', top: '45%', width: 0, height: 0, pointerEvents: 'none' }}>
      {pieces.map(p => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.6 }}
          animate={{
            x: [0, p.x * 0.7, p.x],
            y: [0, p.y, p.y + 120],
            opacity: [0, 1, 0],
            rotate: [0, p.rot, p.rot * 1.6],
            scale: [0.6, 1, 0.9],
          }}
          transition={{ duration: 1.6, delay: p.delay, times: [0, 0.45, 1], ease: ['easeOut', 'easeIn'] }}
          style={{ position: 'absolute', width: p.size, height: p.size * 0.6, borderRadius: 1, background: p.color }}
        />
      ))}
    </div>
  )
}
