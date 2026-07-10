'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  motion, MotionConfig, AnimatePresence, type Variants,
  useMotionValue, useMotionTemplate, useSpring, useTransform, useReducedMotion,
} from 'framer-motion'
import {
  ArrowRight, Check, Inbox, MessageSquare, Bell,
  Snowflake, Sparkles, ShieldCheck, Plus, type LucideIcon,
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ProductDemo from '@/components/marketing/ProductDemo'
import HeroMockup from '@/components/marketing/HeroMockup'

/* One calm reveal, reused everywhere. Subtle fade + lift; respects reduced motion
   via the page-level <MotionConfig reducedMotion="user">. No magnetic cursors,
   spotlights, parallax or scroll-drawn flourishes — the content is the design. */
const reveal: Variants = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

function Reveal({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={reveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
    >
      {children}
    </motion.div>
  )
}

/* ── Content ─────────────────────────────────────────────────────────────── */
const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Inbox, title: 'Ranked, not chronological', desc: 'Your Gmail sorted by who actually matters today — the important thread never sits below a newsletter.' },
  { icon: Sparkles, title: 'Reply already written', desc: 'An AI draft waiting on your urgent threads — in your voice, review-before-send, never auto-sent.' },
  { icon: Snowflake, title: 'Going-cold radar', desc: 'Velnox spots the people slipping away and tells you who to follow up with before it’s too late.' },
  { icon: MessageSquare, title: 'Catch me up', desc: 'A one-line summary of any long thread, so you reply with the full picture in seconds.' },
  { icon: Bell, title: 'Nothing falls through', desc: 'Reminders and a weekly digest keep the follow-ups you meant to send from quietly disappearing.' },
  { icon: ShieldCheck, title: 'Private by design', desc: 'Runs on your own Gmail with Google OAuth — tokens encrypted, no passwords stored, disconnect any time.' },
]

// Honest, results-first points — no fabricated metrics for an invite-only launch.
const POINTS: { title: string; desc: string }[] = [
  { title: 'Reply today', desc: 'The threads that matter, ranked to the top — so the important client never sits under a newsletter.' },
  { title: 'Spot who’s going cold', desc: 'Velnox watches every relationship and flags the ones slipping before they’re gone.' },
  { title: 'Reply already written', desc: 'A review-before-send draft in your voice waits on your urgent threads. Read, tweak, send.' },
]

const FAQS = [
  { q: 'How does Velnox connect to my Gmail?', a: 'You connect your own Gmail in two clicks with Google’s secure OAuth — Velnox never sees or stores your password. Your threads start syncing within minutes.' },
  { q: 'What does the AI actually do?', a: 'It reads every thread, ranks what needs you today, flags the people going cold, and drafts a reply in your voice — review-before-send, never auto-sent.' },
  { q: 'Is it really just my inbox?', a: 'Yes. Velnox is single-user and reads one personal Gmail. There’s no team to set up and no shared mailbox — it’s your own inbox, made smarter.' },
  { q: 'Is my data private and secure?', a: 'OAuth tokens are encrypted at rest (AES-256-GCM). To power AI features, message content is processed by our AI provider (Google’s Gemini API); we never sell your data — see our Privacy Policy for exactly how it’s handled.' },
]

/* Shared section heading */
function SectionHead({ title, sub, align = 'center' }: { title: string; sub?: string; align?: 'center' | 'left' }) {
  return (
    <Reveal style={{ textAlign: align, marginBottom: 48, maxWidth: align === 'center' ? 640 : undefined, marginLeft: align === 'center' ? 'auto' : undefined, marginRight: align === 'center' ? 'auto' : undefined }}>
      <h2 className="display-title" style={{ fontSize: 'clamp(28px, 3.6vw, 40px)', margin: 0 }}>{title}</h2>
      {sub && <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '12px auto 0', maxWidth: 540 }}>{sub}</p>}
    </Reveal>
  )
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  // Restrained hero polish: a soft cursor-follow spotlight + a gentle 3D tilt on
  // the product shot. Low amplitude, spring-damped, and fully inert under
  // prefers-reduced-motion (guarded here + via MotionConfig).
  const heroRef = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const mx = useMotionValue(-500)
  const my = useMotionValue(-500)
  const spotlight = useMotionTemplate`radial-gradient(460px circle at ${mx}px ${my}px, rgba(79,92,244,0.06), transparent 72%)`
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 110, damping: 18, mass: 0.5 })
  const sy = useSpring(py, { stiffness: 110, damping: 18, mass: 0.5 })
  const rotateY = useTransform(sx, [-0.5, 0.5], [-7, 7])
  const rotateX = useTransform(sy, [-0.5, 0.5], [5, -5])

  const onHeroMove = (e: React.MouseEvent<HTMLElement>) => {
    if (reduce) return
    const r = heroRef.current?.getBoundingClientRect()
    if (!r) return
    mx.set(e.clientX - r.left)
    my.set(e.clientY - r.top)
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  const onHeroLeave = () => { px.set(0); py.set(0) }

  return (
    <MotionConfig reducedMotion="user">
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <Navbar />

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section
          ref={heroRef}
          onMouseMove={onHeroMove}
          onMouseLeave={onHeroLeave}
          className="hero-top"
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <div className="hero-ambient" aria-hidden />
          <div className="hero-grid-faint" aria-hidden />
          {!reduce && <motion.div aria-hidden className="hero-spotlight" style={{ background: spotlight }} />}

          <div className="mkt-x" style={{ position: 'relative', zIndex: 1, maxWidth: 1140, margin: '0 auto', padding: '0 32px' }}>
            <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 64, alignItems: 'center' }}>
              <div>
                <motion.h1
                  className="display-title"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  style={{ fontSize: 'clamp(38px, 5.6vw, 60px)', margin: '0 0 20px' }}
                >
                  Stop losing clients in your inbox.
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
                  style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px', maxWidth: 480 }}
                >
                  Velnox reads your Gmail and tells you who to reply to and follow up with today —
                  and drafts the reply. Connect in 30 seconds. It’s your own inbox.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className="hero-cta"
                  style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}
                >
                  <Link href="/signup" className="btn-primary" style={{ fontSize: 15 }}>
                    Connect your Gmail — free <ArrowRight size={16} />
                  </Link>
                  <a href="#demo" className="btn-ghost" style={{ fontSize: 15 }}>See how it works</a>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}
                >
                  AES-256 encrypted · connect with Google OAuth · we never store your password.
                </motion.p>
              </div>

              <motion.div
                className="hero-mockup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'flex', justifyContent: 'center', perspective: 1100 }}
              >
                <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d', willChange: 'transform' }}>
                  <HeroMockup />
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Product demo ────────────────────────────────────────────────── */}
        <section id="demo" className="section-padded mkt-x" style={{ padding: '96px 32px', background: 'var(--bg-base)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1140, margin: '0 auto' }}>
            <SectionHead
              title="Your inbox, triaged for you"
              sub="Velnox sorts your Gmail by what actually needs you today — and flags who’s going cold, so nothing important slips."
            />
            <Reveal><ProductDemo /></Reveal>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <section className="section-padded mkt-x" style={{ padding: '96px 32px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <SectionHead title="Everything you need to stay on top of it" sub="Ranked replies, a going-cold radar, and a head start on every message." />
            <div className="lp-features">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <Reveal key={title} className="lp-feature">
                  <Icon size={20} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '12px 0 6px', letterSpacing: '-0.01em' }}>{title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{desc}</p>
                </Reveal>
              ))}
            </div>
            <Reveal style={{ textAlign: 'center', marginTop: 40 }}>
              <Link href="/features" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--accent)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                See every feature <ArrowRight size={15} />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ── Results / trust ─────────────────────────────────────────────── */}
        <section className="section-padded mkt-x" style={{ padding: '96px 32px', background: 'var(--bg-base)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <div className="proof-grid">
              <Reveal className="proof-photo">
                <img src="/photos/team.jpg" alt="Working through an inbox" />
              </Reveal>

              <Reveal className="proof-copy">
                <h2 className="display-title" style={{ fontSize: 'clamp(28px, 3.6vw, 40px)', margin: '0 0 14px' }}>
                  Never lose a client to a missed reply
                </h2>
                <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px', maxWidth: 460 }}>
                  Velnox turns your inbox into a short daily list: who to reply to, who’s going cold, and who to
                  follow up with — each with the reply already drafted.
                </p>
                <ul className="proof-points">
                  {POINTS.map(p => (
                    <li key={p.title} className="proof-point">
                      <Check size={16} className="proof-point-ic" />
                      <div>
                        <div className="proof-point-t">{p.title}</div>
                        <div className="proof-point-d">{p.desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '26px 0 0', lineHeight: 1.6 }}>
                  Private by design — AES-256 encrypted · OAuth, no passwords stored.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section className="section-padded mkt-x" style={{ padding: '96px 32px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <SectionHead title="Questions, answered" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FAQS.map((f, i) => {
                const open = openFaq === i
                return (
                  <Reveal key={f.q}>
                    <div className="faq-item" data-open={open}>
                      <button className="faq-q" onClick={() => setOpenFaq(o => (o === i ? null : i))} aria-expanded={open}>
                        {f.q}
                        <Plus size={18} className="faq-icon" />
                      </button>
                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                            style={{ overflow: 'hidden' }}
                          >
                            <p style={{ padding: '0 22px 18px', margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.a}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <section className="mkt-x" style={{ padding: '40px 32px 110px', background: 'var(--bg-base)' }}>
          <Reveal style={{ maxWidth: 880, margin: '0 auto' }}>
            <div className="lp-cta">
              <h2 className="display-title" style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', color: '#fff', margin: '0 0 12px' }}>
                Stop losing clients in your inbox.
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.72)', margin: '0 0 28px', lineHeight: 1.6, maxWidth: 460 }}>
                Connect your Gmail and see who to reply to and follow up with today — with the reply already drafted. 30 seconds to set up.
              </p>
              <Link href="/signup" className="lp-cta-btn">
                Connect your Gmail — free <ArrowRight size={16} />
              </Link>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', margin: '16px 0 0' }}>Free to start · your own inbox · no credit card</p>
            </div>
          </Reveal>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
