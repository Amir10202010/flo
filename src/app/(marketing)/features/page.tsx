'use client'

import React from 'react'
import Link from 'next/link'
import { motion, type Variants, MotionConfig } from 'framer-motion'
import { ArrowRight, Check, Search, Bot, Mail } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { SearchDemo, BotSetupDemo, GmailConnectDemo } from '@/components/marketing/FeatureDemos'

const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}
const stagger: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }

type Row = {
  icon: React.ElementType
  eyebrow: string
  title: string
  desc: string
  points: string[]
  demo: React.ReactNode
}

const ROWS: Row[] = [
  {
    icon: Mail,
    eyebrow: 'One-click setup',
    title: 'Connect Gmail in seconds',
    desc: 'Secure Google sign-in, no passwords stored. Velnox imports your recent client threads and starts prioritising them right away.',
    points: ['Secure OAuth — no passwords', 'Imports recent threads automatically', 'Live priority from the first sync'],
    demo: <GmailConnectDemo />,
  },
  {
    icon: Search,
    eyebrow: 'AI chat search',
    title: 'Find any client thread by meaning',
    desc: 'Ask in plain words — “who asked about the premium package?” — and Velnox surfaces the right Gmail thread instantly, then helps you close it.',
    points: ['Semantic search, not just keywords', 'Works across your whole Gmail', 'Jump from search straight to a reply'],
    demo: <SearchDemo />,
  },
  {
    icon: Bot,
    eyebrow: 'Auto-responder bot · Coming soon',
    title: 'Soon: let a bot reply for you',
    desc: 'Paste in your business details once. The bot will answer common questions from that context in your tone — and hand off to you the moment a human is needed.',
    points: ['Answers from your own knowledge', 'Always on, even after hours', 'Seamless human hand-off'],
    demo: <BotSetupDemo />,
  },
]

function FeatureRow({ row, flip }: { row: Row; flip: boolean }) {
  const Icon = row.icon
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      variants={stagger}
      className="feature-row"
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}
    >
      <motion.div variants={fadeUp} className="feature-row-text" style={{ order: flip ? 2 : 1 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-dim)', border: '1px solid rgba(79,92,244,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={17} style={{ color: 'var(--accent)' }} />
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>{row.eyebrow}</span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 3.4vw, 38px)', fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 14px', lineHeight: 1.12 }}>
          {row.title}
        </h2>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 22px', maxWidth: 440 }}>{row.desc}</p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {row.points.map(p => (
            <li key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, color: 'var(--text-primary)' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(79,92,244,0.1)', border: '1px solid rgba(79,92,244,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={11} style={{ color: 'var(--accent)' }} />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div variants={fadeUp} className="feature-row-demo" style={{ order: flip ? 1 : 2 }}>
        {row.demo}
      </motion.div>
    </motion.div>
  )
}

export default function FeaturesPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <Navbar />

        {/* Hero */}
        <section className="hero-top mkt-x" style={{ paddingLeft: 32, paddingRight: 32, position: 'relative', overflow: 'hidden' }}>
          <div className="mesh mesh-soft" />
          <div className="mesh-veil" />
          <div className="dot-grid" />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16 }}>
              FEATURES
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: 'easeOut' }}
              style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 5.5vw, 60px)', fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1.05, margin: '0 0 20px' }}
            >
              Everything you need to <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>close more deals</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }} style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 auto', maxWidth: 520 }}>
              Search, automation, and one-click setup — built to turn conversations into customers.
            </motion.p>
          </div>
        </section>

        {/* Feature rows */}
        <section className="mkt-x" style={{ padding: '0 32px 40px' }}>
          <div className="feature-rows" style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 110 }}>
            {ROWS.map((row, i) => <FeatureRow key={row.eyebrow} row={row} flip={i % 2 === 1} />)}
          </div>
        </section>

        {/* CTA */}
        <section className="mkt-x mkt-pt mkt-pb" style={{ padding: '100px 32px 120px' }}>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="cta-inner"
            style={{ maxWidth: 600, margin: '0 auto', borderRadius: 24, background: 'linear-gradient(135deg, #4F5CF4 0%, #7C4DFF 100%)', textAlign: 'center', boxShadow: '0 20px 60px rgba(79,92,244,0.3)', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 400, color: '#FFFFFF', margin: '0 0 14px', letterSpacing: '-0.03em' }}>
                See it on your own inbox
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', margin: '0 0 32px', lineHeight: 1.65 }}>
                Connect Gmail in minutes. Free to start, no credit card.
              </p>
              <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', background: '#FFFFFF', color: 'var(--accent)', borderRadius: 8, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                Get started free <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
