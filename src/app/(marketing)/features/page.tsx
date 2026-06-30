'use client'

import React from 'react'
import Link from 'next/link'
import { motion, type Variants, MotionConfig } from 'framer-motion'
import { ArrowRight, Check, Search, Bot, Mail, LayoutDashboard, type LucideIcon } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { SearchDemo, RoutingRulesDemo, GmailConnectDemo, DashboardDemo } from '@/components/marketing/FeatureDemos'

const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}
const stagger: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }

type Row = {
  icon: LucideIcon
  eyebrow: string
  title: string
  desc: string
  points: string[]
  demo: React.ReactNode
}

const ROWS: Row[] = [
  {
    icon: Mail,
    eyebrow: 'Shared inbox',
    title: 'One mailbox, your whole team',
    desc: 'Connect a shared Gmail mailbox and invite teammates with roles. Every thread becomes a queue item your team can assign, snooze, close, tag and discuss together.',
    points: ['Assign threads to a teammate', 'Open / Snoozed / Closed states', 'Internal notes the customer never sees'],
    demo: <GmailConnectDemo />,
  },
  {
    icon: LayoutDashboard,
    eyebrow: 'Team command center',
    title: 'Your team’s queue on one screen',
    desc: 'Open Velnox and instantly see inbox health, who’s waiting, which accounts are at-risk and who’s handling what — with AI ranking the next best action.',
    points: ['See who’s on what, at a glance', 'AI-ranked next best actions', 'Risk alerts before an account goes quiet'],
    demo: <DashboardDemo />,
  },
  {
    icon: Search,
    eyebrow: 'AI triage & search',
    title: 'Find any thread by meaning',
    desc: 'Ask in plain words — “who asked about the enterprise plan?” — and Velnox surfaces the right thread instantly, then drafts a reply in your team’s voice.',
    points: ['Semantic search across the shared inbox', 'Priority, risk and sentiment on every thread', 'Review-before-send AI drafts'],
    demo: <SearchDemo />,
  },
  {
    icon: Bot,
    eyebrow: 'Rules & automations',
    title: 'Route every message automatically',
    desc: 'Set rules that auto-assign and tag incoming mail by inbox, sender, domain or subject — so the right person picks it up without anyone triaging by hand.',
    points: ['Auto-assign by inbox or sender', 'Auto-tag and set priority', 'Roles, permissions & a full audit log'],
    demo: <RoutingRulesDemo />,
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
        <h2 className="display-title" style={{ fontSize: 'clamp(24px, 3.2vw, 34px)', lineHeight: 1.14, margin: '0 0 14px' }}>
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
        <section className="hero-top mkt-x" style={{ paddingLeft: 32, paddingRight: 32 }}>
          <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
            <motion.h1
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="display-title"
              style={{ fontSize: 'clamp(34px, 5vw, 54px)', margin: '0 0 18px' }}
            >
              Everything your team needs to stay on top of the inbox
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.08 }} style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 auto', maxWidth: 520 }}>
              Shared handling, AI triage, routing and search — built to turn a busy mailbox into a coordinated team queue.
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
        <section className="mkt-x" style={{ padding: '40px 32px 110px' }}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} style={{ maxWidth: 760, margin: '0 auto' }}>
            <div className="lp-cta">
              <h2 className="display-title" style={{ fontSize: 'clamp(24px, 3vw, 34px)', color: '#fff', margin: '0 0 12px' }}>
                Bring your team onto one inbox
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.72)', margin: '0 0 28px', lineHeight: 1.6 }}>
                Set up in minutes. Free to start, invite your whole team.
              </p>
              <Link href="/signup" className="lp-cta-btn">Get started free <ArrowRight size={16} /></Link>
            </div>
          </motion.div>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
