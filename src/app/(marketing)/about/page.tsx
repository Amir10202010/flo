'use client'

import React from 'react'
import Link from 'next/link'
import { motion, type Variants, MotionConfig } from 'framer-motion'
import { ArrowRight, Target, Users, Sparkles, type LucideIcon } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
}

const stagger: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
}

function ValueCard({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <motion.div
      variants={fadeUp}
      style={{
        padding: '26px 24px',
        borderRadius: 16,
        background: '#FFFFFF',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon size={18} style={{ color: 'var(--accent)' }} />
      </div>
      <h3 style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>{title}</h3>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>{desc}</p>
    </motion.div>
  )
}

export default function AboutPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <Navbar />

        {/* ── Intro ─────────────────────────────────────────────────────────── */}
        <section className="hero-top mkt-x" style={{ paddingLeft: 32, paddingRight: 32 }}>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 16px' }}
            >
              Built for teams tired of <span style={{ color: 'var(--accent)' }}>dropped threads</span> in a shared inbox
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
              style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}
            >
              Velnox started from a simple frustration: a team sharing one mailbox, nobody sure who&apos;s replying
              to what, important threads slipping through the cracks. We built the shared inbox we wished we had.
            </motion.p>
          </div>
        </section>

        {/* ── Mission ───────────────────────────────────────────────────────── */}
        <section className="mkt-x mkt-pb" style={{ padding: '0 32px 80px' }}>
          <div className="mkt-card" style={{ maxWidth: 760, margin: '0 auto', padding: '36px 40px', borderRadius: 20, background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 12px' }}>Our mission</h2>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
              Give every team the clarity of a world-class operation — one place to see who&apos;s handling what,
              which conversations need attention now, and exactly what to say next.
            </p>
          </div>
        </section>

        {/* ── Values ────────────────────────────────────────────────────────── */}
        <section className="section-padded mkt-x" style={{ padding: '0 32px 100px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 12px' }}>
                What we care about
              </h2>
              <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', margin: 0 }}>The principles behind every feature we ship.</p>
            </div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
              className="features-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}
            >
              <ValueCard icon={Target} title="Clarity over clutter" desc="A clean, minimal inbox that surfaces what matters and hides what doesn't — no dashboards full of numbers nobody reads." />
              <ValueCard icon={Sparkles} title="AI that explains itself" desc="Every priority label and suggestion comes with a reason, so you can trust it, learn from it, and override it when needed." />
              <ValueCard icon={Users} title="Built for real teams" desc="Roles, assignment and internal notes designed for a team working one inbox together — fast, reliable, and accountable." />
            </motion.div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="mkt-x mkt-pb" style={{ padding: '0 32px 120px' }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="cta-inner"
            style={{ maxWidth: 600, margin: '0 auto', borderRadius: 24, padding: '48px 40px', background: 'linear-gradient(135deg, #4F5CF4 0%, #7C4DFF 100%)', textAlign: 'center', boxShadow: '0 20px 60px rgba(79,92,244,0.3)' }}
          >
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 400, color: '#FFFFFF', margin: '0 0 12px', letterSpacing: '-0.03em' }}>
              Want to talk to us?
            </h2>
            <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.8)', margin: '0 0 28px', lineHeight: 1.6 }}>
              Reach out at <a href="mailto:sagindiktar@gmail.com" style={{ color: '#fff', fontWeight: 600 }}>sagindiktar@gmail.com</a> — we read every message.
            </p>
            <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 26px', background: '#FFFFFF', color: 'var(--accent)', borderRadius: 8, fontSize: 14.5, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
              Try Velnox for free <ArrowRight size={15} />
            </Link>
          </motion.div>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
