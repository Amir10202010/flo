'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion, type Variants, MotionConfig, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, Inbox, Shield, Sparkles, Bot, Search, SlidersHorizontal, Plus, X } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroMockup from '@/components/marketing/HeroMockup'
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

function FeatureCard({ icon: Icon, title, desc, accent }: { icon: React.ElementType; title: string; desc: string; accent?: boolean }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        padding: '28px 28px 32px',
        borderRadius: 16,
        background: accent ? 'rgba(79,92,244,0.04)' : '#FFFFFF',
        border: `1px solid ${accent ? 'rgba(79,92,244,0.2)' : 'var(--border)'}`,
        boxShadow: accent ? '0 4px 24px rgba(79,92,244,0.08)' : 'var(--shadow-sm)',
        cursor: 'default',
      }}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: 11,
          background: accent ? 'rgba(79,92,244,0.1)' : 'var(--bg-elevated)',
          border: `1px solid ${accent ? 'rgba(79,92,244,0.2)' : 'var(--border-light)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
        }}
      >
        <Icon size={20} style={{ color: accent ? 'var(--accent)' : 'var(--text-secondary)' }} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 9px', lineHeight: 1.3 }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>{desc}</p>
    </motion.div>
  )
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <motion.div variants={fadeUp} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--accent-dim)', border: '1px solid rgba(79,92,244,0.2)',
          color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}
      >
        {n}
      </div>
      <div style={{ paddingTop: 5 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 7px', lineHeight: 1.3 }}>{title}</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>{desc}</p>
      </div>
    </motion.div>
  )
}

/* ── Marquee items (real brand logos + lucide glyphs) ──────────────────────── */
const MARQUEE: { name: string; src?: string; Icon?: React.ElementType }[] = [
  { name: 'Telegram', src: '/icons/telegram.svg' },
  { name: 'Gmail', src: '/icons/gmail.svg' },
  { name: 'WhatsApp', src: '/icons/whatsapp.svg' },
  { name: 'Instagram', src: '/icons/instagram.svg' },
  { name: 'AI priority', Icon: Sparkles },
  { name: 'Auto-responder', Icon: Bot },
  { name: 'Smart search', Icon: Search },
]

/* ── FAQ ───────────────────────────────────────────────────────────────────── */
const FAQS = [
  { q: 'How does Flo connect to Telegram and Gmail?', a: 'You connect each channel in a couple of clicks with secure OAuth — Flo never sees or stores your passwords. Your conversations start syncing into one inbox right away.' },
  { q: 'What does the AI actually do?', a: 'It reads each conversation, assigns a clear priority (Hot, Needs attention, Cold, Spam), explains the risk in plain language, and drafts a suggested reply you can send in one click.' },
  { q: 'Can the bot reply for me automatically?', a: 'Yes. On the Pro plan you can set up an auto-responder bot that answers from the context you give it — and hands off to you the moment a conversation needs a human.' },
  { q: 'Is my data private and secure?', a: 'Your tokens are encrypted at rest (AES-256-GCM) and conversations are only ever used to power your own inbox. We never sell or share your data.' },
  { q: 'Do I need a credit card to start?', a: 'No. The Starter plan is free forever and needs no card. Upgrade to Pro only when your inbox grows.' },
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
// crm = AmoCRM, manual = Pleep
const COMPARE: { label: string; flo: boolean; crm: boolean; manual: boolean }[] = [
  { label: 'Telegram + Gmail in one inbox', flo: true,  crm: false, manual: true },
  { label: 'AI priority on every conversation', flo: true, crm: false, manual: false },
  { label: 'Explains why a client is going cold', flo: true, crm: false, manual: false },
  { label: 'One-click suggested replies', flo: true, crm: true, manual: false },
  { label: 'Auto-responder bot', flo: true, crm: true, manual: false },
  { label: 'Set up in minutes, no training', flo: true, crm: false, manual: true },
]

function Cell({ on }: { on: boolean }) {
  return on
    ? <Check size={17} style={{ color: 'var(--accent)' }} />
    : <X size={16} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  return (
    <MotionConfig reducedMotion="user">
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
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

        <div
          className="hero-grid mkt-x"
          style={{ position: 'relative', zIndex: 1, maxWidth: 1140, margin: '0 auto', padding: '0 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', width: '100%' }}
        >
          {/* Left: text */}
          <motion.div variants={stagger} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>


            <motion.h1
              variants={fadeUp}
              style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(40px, 9vw, 76px)', fontWeight: 400, lineHeight: 1.05, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: '0 0 24px' }}
            >
              Never lose<br />
              <em style={{ fontStyle: 'italic' }}>another</em>
              {' '}
              <span className="gradient-text-accent">client</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 36px', maxWidth: 480 }}
            >
              Flo unifies Telegram and Gmail, shows you who to message right now, and explains exactly why you&apos;re losing clients.
            </motion.p>

            <motion.div variants={fadeUp} className="hero-cta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
              <Link href="/signup" className="btn-primary" style={{ fontSize: 15, padding: '13px 26px' }}>
                Get started free <ArrowRight size={16} />
              </Link>
              <a href="#demo" className="btn-ghost" style={{ fontSize: 15, padding: '13px 26px' }}>
                See how it works
              </a>
            </motion.div>

            <motion.div variants={fadeUp} className="hero-checks" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {['Free to start', 'Telegram + Gmail', 'No credit card'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(79,92,244,0.1)', border: '1px solid rgba(79,92,244,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={10} style={{ color: 'var(--accent)' }} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: animated mockup */}
          <motion.div className="hero-mockup" variants={fromRight} initial="hidden" animate="visible" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <HeroMockup />
          </motion.div>
        </div>
      </section>

      {/* ── Marquee strip (works with / value props) ──────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '26px 0', background: '#FFFFFF' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', margin: '0 0 20px' }}>
          One inbox for every channel
        </p>
        <div className="marquee">
          <div className="marquee-track">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
                {m.src
                  ? <img src={m.src} alt={m.name} width={20} height={20} style={{ display: 'block' }} />
                  : m.Icon && <m.Icon size={18} style={{ color: 'var(--accent)' }} />}
                <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Product Demo ──────────────────────────────────────────────────── */}
      <section id="demo" className="demo-section" style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border)' }}>
        <Section>
          <div style={{ maxWidth: 1140, margin: '0 auto' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 56 }}>
              <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>PRODUCT</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 16px', letterSpacing: '-0.03em' }}>
                Everything in one place
              </h2>
              <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto', lineHeight: 1.65 }}>
                Flo sorts your conversations by what needs attention first, so you always know where to start.
              </p>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } } }}>
              <ProductDemo />
            </motion.div>
          </div>
        </Section>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="section-padded mkt-x" style={{ padding: '100px 32px', background: 'var(--bg-base)' }}>
        <Section>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 60 }}>
              <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>FEATURES</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 14px', letterSpacing: '-0.03em' }}>
                Built around how you actually work
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
                One inbox, a clear sense of who needs you, and a head start on what to say.
              </p>
            </motion.div>
            <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <FeatureCard icon={Inbox}  title="One inbox for everything"   desc="Telegram and Gmail, side by side. Read and reply from one place instead of juggling tabs and apps." accent />
              <FeatureCard icon={Bot}    title="Auto-responder bot"          desc="Let a bot reply for you from the context you give it — and hand off to you the moment a conversation needs a human touch." />
              <FeatureCard icon={Sparkles} title="Conversation analyzer"     desc="A clear read on every thread: where it stands, what the risk is, and the next concrete step — explained in plain language." />
              <FeatureCard icon={Search} title="AI chat search"              desc="Ask in plain words — “who asked about pricing last week?” — and jump straight to the right conversation." />
              <FeatureCard icon={SlidersHorizontal} title="Smart filtering"  desc="Filter by priority, channel, or status so the inbox always shows exactly who needs you right now." />
              <FeatureCard icon={Shield} title="Notice when things go quiet" desc="When a conversation starts cooling off, Flo flags it and tells you why — so you can step in before it's too late." />
            </div>
          </div>
        </Section>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how" className="section-padded mkt-x" style={{ padding: '100px 32px', background: '#FFFFFF', borderTop: '1px solid var(--border)' }}>
        <Section>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 56 }}>
              <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>HOW IT WORKS</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
                Three steps to full control
              </h2>
            </motion.div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { n: 1, title: 'Connect Telegram and Gmail',          desc: 'Takes 2 minutes. Flo securely syncs your conversations and never stores passwords.' },
                { n: 2, title: 'Flo sorts what matters most',          desc: 'Each conversation gets a clear priority — Hot, Needs attention, Cold, or Spam — so you know where to look first.' },
                { n: 3, title: 'Write to the right clients in time',   desc: 'Flo shows you who to message right now and what to say. No more lost clients.' },
              ].map((s, i, arr) => (
                <div key={s.n}>
                  <Step n={s.n} title={s.title} desc={s.desc} />
                  {i < arr.length - 1 && <div style={{ height: 1, background: 'var(--border)', margin: '28px 0 28px 56px' }} />}
                </div>
              ))}
            </div>
          </div>
        </Section>
      </section>

      {/* ── Comparison ────────────────────────────────────────────────────── */}
      <section className="section-padded mkt-x" style={{ padding: '100px 32px', background: 'var(--bg-base)', borderTop: '1px solid var(--border)' }}>
        <Section>
          <div style={{ maxWidth: 880, margin: '0 auto' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 44 }}>
              <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>WHY FLO</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
                Not another CRM to maintain
              </h2>
            </motion.div>
            <motion.div variants={fadeUp} style={{ overflowX: 'auto' }}>
              <table className="compare">
                <thead>
                  <tr>
                    <th style={{ width: '46%' }}></th>
                    <th className="col-flo" style={{ textAlign: 'center' }}>Flo</th>
                    <th style={{ textAlign: 'center' }}>AmoCRM</th>
                    <th style={{ textAlign: 'center' }}>Pleep</th>
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
      <section className="section-padded mkt-x" style={{ padding: '100px 32px', background: '#FFFFFF', borderTop: '1px solid var(--border)' }}>
        <Section>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 44 }}>
              <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>FAQ</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
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
      <section className="mkt-x mkt-pt mkt-pb" style={{ padding: '80px 32px 120px', background: 'var(--bg-base)' }}>
        <Section>
          <motion.div
            variants={fadeUp}
            className="cta-inner"
            style={{ maxWidth: 600, margin: '0 auto', borderRadius: 24, background: 'linear-gradient(135deg, #4F5CF4 0%, #7C4DFF 100%)', textAlign: 'center', boxShadow: '0 20px 60px rgba(79,92,244,0.3)', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 400, color: '#FFFFFF', margin: '0 0 14px', letterSpacing: '-0.03em' }}>
                Ready to stop losing clients?
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', margin: '0 0 36px', lineHeight: 1.65 }}>
                Start for free. Connect Telegram and Gmail in 5 minutes.
              </p>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} style={{ display: 'inline-block' }}>
                <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', background: '#FFFFFF', color: 'var(--accent)', borderRadius: 8, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                  Get started free <ArrowRight size={16} />
                </Link>
              </motion.div>
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
