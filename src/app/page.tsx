'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, MotionConfig, AnimatePresence, type Variants } from 'framer-motion'
import { ArrowRight, Plus } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroMedia from '@/components/marketing/HeroMedia'
import HeroSkyline from '@/components/marketing/HeroSkyline'
import { RankDemo, DraftDemo, ColdDemo, FollowThroughDemo } from '@/components/marketing/SoloDemos'

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
const FAQS = [
  { q: 'What does the AI actually do?', a: 'It reads every thread, ranks what needs you today, flags the people going cold, and drafts a reply in your voice — review-before-send, never auto-sent.' },
  { q: 'Is my data private and secure?', a: 'OAuth tokens are encrypted at rest (AES-256-GCM). To power AI features, message content is processed by our AI provider (Google’s Gemini API); we never sell your data — see our Privacy Policy for exactly how it’s handled.' },
  { q: 'How does Velnox connect to my Gmail?', a: 'You connect with Google’s secure sign-in — Velnox never sees or stores your password. We’re in early access, so new Gmail connections are approved personally (usually within a day); once approved, your threads sync within minutes.' },
  { q: 'Do I need to change how I use email?', a: 'No. Velnox sits on the personal Gmail you already have — it adds a ranked to-answer list, going-cold flags and ready-to-send drafts on top. Nothing to migrate, nobody else to invite.' },
]

/* Cluely-style two-tone section headline: the working part in ink, the
   trailing phrase in muted — one headline, no sub, the demos do the talking. */
function DuoHead({ ink, muted, align = 'left' }: { ink: string; muted: string; align?: 'left' | 'center' }) {
  return (
    <Reveal style={{ textAlign: align, marginBottom: 34 }}>
      <h2 className="display-title" style={{ fontSize: 'clamp(27px, 3.4vw, 38px)', margin: 0 }}>
        {ink} <span style={{ color: 'var(--text-muted)' }}>{muted}</span>
      </h2>
    </Reveal>
  )
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <MotionConfig reducedMotion="user">
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <Navbar />

        {/* ── Hero — one serif line over a washed skyline ─────────────────── */}
        <section className="hero-sky">
          <HeroSkyline />

          <div className="mkt-x" style={{ position: 'relative', zIndex: 1, maxWidth: 920, margin: '0 auto', padding: '0 32px', textAlign: 'center' }}>
            <motion.h1
              className="hero-serif"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{ fontSize: 'clamp(46px, 7.4vw, 88px)', color: 'var(--text-primary)', margin: '0 0 22px' }}
            >
              Stop losing clients
              <br />
              in your inbox.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 auto 30px', maxWidth: 540 }}
            >
              Velnox reads your Gmail and tells you which client to answer today, who’s going cold,
              and what to say — with the reply already drafted.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="hero-cta"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
            >
              <Link href="/signup" className="btn-primary" style={{ fontSize: 15, padding: '13px 26px' }}>
                Start free <ArrowRight size={16} />
              </Link>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                For freelancers, consultants and solo founders who run client work over Gmail.
              </p>
            </motion.div>
          </div>

          {/* room for the skyline below the copy */}
          <div className="hero-sky-spacer" aria-hidden />
        </section>

        {/* ── Product window rising out of the skyline — plays public/demo.mp4
               when the file exists, falls back to the animated scene ─────── */}
        <section id="demo" className="hero-demo-pull mkt-x" style={{ padding: '0 32px' }}>
          <div style={{ maxWidth: 1140, margin: '0 auto' }}>
            <Reveal><HeroMedia /></Reveal>
          </div>
        </section>

        {/* ── Your morning, already sorted — two live demo cards ─────────── */}
        <section id="how" className="section-padded mkt-x" style={{ padding: '110px 32px 96px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <DuoHead ink="Your morning," muted="already sorted" />
            <div className="demo-duo">
              <Reveal><RankDemo /></Reveal>
              <Reveal><DraftDemo /></Reveal>
            </div>
          </div>
        </section>

        {/* ── Never lose a client to a missed reply — two more ───────────── */}
        <section className="mkt-x" style={{ padding: '30px 32px 96px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <DuoHead ink="Never lose a client" muted="to a missed reply" align="center" />
            <div className="demo-duo">
              <Reveal><ColdDemo /></Reveal>
              <Reveal><FollowThroughDemo /></Reveal>
            </div>
            <Reveal style={{ textAlign: 'center', marginTop: 38 }}>
              <Link href="/features" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--accent)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                See every feature <ArrowRight size={15} />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section className="section-padded mkt-x" style={{ padding: '96px 32px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 className="display-title" style={{ fontSize: 'clamp(28px, 3.6vw, 40px)', margin: 0 }}>Questions, answered</h2>
            </Reveal>
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
        <section className="mkt-x" style={{ padding: '96px 32px 110px', background: 'var(--bg-base)' }}>
          <Reveal style={{ maxWidth: 880, margin: '0 auto' }}>
            <div className="lp-cta">
              <h2 className="display-title" style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', color: '#fff', margin: '0 0 12px' }}>
                Tomorrow morning, know exactly who to answer.
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.72)', margin: '0 0 28px', lineHeight: 1.6, maxWidth: 460 }}>
                Connect your Gmail and see who to reply to and follow up with today — with the reply already drafted.
              </p>
              <Link href="/signup" className="lp-cta-btn">
                Connect your Gmail — free <ArrowRight size={16} />
              </Link>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', margin: '16px 0 0' }}>Early access — we approve new inboxes personally, usually within a day · no credit card</p>
            </div>
          </Reveal>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
