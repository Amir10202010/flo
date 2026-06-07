'use client'

import React from 'react'
import Link from 'next/link'
import { motion, type Variants, MotionConfig } from 'framer-motion'
import { ArrowRight, Check, Zap, Shield, Eye } from 'lucide-react'
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

export default function LandingPage() {
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
          background: `
            radial-gradient(ellipse 70% 50% at 65% 40%, rgba(79,92,244,0.05) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 10% 70%, rgba(124,77,255,0.04) 0%, transparent 60%),
            var(--bg-base)
          `,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: 'radial-gradient(circle, #D4D8F0 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.45, pointerEvents: 'none' }} />

        <div
          className="hero-grid"
          style={{ position: 'relative', zIndex: 1, maxWidth: 1140, margin: '0 auto', padding: '0 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', width: '100%' }}
        >
          {/* Left: text */}
          <motion.div variants={stagger} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
              <span className="tag tag-accent">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                AI for sales managers
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(48px, 5.5vw, 76px)', fontWeight: 400, lineHeight: 1.04, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: '0 0 24px' }}
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

            <motion.div variants={fadeUp} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
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

      {/* ── Integrations strip ────────────────────────────────────────────── */}
      <Section>
        <motion.div variants={fadeUp} style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '36px 32px', background: '#FFFFFF' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
              WORKS WITH
            </p>
            {[
              { name: 'Telegram', icon: '✈', bg: 'rgba(42,171,238,0.07)', border: 'rgba(42,171,238,0.2)' },
              { name: 'Gmail',    icon: '✉', bg: 'rgba(234,67,53,0.06)',  border: 'rgba(234,67,53,0.18)' },
            ].map(ch => (
              <motion.div key={ch.name} whileHover={{ y: -1 }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 20px', borderRadius: 10, border: `1px solid ${ch.border}`, background: ch.bg, cursor: 'default' }}>
                <span style={{ fontSize: 17 }}>{ch.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{ch.name}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </Section>

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
                AI reads your conversations, sets priorities, and tells you exactly what to do next.
              </p>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } } }}>
              <ProductDemo />
            </motion.div>
          </div>
        </Section>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="section-padded" style={{ padding: '100px 32px', background: 'var(--bg-base)' }}>
        <Section>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 60 }}>
              <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>FEATURES</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 14px', letterSpacing: '-0.03em' }}>
                Everything you need to close deals
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
                From a unified inbox to AI analysis of every conversation.
              </p>
            </motion.div>
            <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <FeatureCard icon={Zap}    title="Unified Inbox"      desc="Telegram and Gmail in one view. Never switch between apps again."                      accent />
              <FeatureCard icon={Shield} title="Risk Detection"     desc="Flo alerts you when a client is about to churn — and explains why — before it happens." />
              <FeatureCard icon={Eye}    title="Conversation AI"    desc="A clear summary of every thread and the next concrete action, powered by Gemini." />
            </div>
          </div>
        </Section>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section id="how" className="section-padded" style={{ padding: '100px 32px', background: '#FFFFFF', borderTop: '1px solid var(--border)' }}>
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
                { n: 2, title: 'AI analyzes every conversation',       desc: 'Gemini studies your conversation history and assigns priorities: HOT, ATTENTION, COLD, SPAM.' },
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

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px 120px', background: 'var(--bg-base)' }}>
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
