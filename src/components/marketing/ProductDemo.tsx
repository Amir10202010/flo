'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  motion, AnimatePresence, useReducedMotion,
  useMotionValue, useSpring, useTransform,
} from 'framer-motion'
import {
  Sparkles, Check, PartyPopper, Send, Search,
  LayoutDashboard, Inbox as InboxIcon, Users, Lightbulb, ShieldAlert, ChartColumn,
  Bot, Plug, Settings, ArrowDownWideNarrow, ChevronDown, type LucideIcon,
} from 'lucide-react'
import Cursor from './Cursor'
import { SPRING, EASE_OUT, bubbleIn, lineStagger, lineIn } from './demo-motion'

/* ── Static data — mirrors the real /inbox page structures ────────────────── */
const CONVS = [
  {
    grad: 'linear-gradient(135deg,#DC2B55,#F2709C)', ini: 'AP', name: 'Alex Peterson',
    subject: 'Project kickoff — full package', preview: 'Sounds good, the price works. When could we start?',
    time: '2m', badge: 'Urgent', cls: 'priority-hot', unread: 3,
  },
  {
    grad: 'linear-gradient(135deg,#C2620A,#F6A23B)', ini: 'KL', name: 'Karina Lee',
    subject: 'Proposal follow-up', preview: 'Still thinking it over, need to check with my team…',
    time: '3h', badge: 'High', cls: 'priority-attention', unread: 1,
  },
  {
    grad: 'linear-gradient(135deg,#4F5CF4,#7C4DFF)', ini: 'MJ', name: 'Mark Johnson',
    subject: 'Invoice #214', preview: "Thanks, I'll follow up later. Busy right now.",
    time: '1d', badge: null, cls: '', unread: 0, // Normal rows stay quiet, like the real list
  },
]

const NAV_MAIN = [
  { label: 'Dashboard', icon: LayoutDashboard, active: false },
  { label: 'Inbox', icon: InboxIcon, active: true },
]
const NAV_INTEL = [
  { label: 'Clients', icon: Users },
  { label: 'Insights', icon: Lightbulb },
  { label: 'Risk Monitor', icon: ShieldAlert },
  { label: 'Analytics', icon: ChartColumn },
]
const NAV_SYSTEM = [
  { label: 'Integrations', icon: Plug },
  { label: 'Settings', icon: Settings },
]

const BASE_MESSAGES = [
  { out: false, text: 'Hi! Saw your proposal — is the full package $3,800?', time: '24m ago' },
  { out: true,  text: 'Yes — that covers full setup and a 2-year warranty.', time: '19m ago' },
  { out: false, text: 'Sounds good, the price works. When could we start?', time: '2m ago' },
]

const SUGGESTED = 'Perfect — we can start this Monday. I’ll send the onboarding details now. Welcome aboard! 🎉'
const CLIENT_REPLY = 'Amazing, Monday works for us. Let’s do it! 🙌'

/* Timeline: cumulative step machine. Each entry = ms the step is held. */
const DURATIONS = [1500, 1100, 1700, 2100, 950, 520, 950, 1100, 1300, 2600]
//                idle  hover analyz draft  move click sent  typing reply  won/hold

/* Camera rig: where the demo "looks" at each step. Subtle dolly moves toward
 * the active zone — AI panel while analyzing, composer while drafting, the
 * thread while messages land — then pulls back out for the win. */
function cameraFor(s: number) {
  if (s >= 1 && s <= 2) return { scale: 1.05, x: -14, y: 18 }   // AI panel (right pane, top)
  if (s >= 3 && s <= 5) return { scale: 1.05, x: -16, y: -22 }  // composer (right pane, bottom)
  if (s >= 6 && s <= 8) return { scale: 1.03, x: -12, y: -6 }   // message thread
  return { scale: 1, x: 0, y: 0 }
}

export default function ProductDemo() {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)

  const sceneRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
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

  /* The AI "drafts" the suggested reply character by character during step 3.
   * The counter resets via rAF (not synchronously in the effect body); the one
   * stale frame is invisible because the suggestion chip mounts at opacity 0. */
  const [draftChars, setDraftChars] = useState(0)
  useEffect(() => {
    if (reduce || step !== 3) return
    let c = 0
    const raf = requestAnimationFrame(() => setDraftChars(0))
    const id = setInterval(() => {
      c += 2
      setDraftChars(Math.min(c, SUGGESTED.length))
      if (c >= SUGGESTED.length) clearInterval(id)
    }, 26)
    return () => { cancelAnimationFrame(raf); clearInterval(id) }
  }, [step, reduce])

  const hoveringChat = s >= 1 && s <= 3
  const analyzing = s === 2
  const showSuggestion = s >= 3 && s <= 5
  const clicking = s === 5
  const sentVisible = s >= 6
  const clientTyping = s === 7
  const clientReplyVisible = s >= 8
  const won = s >= 9

  const typedDone = reduce || s > 3 || draftChars >= SUGGESTED.length
  const draft = showSuggestion ? (s > 3 || reduce ? SUGGESTED : SUGGESTED.slice(0, draftChars)) : ''

  /* Drive the cursor toward the relevant element for the current step.
   * Measured twice: immediately, and again once the camera spring has mostly
   * settled (rects move while the camera glides). */
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
      const parked = { x: sr.width * 0.78, y: sr.height * 0.84 }

      let target = parked
      if (step >= 1 && step <= 3) target = center(chatRef.current, parked)
      else if (step >= 4 && step <= 5) target = center(sendRef.current, parked)
      else if (step >= 6) target = parked

      setCursor({ x: target.x, y: target.y, visible: true })
    }
    measure()
    const t1 = setTimeout(measure, 450)
    const t2 = setTimeout(measure, 900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [step, reduce])

  /* Spotlight: while the AI works the chat pane, the nav chrome falls back. */
  const focusMode = s >= 2 && s <= 8

  /* List row for Alex mirrors what really happens in the app: once the reply
   * is sent the preview flips to "You: …", time resets and unread clears. */
  const alexPreview = clientReplyVisible ? CLIENT_REPLY : sentVisible ? `You: ${SUGGESTED}` : CONVS[0].preview
  const alexTime = sentVisible ? 'now' : CONVS[0].time

  return (
    <div style={{ position: 'relative', width: '100%', perspective: 1400 }} onPointerMove={onTilt} onPointerLeave={resetTilt}>
      <motion.div ref={sceneRef} className="scene" style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}>
        {/* Browser chrome */}
        <div style={{ padding: '10px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
          </div>
          <div style={{ flex: 1, maxWidth: 240, height: 26, borderRadius: 6, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(79,92,244,0.4)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>velnox.app/inbox</span>
          </div>
        </div>

        {/* App layout — wrapped in the camera rig */}
        <motion.div
          className="demo-app-layout demo-camera"
          animate={cameraFor(s)}
          transition={SPRING.camera}
          style={{ display: 'flex' }}
        >
          {/* Sidebar — compact copy of the real platform nav */}
          <motion.div
            className="demo-sidebar"
            animate={{ opacity: focusMode ? 0.45 : 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ width: 200, borderRight: '1px solid var(--border)', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, background: 'var(--bg-subtle)', overflow: 'hidden' }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>velnox</span>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', marginBottom: 7, display: 'inline-block' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 9, border: '1px solid var(--border)', background: '#FFFFFF', color: 'var(--text-muted)', fontSize: 11.5 }}>
              <Search size={12} />
              <span>Search</span>
              <span className="cmdk-kbd" style={{ marginLeft: 'auto', fontSize: 9 }}>⌘ K</span>
            </div>

            <div style={{ height: 4 }} />
            {NAV_MAIN.map(item => <DemoNavItem key={item.label} {...item} />)}

            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '10px 9px 3px' }}>Intelligence</div>
            {NAV_INTEL.map(item => <DemoNavItem key={item.label} {...item} />)}

            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '10px 9px 3px' }}>Assistant</div>
            <DemoNavItem label="AI Assistant" icon={Bot} pill="Beta" />

            <div style={{ flex: 1 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 6, borderBottom: '1px solid var(--border-light)', marginBottom: 6 }}>
              {NAV_SYSTEM.map(item => <DemoNavItem key={item.label} {...item} />)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', background: '#FFFFFF', borderRadius: 9, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#4b6bff,#9b6bff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>AM</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Amir</div>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>amir@company.com</div>
              </div>
            </div>
          </motion.div>

          {/* Conversation list — search, filter chips, mailbox group, rows */}
          <motion.div
            className="demo-conv-list"
            animate={{ opacity: focusMode ? 0.55 : 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
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
                <span className="fchip" style={{ fontSize: 10.5, padding: '3px 9px' }}><span className="fchip-dot" style={{ background: 'var(--attention)' }} />High <span className="fchip-count">1</span></span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                  <ArrowDownWideNarrow size={11} /> Priority
                </span>
              </div>
            </div>

            <div className="inbox-group-head" style={{ padding: '9px 14px', cursor: 'default' }}>
              <span className="inbox-group-dot" style={{ background: '#EA4335' }} />
              <span className="inbox-group-label" style={{ fontSize: 11 }}>amir@company.com</span>
              <span className="inbox-group-count">3</span>
              <ChevronDown size={13} className="inbox-group-chevron" />
            </div>

            {CONVS.map((c, i) => {
              const selected = i === 0
              const isHot = i === 0
              const preview = isHot ? alexPreview : c.preview
              const time = isHot ? alexTime : c.time
              const unreadGone = isHot && sentVisible
              return (
                <div
                  key={i}
                  ref={isHot ? chatRef : undefined}
                  className={`conv-item${selected ? ' selected' : ''}`}
                  style={{
                    padding: '10px 12px', gap: 9, cursor: 'default',
                    background: selected ? undefined : (isHot && hoveringChat ? 'var(--bg-hover)' : undefined),
                  }}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.p key={preview} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} style={{ flex: 1, margin: 0, color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5, minWidth: 0 }}>
                          {preview}
                        </motion.p>
                      </AnimatePresence>
                      {isHot ? (
                        <FlipBadge won={won} fontSize={9} />
                      ) : c.badge ? (
                        <span className={`priority-badge ${c.cls}`} style={{ fontSize: 9, flexShrink: 0 }}><span className="priority-dot" aria-hidden />{c.badge}</span>
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
          </motion.div>

          {/* Thread pane — chat header + AI insight + messages + composer */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-subtle)' }}>
            {/* Chat header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: '#FFFFFF', flexShrink: 0 }}>
              <div className="chat-head-row" style={{ gap: 10 }}>
                <div className="chat-avatar" style={{ width: 36, height: 36, fontSize: 12, background: CONVS[0].grad }}>AP</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Alex Peterson</div>
                  <div className="chat-sub" style={{ marginTop: 3 }}>
                    <span className="chat-chip" style={{ fontSize: 10, padding: '1px 7px' }}>Gmail</span>
                    <span className="chat-email" style={{ fontSize: 11 }}>alex@peterson.co</span>
                  </div>
                </div>
                <FlipBadge won={won} />
              </div>

              {/* AI insight panel — slight push-in + crossfade as the AI works */}
              <motion.div
                animate={{ scale: analyzing ? 1.02 : 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                style={{ transformOrigin: 'center top' }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={won ? 'won' : analyzing ? 'analyzing' : 'risk'}
                    initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                    transition={{ duration: 0.32, ease: EASE_OUT }}
                  >
                    <AIPanel analyzing={analyzing} won={won} />
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Messages — pinned to the bottom like a scrolled chat */}
            <div style={{ flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 0, overflow: 'hidden', position: 'relative' }}>
              <div className="chat-day-sep" style={{ marginBottom: 4 }}><span>Today</span></div>

              {BASE_MESSAGES.map((m, i) => (
                <motion.div key={i} layout="position" transition={SPRING.pop} className={`chat-row ${m.out ? 'out' : 'in'}`} style={{ marginTop: 10 }}>
                  <div className={`msg-bubble ${m.out ? 'msg-bubble-out' : 'msg-bubble-in'}`} style={{ maxWidth: '80%', fontSize: 12.5, padding: '8px 12px' }}>{m.text}</div>
                  <span className="chat-time">{m.time}</span>
                </motion.div>
              ))}

              <AnimatePresence>
                {sentVisible && (
                  <motion.div key="sent" layout="position" {...bubbleIn} transition={SPRING.pop} className="chat-row out" style={{ marginTop: 10 }}>
                    <div className="msg-bubble msg-bubble-out" style={{ maxWidth: '80%', fontSize: 12.5, padding: '8px 12px' }}>{SUGGESTED}</div>
                    <span className="chat-time" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      just now <Check size={11} style={{ color: 'var(--accent)' }} />
                    </span>
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
                    className="chat-row in" style={{ marginTop: 10 }}
                  >
                    <div style={{ display: 'inline-flex', gap: 4, padding: '10px 13px', borderRadius: '13px 13px 13px 3px', background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
                      <span className="typing-dot" /><span className="typing-dot" style={{ animationDelay: '0.15s' }} /><span className="typing-dot" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </motion.div>
                )}
                {clientReplyVisible && (
                  <motion.div key="reply" layout="position" {...bubbleIn} transition={SPRING.pop} className="chat-row in" style={{ marginTop: 10 }}>
                    <div className="msg-bubble msg-bubble-in" style={{ maxWidth: '80%', fontSize: 12.5, padding: '8px 12px' }}>{CLIENT_REPLY}</div>
                    <span className="chat-time">just now</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {won && <Confetti />}
            </div>

            {/* Composer — always present like the real app; the AI fills it in */}
            <div className="composer" style={{ padding: '9px 14px 11px', flexShrink: 0 }}>
              <AnimatePresence>
                {showSuggestion && (
                  <motion.div
                    key="ai-chip"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6, transition: { duration: 0.18 } }}
                    transition={SPRING.panel}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}
                  >
                    <Sparkles size={11} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                      {typedDone ? 'AI suggested reply — ready to send' : 'AI is drafting…'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                className="composer-row"
                style={{
                  padding: '5px 5px 5px 12px',
                  borderColor: showSuggestion ? 'var(--accent)' : undefined,
                  boxShadow: showSuggestion ? '0 0 0 3px rgba(79,92,244,0.1)' : undefined,
                }}
              >
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.5, padding: '4px 0', minHeight: 21, color: draft ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {draft || 'Write a reply…'}
                  {showSuggestion && !typedDone && <span className="animate-blink" style={{ color: 'var(--accent)' }}>|</span>}
                </div>
                <motion.button
                  ref={sendRef}
                  className="composer-send"
                  animate={{
                    scale: clicking ? 0.86 : 1,
                    opacity: draft ? 1 : 0.45,
                    boxShadow: clicking ? '0 0 0 4px rgba(79,92,244,0.18)' : '0 0 0 0px rgba(79,92,244,0)',
                  }}
                  transition={{ scale: SPRING.snap, opacity: { duration: 0.25 } }}
                  style={{ width: 30, height: 30 }}
                >
                  <Send size={13} />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {!reduce && <Cursor x={cursor.x} y={cursor.y} visible={cursor.visible} clicking={clicking} />}
      </motion.div>
    </div>
  )
}

/* ── Compact sidebar nav row (visual copy of the real .nav-item) ──────────── */
function DemoNavItem({ label, icon: Icon, active, pill }: { label: string; icon: LucideIcon; active?: boolean; pill?: string }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 8,
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: 12, fontWeight: active ? 600 : 500, whiteSpace: 'nowrap',
      }}
    >
      <Icon size={13} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {pill && <span className="nav-pill" style={{ fontSize: 8 }}>{pill}</span>}
    </div>
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
          <span className="priority-dot" aria-hidden />
          {won ? 'Won' : 'Urgent'}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/* ── AI panel (analyzing → risk → won), real .chat-ai styling ─────────────── */
function AIPanel({ analyzing, won }: { analyzing: boolean; won: boolean }) {
  if (won) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        transition={SPRING.pop}
        className="chat-ai" style={{ marginTop: 11, padding: '10px 13px', background: 'rgba(40,200,100,0.08)', borderColor: 'rgba(40,170,90,0.25)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.snap, delay: 0.1 }} style={{ display: 'inline-flex' }}>
            <PartyPopper size={14} style={{ color: '#16A34A' }} />
          </motion.span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', letterSpacing: '0.04em' }}>Deal won — client confirmed</span>
        </div>
      </motion.div>
    )
  }
  if (analyzing) {
    return (
      <div className="ai-shimmer chat-ai" style={{ marginTop: 11, padding: '10px 13px', borderColor: 'rgba(79,92,244,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.span
            animate={{ rotate: [0, 14, -10, 0], scale: [1, 1.18, 1, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-flex' }}
          >
            <Sparkles size={13} style={{ color: 'var(--accent)' }} />
          </motion.span>
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
    <motion.div
      initial="hidden" animate="visible" variants={lineStagger}
      className="chat-ai" style={{ marginTop: 11, padding: '10px 13px', background: 'var(--hot-dim)', borderColor: 'var(--hot-border)' }}
    >
      <motion.div variants={lineIn} className="chat-ai-head" style={{ marginBottom: 5 }}>
        <Sparkles size={12} style={{ color: 'var(--hot)' }} />
        <span style={{ color: 'var(--hot)' }}>AI insight · High risk</span>
      </motion.div>
      <motion.p variants={lineIn} className="chat-ai-summary" style={{ fontSize: 12, marginBottom: 5 }}>Client is ready to buy. A delay over 2h will reduce conversion.</motion.p>
      <motion.p variants={lineIn} className="chat-ai-action" style={{ fontSize: 12 }}>→ Reply with a concrete start date</motion.p>
    </motion.div>
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
