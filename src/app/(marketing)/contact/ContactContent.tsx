'use client'

import Link from 'next/link'
import { motion, type Variants, MotionConfig } from 'framer-motion'
import { ArrowRight, Mail, MessageCircle } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { SUPPORT_EMAIL } from '@/lib/constants'

const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
}

export default function ContactContent() {
  return (
    <MotionConfig reducedMotion="user">
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <Navbar />

        {/* ── Intro ─────────────────────────────────────────────────────────── */}
        <section className="hero-top mkt-x" style={{ paddingLeft: 32, paddingRight: 32 }}>
          <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="display-title"
              style={{ fontSize: 'clamp(32px, 4.6vw, 46px)', margin: '0 0 16px' }}
            >
              Get in touch
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
              style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}
            >
              Questions, feedback, or just want to say hi — we read every message and reply quickly.
            </motion.p>
          </div>
        </section>

        {/* ── Contact options ───────────────────────────────────────────────── */}
        <section className="mkt-x mkt-pb" style={{ padding: '0 32px 120px' }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="features-grid"
            style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}
          >
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              style={{ display: 'block', padding: '28px 26px', borderRadius: 16, background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', textDecoration: 'none' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Mail size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>Email us</h3>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.65 }}>
                For support, sales questions, or anything in between.
              </p>
              <span style={{ fontSize: 13.5, color: 'var(--accent)', fontWeight: 600 }}>{SUPPORT_EMAIL} →</span>
            </a>

            <div
              style={{ padding: '28px 26px', borderRadius: 16, background: '#FFFFFF', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <MessageCircle size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <h3 style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>Talk to us first</h3>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.65 }}>
                Not sure if Velnox fits your workflow? Try it free — no card required — and tell us what you find.
              </p>
              <Link href="/signup" style={{ fontSize: 13.5, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Create a free account →</Link>
            </div>
          </motion.div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="mkt-x mkt-pb" style={{ padding: '0 32px 120px' }}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} style={{ maxWidth: 760, margin: '0 auto' }}>
            <div className="lp-cta">
              <h2 className="display-title" style={{ fontSize: 'clamp(22px, 3vw, 30px)', color: '#fff', margin: '0 0 12px' }}>
                Prefer to just dive in?
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', margin: '0 0 26px', lineHeight: 1.6 }}>
                Set up your inbox in a couple of minutes — free to start, no credit card needed.
              </p>
              <Link href="/signup" className="lp-cta-btn">Try Velnox for free <ArrowRight size={15} /></Link>
            </div>
          </motion.div>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
