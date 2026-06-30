'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, MotionConfig, AnimatePresence, type Variants } from 'framer-motion'
import {
  ArrowRight, Check, X, Inbox, UserPlus, MessageSquare,
  SlidersHorizontal, Sparkles, ShieldCheck, Plus, type LucideIcon,
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
  { icon: Inbox, title: 'One shared inbox', desc: 'Your whole team works a single Gmail queue — sorted by priority, with the assignee right on the row.' },
  { icon: UserPlus, title: 'Assignment & ownership', desc: 'Assign any thread, move it through Open / Snoozed / Closed, and always see who’s handling what. No collisions.' },
  { icon: MessageSquare, title: 'Internal notes', desc: 'Discuss a thread with your team right inside it — private notes the customer never sees.' },
  { icon: SlidersHorizontal, title: 'Routing rules', desc: 'Auto-assign and tag incoming mail by sender, subject or inbox, so every message lands on the right person.' },
  { icon: Sparkles, title: 'AI triage & drafts', desc: 'A clear priority, risk flags, and a drafted reply on every thread — review-before-send, never auto-sent.' },
  { icon: ShieldCheck, title: 'Roles & audit log', desc: 'Owner, Admin, Member and Viewer roles, with an audit log of every action across the workspace.' },
]

const STEPS = [
  { n: 1, title: 'Connect a shared inbox', desc: 'An admin connects a shared Gmail mailbox with Google OAuth and invites teammates with roles — in minutes.' },
  { n: 2, title: 'Velnox triages & routes', desc: 'Every thread gets a priority and risk read; routing rules auto-assign and tag incoming mail to the right person.' },
  { n: 3, title: 'Assign, discuss, reply', desc: 'Your team works one queue — assign, leave internal notes, and send AI-drafted replies. Nothing slips.' },
]

// crm = legacy help desk, manual = a plain shared Gmail mailbox
const COMPARE: { label: string; flo: boolean; crm: boolean; manual: boolean }[] = [
  { label: 'Works on the Gmail your team already uses', flo: true, crm: false, manual: true },
  { label: 'Assign threads to a teammate', flo: true, crm: true, manual: false },
  { label: 'Internal notes & collision-free handling', flo: true, crm: true, manual: false },
  { label: 'AI triage, risk flags & drafted replies', flo: true, crm: false, manual: false },
  { label: 'Roles, permissions & audit log', flo: true, crm: true, manual: false },
  { label: 'Live in minutes, no migration', flo: true, crm: false, manual: true },
]

const FAQS = [
  { q: 'How does Velnox connect to our mailbox?', a: 'An admin connects a shared Gmail mailbox (support@, sales@, hello@…) in two clicks with Google’s secure OAuth — Velnox never sees or stores a password. Threads start syncing within minutes.' },
  { q: 'How does the team work together on one inbox?', a: 'Every conversation can be assigned to a teammate, moved through Open / Snoozed / Closed, tagged, and discussed with internal notes only your team sees.' },
  { q: 'What does the AI actually do?', a: 'It reads each thread, assigns a clear priority, flags accounts going at-risk, and drafts a reply in your team’s voice — review-before-send, never auto-sent. Routing rules can auto-assign and tag incoming mail.' },
  { q: 'How do roles and permissions work?', a: 'Four roles — Owner, Admin, Member, Viewer. Members work the inbox; Admins manage members, inboxes, rules and billing; Viewers get read-only access. Every change is recorded in the audit log.' },
  { q: 'Is our data private and secure?', a: 'OAuth tokens are encrypted at rest (AES-256-GCM), data is scoped per organization, and conversations are only ever used to power your own workspace. We never sell or share your data.' },
]

function Cell({ on }: { on: boolean }) {
  return on
    ? <Check size={17} style={{ color: 'var(--text-primary)' }} />
    : <X size={15} style={{ color: 'var(--text-muted)', opacity: 0.55 }} />
}

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

  return (
    <MotionConfig reducedMotion="user">
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <Navbar />

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="hero-top mkt-x" style={{ padding: '140px 32px 72px', maxWidth: 1140, margin: '0 auto' }}>
          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 64, alignItems: 'center' }}>
            <div>
              <motion.h1
                className="display-title"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                style={{ fontSize: 'clamp(38px, 5.6vw, 60px)', margin: '0 0 20px' }}
              >
                One shared inbox for your whole team
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
                style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px', maxWidth: 480 }}
              >
                Velnox turns your team’s shared Gmail into one AI-triaged queue — assign threads, leave
                internal notes, and send AI-drafted replies. Built for support, sales and ops teams.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="hero-cta"
                style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}
              >
                <Link href="/signup" className="btn-primary" style={{ fontSize: 15 }}>
                  Get early access <ArrowRight size={16} />
                </Link>
                <a href="#demo" className="btn-ghost" style={{ fontSize: 15 }}>See how it works</a>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}
              >
                Connect a shared Gmail in two clicks · AES-256 encrypted · we never store your password.
              </motion.p>
            </div>

            <motion.div
              className="hero-mockup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: 'flex', justifyContent: 'center' }}
            >
              <HeroMockup />
            </motion.div>
          </div>
        </section>

        {/* ── Integrations line ───────────────────────────────────────────── */}
        <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div className="mkt-x" style={{ maxWidth: 1140, margin: '0 auto', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <img src="/icons/gmail.svg" alt="" width={20} height={20} style={{ display: 'block' }} />
            <span style={{ fontSize: 14.5, color: 'var(--text-secondary)' }}>
              Works on the <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Gmail</strong> your team already uses.
            </span>
            <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Telegram, WhatsApp & Instagram coming soon.</span>
          </div>
        </section>

        {/* ── Product demo ────────────────────────────────────────────────── */}
        <section id="demo" className="section-padded mkt-x" style={{ padding: '96px 32px', background: 'var(--bg-base)' }}>
          <div style={{ maxWidth: 1140, margin: '0 auto' }}>
            <SectionHead
              title="Your team’s inbox, in one place"
              sub="Velnox sorts the shared mailbox by what needs attention — and shows who’s handling what, so nothing gets dropped or double-answered."
            />
            <Reveal><ProductDemo /></Reveal>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <section className="section-padded mkt-x" style={{ padding: '96px 32px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <SectionHead title="Built for how teams actually work" sub="One shared queue, clear ownership on every thread, and a head start on every reply." />
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

        {/* ── How it works ────────────────────────────────────────────────── */}
        <section className="section-padded mkt-x" style={{ padding: '96px 32px', background: 'var(--bg-base)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <SectionHead title="Three steps to a calmer inbox" />
            <div className="lp-steps">
              {STEPS.map(s => (
                <Reveal key={s.n} className="lp-step">
                  <span className="lp-step-n">{s.n}</span>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>{s.title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison ──────────────────────────────────────────────────── */}
        <section className="section-padded mkt-x" style={{ padding: '96px 32px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 880, margin: '0 auto' }}>
            <SectionHead title="Not another help desk to migrate to" />
            <Reveal style={{ overflowX: 'auto' }}>
              <table className="compare">
                <thead>
                  <tr>
                    <th style={{ width: '46%' }}></th>
                    <th className="col-flo" style={{ textAlign: 'center' }}>Velnox</th>
                    <th style={{ textAlign: 'center' }}>Help desk</th>
                    <th style={{ textAlign: 'center' }}>Shared Gmail</th>
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
            </Reveal>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section className="section-padded mkt-x" style={{ padding: '96px 32px', background: 'var(--bg-base)', borderTop: '1px solid var(--border)' }}>
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
                Ready to get your team’s inbox under control?
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.72)', margin: '0 0 28px', lineHeight: 1.6, maxWidth: 460 }}>
                Connect a shared inbox, invite your team, and give every thread an owner — set up in minutes.
              </p>
              <Link href="/signup" className="lp-cta-btn">
                Get early access <ArrowRight size={16} />
              </Link>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '16px 0 0' }}>No credit card · Free to start</p>
            </div>
          </Reveal>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
