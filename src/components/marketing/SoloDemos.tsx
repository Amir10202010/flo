'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion, animate } from 'framer-motion'
import { Sparkles, Bell, Check, Mail, PencilLine, Send } from 'lucide-react'
import { SPRING, EASE_OUT } from './demo-motion'

/* Four looping mini-demos for the Cluely-style landing sections. Each card is
 * self-contained: copy on top, a small live UI pinned to the bottom edge.
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
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
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
  gap: 5,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.03em',
  padding: '3px 8px',
  borderRadius: 100,
  whiteSpace: 'nowrap',
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
  const { step } = useTimeline([1800, 1100, 3400], 2)
  const ranked = step >= 2
  const order = ranked ? RANKED : CHRONO

  return (
    <CardShell
      accent
      title="Ranked, not chronological"
      sub="Your inbox sorted by who actually needs you today — the client never sits under a newsletter."
    >
      <Panel style={{ background: 'rgba(255,255,255,0.94)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 3px' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today</span>
          <AnimatePresence>
            {step >= 1 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={SPRING.snap}
                style={{ ...chipBase, color: 'var(--accent)', background: 'var(--accent-dim)' }}
              >
                <Sparkles size={10} /> Ranked by Velnox
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {order.map(id => {
          const r = ROWS.find(x => x.id === id)!
          const dim = ranked && r.noise
          return (
            <motion.div
              key={r.id}
              layout
              transition={SPRING.panel}
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
              <AnimatePresence>
                {ranked && r.badge && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={SPRING.snap}
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
              </AnimatePresence>
            </motion.div>
          )
        })}
      </Panel>
    </CardShell>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   2 · The reply is already written — review-before-send draft types itself
   ════════════════════════════════════════════════════════════════════════════ */
const DRAFT = 'Hi Maria — good catch. Updated budget attached; only the media line changed. Happy to walk it through tomorrow.'
const TYPE_MS = 26

export function DraftDemo() {
  const { step, reduce } = useTimeline([1100, DRAFT.length * TYPE_MS + 500, 3400], 2)
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

  const shown = reduce || step >= 2 ? DRAFT : DRAFT.slice(0, chars)
  const ready = step >= 2

  return (
    <CardShell
      title="The reply is already written"
      sub="A draft in your voice waits on every urgent thread — review it, tweak it, send it."
    >
      <Panel>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '1px 3px' }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Re: Q3 budget · Maria Rossi
          </span>
          <span style={{ ...chipBase, color: ready ? 'var(--accent)' : 'var(--text-muted)', background: ready ? 'var(--accent-dim)' : 'rgba(141,147,190,0.12)', transition: 'color 0.2s, background 0.2s' }}>
            <Sparkles size={10} /> {ready ? 'Draft ready — review before send' : 'Drafting…'}
          </span>
        </div>

        <div style={{
          border: '1px solid var(--border-light)', borderRadius: 9, background: 'var(--bg-subtle)',
          padding: '10px 12px', minHeight: 88, fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)',
        }}>
          {shown}
          {step === 1 && <span className="animate-blink" style={{ display: 'inline-block', width: 7, height: 13, marginLeft: 1, verticalAlign: 'text-bottom', background: 'var(--accent)' }} />}
        </div>

        <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end', opacity: ready ? 1 : 0.35, transition: 'opacity 0.25s' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', background: '#fff' }}>
            <PencilLine size={11} /> Edit
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#fff', borderRadius: 7, padding: '5px 10px', background: 'var(--btn-primary)' }}>
            <Send size={11} /> Send
          </span>
        </div>
      </Panel>
    </CardShell>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   3 · Going-cold radar — a relationship drifts, Velnox flags it
   ════════════════════════════════════════════════════════════════════════════ */
export function ColdDemo() {
  const { step, reduce } = useTimeline([1500, 1500, 1400, 3200], 3)
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
    const controls = animate(4, 16, { duration: 1.1, ease: 'easeOut', onUpdate: v => setDays(Math.round(v)) })
    return () => controls.stop()
  }, [step, reduce])

  const shownDays = reduce ? 16 : days
  const cold = step >= 2

  const contactRow = (ini: string, iniCol: string, iniBg: string, name: string, sub: React.ReactNode, chip?: React.ReactNode, dimmed?: boolean) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, opacity: dimmed ? 0.72 : 1,
      border: '1px solid var(--border-light)', borderRadius: 9, padding: '8px 10px', background: '#fff', boxShadow: 'var(--shadow-xs)',
    }}>
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
    </div>
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

        <div style={{
          border: `1px solid ${cold ? 'var(--attention-border)' : 'var(--border-light)'}`,
          borderRadius: 9, padding: '8px 10px', background: '#fff', boxShadow: 'var(--shadow-xs)',
          display: 'flex', flexDirection: 'column', gap: 7, transition: 'border-color 0.3s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9.5, fontWeight: 700, color: '#C2620A', background: 'rgba(194,98,10,0.12)',
            }}>DK</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Dmitry Ko · Arte Studio</span>
              <span style={{ display: 'block', fontSize: 11, color: cold ? 'var(--attention)' : 'var(--text-secondary)', transition: 'color 0.3s', fontVariantNumeric: 'tabular-nums' }}>
                Last reply — {shownDays} days ago
              </span>
            </span>
            <AnimatePresence>
              {cold && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING.snap}
                  style={{ ...chipBase, color: 'var(--attention)', background: 'var(--attention-dim)', border: '1px solid var(--attention-border)' }}
                >
                  GOING COLD
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* relationship warmth draining */}
          <div style={{ height: 4, borderRadius: 100, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <motion.div
              animate={{ width: cold ? '22%' : step >= 1 ? '44%' : '76%', background: cold ? '#C2620A' : '#2E9E63' }}
              transition={{ duration: 0.9, ease: EASE_OUT }}
              style={{ height: '100%', borderRadius: 100, width: '76%', background: '#2E9E63' }}
            />
          </div>
        </div>

        <AnimatePresence>
          {step >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING.pop}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                border: '1px solid rgba(79,92,244,0.28)', background: 'var(--accent-dim)',
                borderRadius: 9, padding: '8px 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--accent)',
              }}
            >
              <Sparkles size={12} /> Follow-up drafted — review before send
            </motion.div>
          )}
        </AnimatePresence>
      </Panel>
    </CardShell>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   4 · Nothing falls through — reminders + the weekly digest
   ════════════════════════════════════════════════════════════════════════════ */
export function FollowThroughDemo() {
  const { step } = useTimeline([1600, 1500, 3400], 2)
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
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: done ? '#2E9E63' : 'var(--attention)', background: done ? 'rgba(46,158,99,0.1)' : 'var(--attention-dim)',
            transition: 'color 0.25s, background 0.25s',
          }}>
            {done ? <Check size={13} /> : <Bell size={13} />}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', textDecorationLine: done ? 'line-through' : 'none', textDecorationColor: 'var(--text-muted)' }}>
              Follow up with Arte Studio
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>Reminder · Thursday 9:00</span>
          </span>
          <span style={{ ...chipBase, color: done ? '#2E9E63' : 'var(--text-muted)', background: done ? 'rgba(46,158,99,0.1)' : 'rgba(141,147,190,0.12)', transition: 'color 0.25s, background 0.25s' }}>
            {done ? 'DONE' : 'PENDING'}
          </span>
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

        <AnimatePresence>
          {step >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING.pop}
              style={{ border: '1px solid var(--border-light)', borderRadius: 9, background: '#fff', boxShadow: 'var(--shadow-xs)', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-subtle)' }}>
                <Mail size={12} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)' }}>Your week — Velnox digest</span>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>Mon 8:00</span>
              </div>
              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['3 threads need a reply today', '2 clients going cold', '5 drafts ready to review'].map(line => (
                  <span key={line} style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                    {line}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Panel>
    </CardShell>
  )
}
