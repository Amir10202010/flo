'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  motion, type Variants, MotionConfig, AnimatePresence,
  useReducedMotion, useMotionValue, useMotionTemplate, useSpring, useTransform, useScroll,
} from 'framer-motion'
import { ArrowRight, Check, Inbox, Shield, Sparkles, Bot, Search, SlidersHorizontal, Plus, X, Star, Zap, TrendingUp, Play, type LucideIcon } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroVisual from '@/components/marketing/HeroVisual'
import ProductDemo from '@/components/marketing/ProductDemo'

/* ── Motion Variants ─────────────────────────────────────────────────────── */
const fadeUp: Variants = {
  hidden:   { opacity: 0, y: 20 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
}

const stagger: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const fromRight: Variants = {
  hidden:  { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.65, ease: 'easeOut' } },
}

/* Signature reveal — blur + lift, used for hero lines and section headers. */
const blurUp: Variants = {
  hidden:  { opacity: 0, y: 26, filter: 'blur(10px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } },
}

/* ── Magnetic wrapper — element eases toward the cursor on hover ──────────── */
function Magnetic({ children, strength = 0.35 }: { children: React.ReactNode; strength?: number }) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 16 })
  const sy = useSpring(y, { stiffness: 220, damping: 16 })
  return (
    <motion.span
      style={{ display: 'inline-flex', x: sx, y: sy }}
      onMouseMove={(e) => {
        if (reduce) return
        const r = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - r.left - r.width / 2) * strength)
        y.set((e.clientY - r.top - r.height / 2) * strength)
      }}
      onMouseLeave={() => { x.set(0); y.set(0) }}
    >
      {children}
    </motion.span>
  )
}

/* ── Count-up — animates a numeric value when scrolled into view ──────────── */
function CountUp({ to, suffix = '', prefix = '', duration = 1.4, decimals = 0 }: { to: number; suffix?: string; prefix?: string; duration?: number; decimals?: number }) {
  const reduce = useReducedMotion()
  const [val, setVal] = useState(0)
  const started = useRef(false)
  const fmt = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`
  // Reduced motion: skip the count, show the final value. Done in an effect
  // (post-mount) so server and client first render agree → no hydration gap.
  useEffect(() => { if (reduce) setVal(to) }, [reduce, to])
  return (
    <motion.span
      onViewportEnter={() => {
        if (started.current || reduce) return
        started.current = true
        const start = performance.now()
        const tick = (now: number) => {
          const p = Math.min((now - start) / (duration * 1000), 1)
          const eased = 1 - Math.pow(1 - p, 3)
          setVal(to * eased)
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }}
      viewport={{ once: true, margin: '-60px' }}
    >
      {fmt(val)}
    </motion.span>
  )
}

/* Cursor-follow spotlight handler for cards — sets --mx/--my CSS vars. */
function spotlightMove(e: React.MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}

/* Branded section kicker — one consistent system in place of repeated eyebrows. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <motion.span variants={fadeUp} className="kicker">
      <span className="kicker-dot" />
      {children}
    </motion.span>
  )
}

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function BentoCard({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <motion.div variants={fadeUp} className="bento-item spotlight-card grad-edge" onMouseMove={spotlightMove}>
      <div className="b-icon"><Icon size={20} style={{ color: 'var(--accent)' }} /></div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </motion.div>
  )
}

/* ── Scroll-drawn timeline (How it works) ─────────────────────────────────── */
function TimelineItem({ n, title, desc }: { n: number; title: string; desc: string }) {
  // `on` starts false on BOTH server and client first render (no reduce branch)
  // so hydration matches; it flips when the node scrolls into view. Reduced
  // motion is handled globally by <MotionConfig reducedMotion="user">.
  const [on, setOn] = useState(false)
  return (
    <div className="tl-item">
      <motion.div
        className="tl-node"
        data-on={on}
        initial={{ scale: 0.6, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        onViewportEnter={() => setOn(true)}
        viewport={{ once: true, margin: '-45% 0px -45% 0px' }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        {n}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-30% 0px -30% 0px' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ paddingTop: 5 }}
      >
        <h3 style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 7px', lineHeight: 1.3 }}>{title}</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>{desc}</p>
      </motion.div>
    </div>
  )
}

function Timeline({ steps }: { steps: { n: number; title: string; desc: string }[] }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 72%', 'end 65%'] })
  const scaleY = useSpring(scrollYProgress, { stiffness: 110, damping: 30, restDelta: 0.001 })
  return (
    <div className="timeline" ref={ref}>
      <div className="tl-rail">
        <motion.div className="tl-progress" style={{ scaleY: reduce ? 1 : scaleY }} />
      </div>
      {steps.map(s => <TimelineItem key={s.n} {...s} />)}
    </div>
  )
}

/* ── Marquee items (real brand logos + lucide glyphs) ──────────────────────── */
const MARQUEE: { name: string; src?: string; Icon?: LucideIcon; soon?: boolean }[] = [
  { name: 'Gmail', src: '/icons/gmail.svg' },
  { name: 'AI priority', Icon: Sparkles },
  { name: 'Risk alerts', Icon: Shield },
  { name: 'Suggested replies', Icon: Bot },
  { name: 'Smart search', Icon: Search },
  { name: 'Telegram', src: '/icons/telegram.svg', soon: true },
  { name: 'WhatsApp', src: '/icons/whatsapp.svg', soon: true },
  { name: 'Instagram', src: '/icons/instagram.svg', soon: true },
]

/* ── FAQ ───────────────────────────────────────────────────────────────────── */
const FAQS = [
  { q: 'How does Velnox connect to Gmail?', a: 'You connect Gmail in two clicks with Google’s secure OAuth — Velnox never sees or stores your password. Your recent client threads start syncing into your prioritised inbox within minutes.' },
  { q: 'What does the AI actually do?', a: 'It reads each client thread, assigns a clear priority (Hot, Needs attention, Cold, Spam), explains in plain language why a deal is at risk, and drafts a suggested reply you can send in one click.' },
  { q: 'Is this another CRM I have to maintain?', a: 'No. Velnox sits on top of the Gmail you already use — there’s nothing to migrate, no pipelines to update, no data entry. You just get a smarter, sorted inbox.' },
  { q: 'Is my data private and secure?', a: 'Your Google tokens are encrypted at rest (AES-256-GCM) and your conversations are only ever used to power your own inbox. We never sell or share your data.' },
  { q: 'Do other channels work too?', a: 'Today Velnox is fully focused on Gmail, where most agency and studio deals actually happen. Telegram, WhatsApp and Instagram are on the roadmap — connect Gmail now and you’ll get them as they ship.' },
]

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="faq-item" data-open={open}>
      <button className="faq-q" onClick={onToggle} aria-expanded={open}>
        {q}
        <Plus size={18} className="faq-icon" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <p style={{ padding: '0 22px 18px', margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Comparison ────────────────────────────────────────────────────────────── */
// crm = HubSpot/CRM, manual = plain Gmail
const COMPARE: { label: string; flo: boolean; crm: boolean; manual: boolean }[] = [
  { label: 'Lives inside the Gmail you already use', flo: true,  crm: false, manual: true },
  { label: 'AI priority on every client thread', flo: true, crm: false, manual: false },
  { label: 'Explains why a client is going cold', flo: true, crm: false, manual: false },
  { label: 'One-click suggested replies', flo: true, crm: true, manual: false },
  { label: 'No data entry, no pipelines to maintain', flo: true, crm: false, manual: true },
  { label: 'Set up in minutes, no training', flo: true, crm: false, manual: true },
]

function Cell({ on }: { on: boolean }) {
  return on
    ? <Check size={17} style={{ color: 'var(--accent)' }} />
    : <X size={16} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
}

/* ── Stats ─────────────────────────────────────────────────────────────────── */
const STATS = [
  { val: '2 min', lbl: 'To connect Gmail and see your inbox' },
  { val: 'Every thread', lbl: 'Scored Hot · Attention · Cold · Spam' },
  { val: '1-click', lbl: 'AI-drafted replies, ready to send' },
  { val: 'AES-256', lbl: 'Encryption on your connected account' },
]

/* ── Testimonials ────────────────────────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    quote: 'Velnox tells me exactly who’s about to slip away and what to say. We stopped losing warm leads to a busy inbox almost overnight.',
    name: 'Dana Mirzoyan', role: 'Founder · Studio Atelier', ini: 'DM', img: '/avatars/dana.jpg', grad: 'linear-gradient(135deg,#4F5CF4,#7C4DFF)', feature: true,
  },
  {
    quote: 'Our whole studio runs on Gmail. I open Velnox, see the hot client threads first, and I’m done in minutes.',
    name: 'Karim Aliyev', role: 'Sales Lead · Northwind', ini: 'KA', img: '/avatars/karim.jpg', grad: 'linear-gradient(135deg,#DC2B55,#F2709C)',
  },
  {
    quote: 'The suggested replies are scary good. Half the time I just read it, nod, and hit send.',
    name: 'Sofia Reyes', role: 'Owner · Bloom Agency', ini: 'SR', img: '/avatars/sofia.jpg', grad: 'linear-gradient(135deg,#0EA371,#34D399)',
  },
  {
    quote: 'It quietly flags a client going cold before I’d ever notice. That alone paid for itself in the first week.',
    name: 'Marco Bianchi', role: 'Consultant · MB Partners', ini: 'MB', img: '/avatars/marco.jpg', grad: 'linear-gradient(135deg,#C2620A,#F6A23B)',
  },
]

function Stars({ n = 5, color = '#F6A23B' }: { n?: number; color?: string }) {
  return (
    <div className="stars" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} size={14} style={{ color, fill: color }} />
      ))}
    </div>
  )
}

function TestimonialCard({ t }: { t: typeof TESTIMONIALS[number] }) {
  return (
    <motion.div variants={fadeUp} className={`tcard spotlight-card${t.feature ? ' t-feature' : ''}`} onMouseMove={spotlightMove}>
      <Stars color={t.feature ? '#FFFFFF' : '#F6A23B'} />
      <blockquote>“{t.quote}”</blockquote>
      <div className="t-foot">
        <div className="av-chip" style={{ width: 38, height: 38, fontSize: 13, background: t.grad }}>
          <img src={t.img} alt={t.name} width={38} height={38} loading="lazy" />
        </div>
        <div>
          <div className="t-name">{t.name}</div>
          <div className="t-role">{t.role}</div>
        </div>
      </div>
    </motion.div>
  )
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  /* Hero pointer + scroll motion: cursor spotlight, card parallax, drift. */
  const heroRef = useRef<HTMLElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const pnx = useMotionValue(0)
  const pny = useMotionValue(0)
  const spotlight = useMotionTemplate`radial-gradient(620px circle at ${mx}px ${my}px, rgba(79,92,244,0.10), transparent 62%)`

  const sx = useSpring(pnx, { stiffness: 110, damping: 20 })
  const sy = useSpring(pny, { stiffness: 110, damping: 20 })
  const tlX = useTransform(sx, [-0.5, 0.5], [26, -26])
  const tlY = useTransform(sy, [-0.5, 0.5], [18, -18])
  const brX = useTransform(sx, [-0.5, 0.5], [-30, 30])
  const brY = useTransform(sy, [-0.5, 0.5], [-20, 20])

  const { scrollY } = useScroll()
  const visualDrift = useTransform(scrollY, [0, 700], [0, 70])
  const textDrift = useTransform(scrollY, [0, 700], [0, -36])

  const onHeroMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = heroRef.current?.getBoundingClientRect()
    if (!r) return
    mx.set(e.clientX - r.left)
    my.set(e.clientY - r.top)
    pnx.set((e.clientX - r.left) / r.width - 0.5)
    pny.set((e.clientY - r.top) / r.height - 0.5)
  }

  return (
    <MotionConfig reducedMotion="user">
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        onMouseMove={onHeroMove}
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          paddingTop: 80,
          paddingBottom: 60,
          background: 'var(--bg-base)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="mesh mesh-hero" />
        <div className="mesh-veil" />
        <div className="dot-grid" />
        <motion.div className="hero-spotlight" aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', background: spotlight }} />
        <div className="grain" />
        <div className="glow" style={{ width: 540, height: 540, top: -140, right: -60, background: 'radial-gradient(circle, rgba(79,92,244,0.16), transparent 70%)' }} />
        <div className="glow" style={{ width: 420, height: 420, bottom: -160, left: -80, background: 'radial-gradient(circle, rgba(124,77,255,0.12), transparent 70%)' }} />

        <div
          className="hero-grid mkt-x"
          style={{ position: 'relative', zIndex: 2, maxWidth: 1140, margin: '0 auto', padding: '0 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', width: '100%' }}
        >
          {/* Left: text */}
          <motion.div variants={stagger} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 0, y: textDrift }}>

            <motion.div variants={blurUp} className="hero-badge" style={{ marginBottom: 26 }}>
              <span className="hb-dot" />
              <span><span className="hb-shine">New</span> · AI that reads every client thread</span>
            </motion.div>

            <motion.h1
              variants={stagger}
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 9vw, 78px)', fontWeight: 400, lineHeight: 1.04, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: '0 0 24px', textWrap: 'balance' }}
            >
              <motion.span variants={blurUp} style={{ display: 'block' }}>Never lose</motion.span>
              <motion.span variants={blurUp} style={{ display: 'block' }}>
                <em style={{ fontStyle: 'italic' }}>another</em>
                {' '}
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  <span className="ink-grad">client</span>
                  <svg className="flourish" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
                    <motion.path
                      d="M5 15 C 70 5, 150 3, 295 13"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.85 }}
                      transition={{ duration: 0.9, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </svg>
                </span>
              </motion.span>
            </motion.h1>

            <motion.p
              variants={blurUp}
              style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 36px', maxWidth: 480 }}
            >
              Velnox reads every client thread in your Gmail, flags who&apos;s about to go cold, and drafts the reply that saves the deal. Built for agencies, studios and client-facing teams.
            </motion.p>

            <motion.div variants={fadeUp} className="hero-cta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
              <Magnetic strength={0.4}>
                <Link href="/signup" className="btn-primary btn-shine" style={{ fontSize: 15, padding: '14px 28px' }}>
                  Get early access <ArrowRight size={16} />
                </Link>
              </Magnetic>
              <a href="#demo" className="btn-ghost" style={{ fontSize: 15, padding: '13px 24px', background: '#FFFFFF', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Play size={11} style={{ color: 'var(--accent)', fill: 'var(--accent)', marginLeft: 1 }} />
                </span>
                See how it works
              </a>
            </motion.div>

            {/* Trust row — who it's built for */}
            <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26, flexWrap: 'wrap' }}>
              <div className="avatar-stack">
                {TESTIMONIALS.map(t => (
                  <div key={t.ini} className="av-chip" style={{ background: t.grad }}>
                    <img src={t.img} alt="" width={32} height={32} />
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Built for agencies &amp; studios</div>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Run your client deals on Gmail? This is for you.</span>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="hero-checks" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {['Connect Gmail in 2 min', 'Free to start', 'No credit card'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(79,92,244,0.1)', border: '1px solid rgba(79,92,244,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={10} style={{ color: 'var(--accent)' }} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: WebGL glass core + parallax floating glass metric cards */}
          <motion.div className="hero-mockup" variants={fromRight} initial="hidden" animate="visible" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', y: visualDrift }}>
            <div className="hero-stage">
              <motion.div className="fc-pos fc-pos-tl" style={{ x: tlX, y: tlY }}>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="float-card bob">
                    <div className="fc-icon" style={{ background: 'rgba(14,163,113,0.12)' }}><TrendingUp size={17} style={{ color: '#0EA371' }} /></div>
                    <div><div className="fc-val"><CountUp to={38} prefix="+" suffix="%" /></div><div className="fc-lbl">reply rate</div></div>
                  </div>
                </motion.div>
              </motion.div>

              <motion.div className="fc-pos fc-pos-tr" style={{ x: brX, y: tlY }}>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="float-card bob" style={{ padding: '9px 13px' }}>
                    <span className="priority-badge priority-hot" style={{ fontSize: 10 }}><span className="priority-dot" aria-hidden />Urgent</span>
                  </div>
                </motion.div>
              </motion.div>

              <HeroVisual />

              <motion.div className="fc-pos fc-pos-br" style={{ x: brX, y: brY }}>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="float-card bob rev">
                    <div className="fc-icon" style={{ background: 'var(--accent-dim)' }}><Zap size={17} style={{ color: 'var(--accent)' }} /></div>
                    <div><div className="fc-val">Replied in 2m</div><div className="fc-lbl">AI suggested</div></div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Marquee strip (works with / value props) ──────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '26px 0', background: '#FFFFFF' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', margin: '0 0 20px' }}>
          Works inside the inbox you already use
        </p>
        <div className="marquee">
          <div className="marquee-track">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', opacity: m.soon ? 0.55 : 1 }}>
                {m.src
                  ? <img src={m.src} alt={m.name} width={20} height={20} style={{ display: 'block' }} />
                  : m.Icon && <m.Icon size={18} style={{ color: 'var(--accent)' }} />}
                <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{m.name}</span>
                {m.soon && (
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 999, padding: '1px 7px' }}>Soon</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats band ────────────────────────────────────────────────────── */}
      <section className="mkt-x" style={{ padding: '64px 32px', background: 'var(--bg-base)' }}>
        <Section>
          <motion.div variants={stagger} className="stats-band">
            {STATS.map(s => (
              <motion.div key={s.lbl} variants={fadeUp} className="stat-cell">
                <div className="stat-val ink-grad">{s.val}</div>
                <div className="stat-lbl">{s.lbl}</div>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── Product Demo ──────────────────────────────────────────────────── */}
      <section id="demo" className="demo-section" style={{ background: '#FFFFFF', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <Section>
          <div style={{ maxWidth: 1140, margin: '0 auto' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 56 }}>
              <Kicker>Product</Kicker>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 16px', letterSpacing: '-0.03em', textWrap: 'balance' }}>
                Everything in one place
              </h2>
              <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto', lineHeight: 1.65 }}>
                Velnox sorts your Gmail by what needs attention first, so you always know which client to answer next.
              </p>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } } }} style={{ position: 'relative' }}>
              <div className="glow" style={{ width: 680, height: 380, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(79,92,244,0.16), rgba(124,77,255,0.08) 45%, transparent 72%)' }} />
              <div style={{ position: 'relative' }}><ProductDemo /></div>
            </motion.div>
          </div>
        </Section>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="section-padded mkt-x" style={{ padding: '100px 32px', background: 'var(--bg-base)' }}>
        <Section>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 60, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Kicker>Features</Kicker>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 14px', letterSpacing: '-0.03em', textWrap: 'balance' }}>
                Built around how you actually work
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
                One inbox, a clear sense of who needs you, and a head start on what to say.
              </p>
            </motion.div>
            <div className="bento">
              {/* Showcase — wide cell with a live priority preview */}
              <motion.div variants={fadeUp} className="bento-item bento-wide spotlight-card grad-edge" onMouseMove={spotlightMove}>
                <div className="b-icon"><Inbox size={21} style={{ color: 'var(--accent)' }} /></div>
                <h3>Your whole client inbox, sorted</h3>
                <p>Every client thread in your Gmail, in one calm list — already sorted by who needs you first. No more scrolling past the deal that was about to close.</p>
                <div className="spotlight">
                  {[
                    { ini: 'AP', grad: 'linear-gradient(135deg,#DC2B55,#F2709C)', name: 'Alex Peterson', msg: 'When can we start?', badge: 'Urgent', cls: 'priority-hot' },
                    { ini: 'KL', grad: 'linear-gradient(135deg,#C2620A,#F6A23B)', name: 'Karina Lee', msg: 'Checking with my team…', badge: 'High', cls: 'priority-attention' },
                  ].map(r => (
                    <div key={r.ini} className="spot-row">
                      <div className="spot-av" style={{ background: r.grad, color: '#fff' }}>{r.ini}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="spot-name">{r.name}</div>
                        <div className="spot-msg">{r.msg}</div>
                      </div>
                      <span className={`priority-badge ${r.cls}`} style={{ fontSize: 9 }}>{r.badge}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <BentoCard icon={Sparkles} title="Conversation analyzer" desc="A clear read on every client thread: where it stands, the risk, and the next concrete step — in plain language." />
              <BentoCard icon={Search} title="AI chat search"         desc="Ask in plain words — “who asked about pricing last week?” — and jump straight to the right thread." />
              <BentoCard icon={SlidersHorizontal} title="Smart filtering" desc="Filter by priority or status so the inbox shows exactly which client needs you right now." />
              <BentoCard icon={Shield} title="Notice when things go quiet" desc="When a client cools off, Velnox flags it and tells you why — so you can step in before it’s too late." />
              <BentoCard icon={Bot}    title="Auto-responder bot · Soon" desc="Coming soon: let a bot reply from the context you give it, then hand off to you the moment a human touch is needed." />

              {/* CTA tile — wide, fills the row and pushes to the full feature tour */}
              <motion.a variants={fadeUp} href="/features" className="bento-item bento-cta spotlight-card" onMouseMove={spotlightMove} style={{ justifyContent: 'center', background: 'linear-gradient(150deg, rgba(79,92,244,0.06), rgba(124,77,255,0.05))', borderColor: 'rgba(79,92,244,0.2)', textDecoration: 'none' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'clamp(20px,2.4vw,26px)', letterSpacing: '-0.02em' }}>See every feature in action</h3>
                <p>Take the full tour — analysis, auto-replies, search and more.</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 16, color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>
                  Explore features <ArrowRight size={16} className="cta-arrow" />
                </span>
              </motion.a>
            </div>
          </div>
        </Section>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how" className="section-padded mkt-x" style={{ padding: '100px 32px', background: '#FFFFFF', borderTop: '1px solid var(--border)' }}>
        <Section>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 56 }}>
              <Kicker>How it works</Kicker>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em', textWrap: 'balance' }}>
                Three steps to full control
              </h2>
            </motion.div>
            <Timeline
              steps={[
                { n: 1, title: 'Connect Gmail',                     desc: 'Takes 2 minutes. Velnox securely syncs your client threads with Google OAuth and never stores your password.' },
                { n: 2, title: 'Velnox sorts what matters most',     desc: 'Each thread gets a clear priority — Hot, Needs attention, Cold, or Spam — so you know where to look first.' },
                { n: 3, title: 'Reply to the right clients in time', desc: 'Velnox shows you who to message right now and drafts what to say. No more deals lost to a buried email.' },
              ]}
            />
          </div>
        </Section>
      </section>

      {/* ── Photography band — who it's for (human warmth) ────────────────── */}
      <section className="section-padded mkt-x" style={{ padding: '90px 32px', background: '#FFFFFF', borderTop: '1px solid var(--border)' }}>
        <Section>
          <motion.div variants={fadeUp} style={{ maxWidth: 1140, margin: '0 auto' }}>
            <div className="photo-band">
              <div className="photo-fallback" aria-hidden />
              <img
                className="photo-media"
                src="/photos/team.jpg"
                alt="A client-facing team working together"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <div className="photo-overlay" aria-hidden />
              <div className="grain" />
              <div className="photo-inner">
                <span className="kicker" style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.28)', color: '#fff', backdropFilter: 'blur(8px)' }}>
                  <span className="kicker-dot" style={{ background: '#fff', boxShadow: '0 0 0 4px rgba(255,255,255,0.18)' }} />
                  Who it&apos;s for
                </span>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'clamp(28px, 4.4vw, 48px)', letterSpacing: '-0.03em', color: '#fff', margin: '16px 0 12px', maxWidth: 620, lineHeight: 1.08, textWrap: 'balance' }}>
                  Built for the people who live in their inbox
                </h2>
                <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.86)', maxWidth: 520, lineHeight: 1.65, margin: 0 }}>
                  Agencies, studios and consultants who win or lose deals over email. Velnox keeps every client warm — so the next reply is always the right one.
                </p>
                <div className="photo-stat-row">
                  {[
                    { v: '+38%', l: 'more replies from warm leads' },
                    { v: 'Zero', l: 'good leads lost to a buried inbox' },
                    { v: 'Instant', l: 'alerts the moment a client cools' },
                  ].map(s => (
                    <div key={s.l} className="photo-stat">
                      <div className="ps-val">{s.v}</div>
                      <div className="ps-lbl">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </Section>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      <section className="section-padded mkt-x" style={{ padding: '100px 32px', background: 'var(--bg-base)', borderTop: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div className="glow" style={{ width: 480, height: 480, top: -120, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(79,92,244,0.1), transparent 70%)' }} />
        <Section>
          <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 56 }}>
              <Kicker>Loved by teams</Kicker>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 14px', letterSpacing: '-0.03em', textWrap: 'balance' }}>
                The people closing more deals
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto', lineHeight: 1.65 }}>
                Founders, sales leads and agencies who stopped letting good clients slip through the cracks.
              </p>
            </motion.div>
            <div className="tgrid">
              {TESTIMONIALS.map(t => <TestimonialCard key={t.name} t={t} />)}
            </div>
          </div>
        </Section>
      </section>

      {/* ── Comparison ────────────────────────────────────────────────────── */}
      <section className="section-padded mkt-x" style={{ padding: '100px 32px', background: '#FFFFFF', borderTop: '1px solid var(--border)' }}>
        <Section>
          <div style={{ maxWidth: 880, margin: '0 auto' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 44 }}>
              <Kicker>Why Velnox</Kicker>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em', textWrap: 'balance' }}>
                Not another CRM to maintain
              </h2>
            </motion.div>
            <motion.div variants={fadeUp} style={{ overflowX: 'auto' }}>
              <table className="compare">
                <thead>
                  <tr>
                    <th style={{ width: '46%' }}></th>
                    <th className="col-flo" style={{ textAlign: 'center' }}>Velnox</th>
                    <th style={{ textAlign: 'center' }}>A CRM</th>
                    <th style={{ textAlign: 'center' }}>Plain Gmail</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map(row => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className="col-flo" style={{ textAlign: 'center' }}><span style={{ display: 'inline-flex' }}><Cell on={row.flo} /></span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ display: 'inline-flex' }}><Cell on={row.crm} /></span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ display: 'inline-flex' }}><Cell on={row.manual} /></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </div>
        </Section>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="section-padded mkt-x" style={{ padding: '100px 32px', background: 'var(--bg-base)', borderTop: '1px solid var(--border)' }}>
        <Section>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 44 }}>
              <Kicker>FAQ</Kicker>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em', textWrap: 'balance' }}>
                Questions, answered
              </h2>
            </motion.div>
            <motion.div variants={fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {FAQS.map((f, i) => (
                <FaqItem key={f.q} q={f.q} a={f.a} open={openFaq === i} onToggle={() => setOpenFaq(o => (o === i ? null : i))} />
              ))}
            </motion.div>
          </div>
        </Section>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="mkt-x mkt-pt mkt-pb" style={{ padding: '90px 32px 130px', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
        <div className="glow" style={{ width: 580, height: 360, bottom: -130, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(124,77,255,0.18), transparent 70%)' }} />
        <Section>
          <motion.div
            variants={fadeUp}
            className="cta-inner"
            style={{ maxWidth: 720, margin: '0 auto', borderRadius: 28, background: 'linear-gradient(135deg, #4F5CF4 0%, #6D44F5 52%, #7C4DFF 100%)', textAlign: 'center', boxShadow: '0 36px 90px rgba(79,92,244,0.42)', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.18) 0%, transparent 55%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', top: -150, right: -90, background: 'radial-gradient(circle, rgba(255,255,255,0.22), transparent 65%)', filter: 'blur(18px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', bottom: -140, left: -70, background: 'radial-gradient(circle, rgba(184,156,255,0.32), transparent 65%)', filter: 'blur(22px)', pointerEvents: 'none' }} />
            <div className="grain" style={{ opacity: 0.4 }} />
            <div style={{ position: 'relative' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4.6vw, 46px)', fontWeight: 400, color: '#FFFFFF', margin: '0 0 14px', letterSpacing: '-0.03em', textWrap: 'balance' }}>
                Ready to stop losing clients?
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', margin: '0 auto 36px', lineHeight: 1.65, maxWidth: 460 }}>
                Connect your Gmail and see which clients are slipping away — before they&apos;re gone for good.
              </p>
              <Magnetic strength={0.4}>
                <Link href="/signup" className="btn-shine" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 32px', background: '#FFFFFF', color: 'var(--accent)', borderRadius: 10, fontSize: 16, fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
                  Get early access <ArrowRight size={16} />
                </Link>
              </Magnetic>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 18, marginBottom: 0 }}>
                No credit card · Free to start
              </p>
            </div>
          </motion.div>
        </Section>
      </section>

      <Footer />
    </div>
    </MotionConfig>
  )
}
