'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion, animate } from 'framer-motion'
import { Sparkles, Bell, Check, Mail, PencilLine, Send } from 'lucide-react'
import { SPRING, EASE_OUT } from './demo-motion'
import Cursor from './Cursor'

/* Four looping mini-demos for the Cluely-style landing sections, cut like a
 * Screen Studio capture: slow under-damped springs, soft crossfades, a scan
 * highlight and a gliding cursor — and ZERO layout shift. Every element that
 * appears during the loop is permanently mounted in a reserved slot and
 * animated with opacity/transform only, so the cards never change size.
 * Everything shown is real product behavior — ranking, review-before-send
 * drafts, going-cold flags, reminders and the weekly digest. */

/* Shared step-machine: loops through `durations`; resolves straight to the
 * `final` frame when the user prefers reduced motion. */
function useTimeline(durations: number[], final: number) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => setStep(s => (s + 1) % durations.length), durations[step])
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, reduce])
  return { step: reduce ? final : step, reduce }
}

/* The one easing grammar for these cards: long, calm, filmic. */
const FADE = { duration: 0.55, ease: EASE_OUT }
const GLIDE = { type: 'spring', stiffness: 90, damping: 19, mass: 1 } as const

function CardShell({ accent, title, sub, children }: {
  accent?: boolean
  title: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <div className={`demo-card${accent ? ' demo-card-accent' : ''}`}>
      <div className="demo-card-copy">
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
      <div className="demo-card-stage">{children}</div>
    </div>
  )
}

/* Inner mini-UI panel that bleeds into the card's bottom edge. */
function Panel({ children, style, innerRef }: { children: React.ReactNode; style?: React.CSSProperties; innerRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={innerRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        background: '#FFFFFF',
        border: '1px solid var(--border-light)',
        borderBottom: 'none',
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -1px 18px rgba(12,18,60,0.05)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.03em',
  padding: '3px 8px',
  borderRadius: 100,
  whiteSpace: 'nowrap',
}

/* Crossfading chip stack: all states stay mounted in one CSS-grid cell, so the
 * slot is always as wide as the widest state — the row never reflows. */
function ChipStack({ states, active }: {
  states: { key: string; node: React.ReactNode }[]
  active: string
}) {
  return (
    <span style={{ display: 'grid', flexShrink: 0 }}>
      {states.map(s => (
        <motion.span
          key={s.key}
          initial={false}
          animate={{ opacity: active === s.key ? 1 : 0, scale: active === s.key ? 1 : 0.92 }}
          transition={FADE}
          style={{ gridArea: '1 / 1', justifySelf: 'end', alignSelf: 'center', pointerEvents: 'none' }}
          aria-hidden={active !== s.key}
        >
          {s.node}
        </motion.span>
      ))}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   1 · Ranked, not chronological — the client thread surfaces above the noise
   ════════════════════════════════════════════════════════════════════════════ */
type Row = {
  id: string; ini: string; col: string; bg: string
  name: string; text: string; badge?: 'HOT' | 'FOLLOW UP'; noise?: boolean
}
const ROWS: Row[] = [
  { id: 'news',  ini: 'GW', col: '#8D93BE', bg: 'rgba(141,147,190,0.16)', name: 'Growth Weekly', text: 'Top 10 growth hacks for Q3 🔥', noise: true },
  { id: 'maria', ini: 'MR', col: '#DC2B55', bg: 'rgba(220,43,85,0.1)',    name: 'Maria Rossi',   text: 'Did you see my note on the budget?', badge: 'HOT' },
  { id: 'promo', ini: 'CS', col: '#8D93BE', bg: 'rgba(141,147,190,0.16)', name: 'CloudSpark',    text: '40% off annual plans — ends tonight', noise: true },
  { id: 'tom',   ini: 'TK', col: '#C2620A', bg: 'rgba(194,98,10,0.12)',   name: 'Tom Keller',    text: 'Ready to sign — one question first', badge: 'FOLLOW UP' },
]
const CHRONO = ['news', 'maria', 'promo', 'tom']
const RANKED = ['maria', 'tom', 'news', 'promo']

export function RankDemo() {
  const { step } = useTimeline([2200, 1400, 4600], 2)
  const ranked = step >= 2
  const order = ranked ? RANKED : CHRONO

  return (
    <CardShell
      accent
      title="Ranked, not chronological"
      sub="Your inbox sorted by who actually needs you today — the client never sits under a newsletter."
    >
      <Panel style={{ background: 'rgba(255,255,255,0.94)' }}>
        {/* soft scan sweep while Velnox "reads" the list */}
        <AnimatePresence>
          {step === 1 && (
            <motion.div
              aria-hidden
              initial={{ top: -22, opacity: 0 }}
              animate={{ top: '104%', opacity: [0, 1, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.25, ease: 'easeInOut', opacity: { duration: 1.25, times: [0, 0.15, 0.8, 1] } }}
              style={{
                position: 'absolute', left: 4, right: 4, height: 18, zIndex: 2,
                borderRadius: 9, filter: 'blur(3px)', pointerEvents: 'none',
                background: 'linear-gradient(90deg, transparent, rgba(79,92,244,0.2), transparent)',
              }}
            />
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 3px' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today</span>
          <motion.span
            initial={false}
            animate={{ opacity: step >= 1 ? 1 : 0, y: step >= 1 ? 0 : 4 }}
            transition={FADE}
            style={{ ...chipBase, color: 'var(--accent)', background: 'var(--accent-dim)' }}
          >
            <Sparkles size={10} /> Ranked by Velnox
          </motion.span>
        </div>

        {order.map(id => {
          const r = ROWS.find(x => x.id === id)!
          const dim = ranked && r.noise
          return (
            <motion.div
              key={r.id}
              layout
              transition={{ layout: GLIDE, opacity: FADE }}
              initial={false}
              animate={{ opacity: dim ? 0.55 : 1 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                background: '#FFFFFF', border: '1px solid var(--border-light)',
                borderRadius: 9, padding: '8px 10px', boxShadow: 'var(--shadow-xs)',
              }}
            >
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9.5, fontWeight: 700, color: r.col, background: r.bg,
              }}>{r.ini}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{r.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.text}</span>
              </span>
              {/* badge slot is permanently reserved — it only fades in */}
              {r.badge && (
                <motion.span
                  initial={false}
                  animate={{ opacity: ranked ? 1 : 0, scale: ranked ? 1 : 0.85 }}
                  transition={{ ...FADE, delay: ranked ? 0.25 : 0 }}
                  style={{
                    ...chipBase,
                    color: r.badge === 'HOT' ? 'var(--hot)' : 'var(--attention)',
                    background: r.badge === 'HOT' ? 'var(--hot-dim)' : 'var(--attention-dim)',
                    border: `1px solid ${r.badge === 'HOT' ? 'var(--hot-border)' : 'var(--attention-border)'}`,
                  }}
                >
                  {r.badge}
                </motion.span>
              )}
            </motion.div>
          )
        })}
      </Panel>
    </CardShell>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   2 · The reply is already written — draft types itself, the cursor sends it
   ════════════════════════════════════════════════════════════════════════════ */
const DRAFT = 'Hi Maria — good catch. Updated budget attached; only the media line changed. Happy to walk it through tomorrow.'
const TYPE_MS = 24

export function DraftDemo() {
  const { step, reduce } = useTimeline([1100, DRAFT.length * TYPE_MS + 500, 1700, 2800], 2)
  const [chars, setChars] = useState(0)

  /* Reset via rAF (never synchronously in the effect body); the counter only
   * ticks during the typing step. Reduced motion renders the full draft. */
  useEffect(() => {
    if (reduce) return
    if (step === 0) {
      const id = requestAnimationFrame(() => setChars(0))
      return () => cancelAnimationFrame(id)
    }
    if (step !== 1) return
    const t = setInterval(() => {
      setChars(c => {
        if (c >= DRAFT.length) { clearInterval(t); return c }
        return c + 1
      })
    }, TYPE_MS)
    return () => clearInterval(t)
  }, [step, reduce])

  /* Screen-Studio cursor: measured against the real Send button so the glide
   * lands dead-center at every card width. Coordinates update via rAF. */
  const panelRef = useRef<HTMLDivElement>(null)
  const sendRef = useRef<HTMLSpanElement>(null)
  const [cur, setCur] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (reduce) return
    const id = requestAnimationFrame(() => {
      const p = panelRef.current?.getBoundingClientRect()
      const s = sendRef.current?.getBoundingClientRect()
      if (!p || !s) return
      if (step >= 2) {
        setCur({ x: s.left - p.left + s.width / 2 - 5, y: s.top - p.top + s.height / 2 - 3 })
      } else {
        setCur({ x: p.width * 0.55, y: p.height + 36 })
      }
    })
    return () => cancelAnimationFrame(id)
  }, [step, reduce])

  const shown = reduce || step >= 2 ? DRAFT : DRAFT.slice(0, chars)
  const ready = step >= 2
  const sent = step >= 3
  const chipState = sent ? 'sent' : ready ? 'ready' : 'drafting'

  return (
    <CardShell
      title="The reply is already written"
      sub="A draft in your voice waits on every urgent thread — review it, tweak it, send it."
    >
      <Panel innerRef={panelRef}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '1px 3px' }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Re: Q3 budget · Maria Rossi
          </span>
          <ChipStack
            active={chipState}
            states={[
              { key: 'drafting', node: <span style={{ ...chipBase, color: 'var(--text-muted)', background: 'rgba(141,147,190,0.12)' }}><Sparkles size={10} /> Drafting…</span> },
              { key: 'ready',    node: <span style={{ ...chipBase, color: 'var(--accent)', background: 'var(--accent-dim)' }}><Sparkles size={10} /> Draft ready — review before send</span> },
              { key: 'sent',     node: <span style={{ ...chipBase, color: '#2E9E63', background: 'rgba(46,158,99,0.1)' }}><Check size={10} /> Sent</span> },
            ]}
          />
        </div>

        {/* the invisible full draft reserves the box's final size, so the
            typewriter never grows the card — text paints over it in place */}
        <div style={{
          position: 'relative',
          border: '1px solid var(--border-light)', borderRadius: 9, background: 'var(--bg-subtle)',
          padding: '10px 12px', fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)',
        }}>
          <span style={{ visibility: 'hidden' }} aria-hidden>{DRAFT}</span>
          <span style={{ position: 'absolute', top: 10, left: 12, right: 12 }}>
            {shown}
            <motion.span
              className="animate-blink"
              initial={false}
              animate={{ opacity: step === 1 ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'inline-block', width: 7, height: 13, marginLeft: 1, verticalAlign: 'text-bottom', background: 'var(--accent)' }}
            />
          </span>
        </div>

        <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end', opacity: ready ? 1 : 0.35, transition: 'opacity 0.45s' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', background: '#fff' }}>
            <PencilLine size={11} /> Edit
          </span>
          <motion.span
            ref={sendRef}
            initial={false}
            animate={{ scale: sent ? [1, 0.93, 1] : 1 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#fff', borderRadius: 7, padding: '5px 10px', background: 'var(--btn-primary)' }}
          >
            <Send size={11} /> Send
          </motion.span>
        </div>

        {!reduce && <Cursor x={cur.x} y={cur.y} visible={ready} clicking={sent} />}
      </Panel>
    </CardShell>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   3 · Going-cold radar — a relationship drifts, Velnox flags it
   ════════════════════════════════════════════════════════════════════════════ */
export function ColdDemo() {
  const { step, reduce } = useTimeline([1900, 1700, 1500, 3600], 3)
  const [days, setDays] = useState(4)

  /* Counter resets via rAF; the count-up runs through framer's animate()
   * callbacks, never synchronously in the effect body. */
  useEffect(() => {
    if (reduce) return
    if (step === 0) {
      const id = requestAnimationFrame(() => setDays(4))
      return () => cancelAnimationFrame(id)
    }
    if (step !== 1) return
    const controls = animate(4, 16, { duration: 1.35, ease: 'easeInOut', onUpdate: v => setDays(Math.round(v)) })
    return () => controls.stop()
  }, [step, reduce])

  const shownDays = reduce ? 16 : days
  const cold = step >= 2

  const contactRow = (ini: string, iniCol: string, iniBg: string, name: string, sub: React.ReactNode, chip?: React.ReactNode, dimmed?: boolean) => (
    <motion.div
      initial={false}
      animate={{ opacity: dimmed ? 0.72 : 1 }}
      transition={FADE}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        border: '1px solid var(--border-light)', borderRadius: 9, padding: '8px 10px', background: '#fff', boxShadow: 'var(--shadow-xs)',
      }}
    >
      <span style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9.5, fontWeight: 700, color: iniCol, background: iniBg,
      }}>{ini}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{name}</span>
        <span style={{ display: 'block', fontSize: 11 }}>{sub}</span>
      </span>
      {chip}
    </motion.div>
  )

  return (
    <CardShell
      title="The going-cold radar"
      sub="Velnox watches every client relationship and flags the ones quietly drifting away."
    >
      <Panel>
        {contactRow('MR', '#DC2B55', 'rgba(220,43,85,0.1)', 'Maria Rossi',
          <span style={{ color: 'var(--text-secondary)' }}>Replied today</span>,
          <span style={{ ...chipBase, color: '#2E9E63', background: 'rgba(46,158,99,0.1)' }}>WARM</span>, cold)}

        {contactRow('TK', '#4F5CF4', 'rgba(79,92,244,0.1)', 'Tom Keller',
          <span style={{ color: 'var(--text-secondary)' }}>Last reply — 5 days ago</span>, undefined, cold)}

        <motion.div
          initial={false}
          animate={{ borderColor: cold ? 'rgba(194,98,10,0.35)' : '#E8ECF9' }}
          transition={FADE}
          style={{
            borderWidth: 1, borderStyle: 'solid', borderColor: '#E8ECF9',
            borderRadius: 9, padding: '8px 10px', background: '#fff', boxShadow: 'var(--shadow-xs)',
            display: 'flex', flexDirection: 'column', gap: 7,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9.5, fontWeight: 700, color: '#C2620A', background: 'rgba(194,98,10,0.12)',
            }}>DK</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Dmitry Ko · Arte Studio</span>
              <span style={{ display: 'block', fontSize: 11, color: cold ? 'var(--attention)' : 'var(--text-secondary)', transition: 'color 0.45s', fontVariantNumeric: 'tabular-nums' }}>
                Last reply — {shownDays} days ago
              </span>
            </span>
            {/* flag slot permanently reserved — fades in, never reflows */}
            <motion.span
              initial={false}
              animate={{ opacity: cold ? 1 : 0, scale: cold ? 1 : 0.85 }}
              transition={FADE}
              style={{ ...chipBase, color: 'var(--attention)', background: 'var(--attention-dim)', border: '1px solid var(--attention-border)' }}
            >
              GOING COLD
            </motion.span>
          </div>

          {/* relationship warmth draining */}
          <div style={{ height: 4, borderRadius: 100, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <motion.div
              initial={false}
              animate={{ width: cold ? '22%' : step >= 1 ? '44%' : '76%', background: cold ? '#C2620A' : '#2E9E63' }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
              style={{ height: '100%', borderRadius: 100, width: '76%', background: '#2E9E63' }}
            />
          </div>
        </motion.div>

        {/* suggestion slot permanently reserved — glides up in place */}
        <motion.div
          initial={false}
          animate={{ opacity: step >= 3 ? 1 : 0, y: step >= 3 ? 0 : 8 }}
          transition={{ opacity: FADE, y: GLIDE }}
          aria-hidden={step < 3}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            border: '1px solid rgba(79,92,244,0.28)', background: 'var(--accent-dim)',
            borderRadius: 9, padding: '8px 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--accent)',
          }}
        >
          <Sparkles size={12} /> Follow-up drafted — review before send
        </motion.div>
      </Panel>
    </CardShell>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   4 · Nothing falls through — reminders + the weekly digest
   ════════════════════════════════════════════════════════════════════════════ */
export function FollowThroughDemo() {
  const { step } = useTimeline([2000, 1700, 3800], 2)
  const done = step >= 1

  return (
    <CardShell
      title="Nothing falls through"
      sub="Reminders and a weekly digest catch the follow-ups you meant to send."
    >
      <Panel>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          border: '1px solid var(--border-light)', borderRadius: 9, padding: '9px 10px', background: '#fff', boxShadow: 'var(--shadow-xs)',
        }}>
          <span style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0, position: 'relative',
            display: 'grid', placeItems: 'center',
            color: done ? '#2E9E63' : 'var(--attention)', background: done ? 'rgba(46,158,99,0.1)' : 'var(--attention-dim)',
            transition: 'color 0.45s, background 0.45s',
          }}>
            <motion.span initial={false} animate={{ opacity: done ? 0 : 1, scale: done ? 0.6 : 1 }} transition={FADE} style={{ gridArea: '1 / 1', display: 'flex' }}>
              <Bell size={13} />
            </motion.span>
            <motion.span initial={false} animate={{ opacity: done ? 1 : 0, scale: done ? 1 : 0.6 }} transition={{ ...SPRING.snap }} style={{ gridArea: '1 / 1', display: 'flex' }}>
              <Check size={13} />
            </motion.span>
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', textDecorationLine: done ? 'line-through' : 'none', textDecorationColor: 'var(--text-muted)' }}>
              Follow up with Arte Studio
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>Reminder · Thursday 9:00</span>
          </span>
          <ChipStack
            active={done ? 'done' : 'pending'}
            states={[
              { key: 'pending', node: <span style={{ ...chipBase, color: 'var(--text-muted)', background: 'rgba(141,147,190,0.12)' }}>PENDING</span> },
              { key: 'done',    node: <span style={{ ...chipBase, color: '#2E9E63', background: 'rgba(46,158,99,0.1)' }}>DONE</span> },
            ]}
          />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          border: '1px solid var(--border-light)', borderRadius: 9, padding: '9px 10px', background: '#fff', boxShadow: 'var(--shadow-xs)',
        }}>
          <span style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', background: 'rgba(141,147,190,0.12)',
          }}>
            <Bell size={13} />
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Send the invoice to Meadow Co
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>Reminder · Friday 14:00</span>
          </span>
          <span style={{ ...chipBase, color: 'var(--text-muted)', background: 'rgba(141,147,190,0.12)' }}>PENDING</span>
        </div>

        {/* digest slot permanently reserved — glides up in place */}
        <motion.div
          initial={false}
          animate={{ opacity: step >= 2 ? 1 : 0, y: step >= 2 ? 0 : 10 }}
          transition={{ opacity: FADE, y: GLIDE }}
          aria-hidden={step < 2}
          style={{ border: '1px solid var(--border-light)', borderRadius: 9, background: '#fff', boxShadow: 'var(--shadow-xs)', overflow: 'hidden' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-subtle)' }}>
            <Mail size={12} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>Your week — Velnox digest</span>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>Mon 8:00</span>
          </div>
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['3 threads need a reply today', '2 clients going cold', '5 drafts ready to review'].map(line => (
              <span key={line} style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                {line}
              </span>
            ))}
          </div>
        </motion.div>
      </Panel>
    </CardShell>
  )
}
