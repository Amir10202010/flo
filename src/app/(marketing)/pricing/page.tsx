'use client'

import Link from 'next/link'
import { motion, type Variants, MotionConfig } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { PLAN_CATALOG, PLAN_ORDER, type BillingPlan } from '@/lib/billing'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
}
const stagger: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }

// Drop a Stripe Payment Link / LemonSqueezy / Paddle checkout URL into
// NEXT_PUBLIC_CHECKOUT_URL to turn the paid CTAs into a real checkout.
const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL || '/signup'

const POPULAR: BillingPlan = 'TEAM'

function priceParts(plan: BillingPlan): { price: string; period: string | null } {
  const p = PLAN_CATALOG[plan].priceMonthly
  if (p === null) return { price: 'Custom', period: null }
  if (p === 0) return { price: 'Free', period: null }
  return { price: `$${p}`, period: '/ mo' }
}

function cta(plan: BillingPlan): { label: string; href: string } {
  if (plan === 'ENTERPRISE') return { label: 'Talk to sales', href: '/contact' }
  if (plan === 'FREE') return { label: 'Start free', href: '/signup' }
  return { label: `Get ${PLAN_CATALOG[plan].name}`, href: CHECKOUT_URL }
}

function PlanCard({ plan }: { plan: BillingPlan }) {
  const info = PLAN_CATALOG[plan]
  const { price, period } = priceParts(plan)
  const accent = plan === POPULAR
  const c = cta(plan)
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '30px 26px',
        borderRadius: 18,
        background: accent ? 'linear-gradient(180deg, rgba(79,92,244,0.05) 0%, #FFFFFF 40%)' : '#FFFFFF',
        border: `1px solid ${accent ? 'rgba(79,92,244,0.25)' : 'var(--border)'}`,
        boxShadow: accent ? '0 12px 40px rgba(79,92,244,0.12)' : 'var(--shadow-sm)',
        position: 'relative',
      }}
    >
      {accent && (
        <span style={{ position: 'absolute', top: -12, left: 26, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: 'var(--accent)', padding: '5px 12px', borderRadius: 999 }}>
          Most popular
        </span>
      )}
      <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{info.name}</h3>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.6, minHeight: 42 }}>{info.tagline}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 22 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{price}</span>
        {period && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{period}</span>}
      </div>
      <Link href={c.href} className={accent ? 'btn-primary' : 'btn-ghost'} style={{ justifyContent: 'center', textDecoration: 'none', marginBottom: 22, gap: 8 }}>
        {c.label} <ArrowRight size={14} />
      </Link>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {info.features.map((f) => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <Check size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

export default function PricingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <Navbar />

        <section className="hero-top mkt-x" style={{ paddingLeft: 32, paddingRight: 32 }}>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 16px' }}
            >
              Pricing that scales with <span style={{ color: 'var(--accent)' }}>your team</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
              style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}
            >
              Per-seat, no setup fees. Start free, upgrade when your team grows. Every plan includes the AI-triaged shared inbox.
            </motion.p>
          </div>
        </section>

        <section className="section-padded mkt-x" style={{ paddingTop: 30, paddingBottom: 100, paddingLeft: 32, paddingRight: 32 }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="pricing-grid"
            style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, alignItems: 'stretch' }}
          >
            {PLAN_ORDER.map((p) => <PlanCard key={p} plan={p} />)}
          </motion.div>
        </section>

        <section className="mkt-x" style={{ padding: '0 32px 64px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 32px', borderRadius: 18, background: 'linear-gradient(180deg, rgba(79,92,244,0.05), #FFFFFF)', border: '1px solid rgba(79,92,244,0.18)', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              One faster reply pays for the whole team.
            </p>
            <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
              Velnox turns a shared mailbox into a coordinated queue — assignments, internal notes and AI drafts — so nothing slips and every customer gets answered.
            </p>
          </div>
        </section>

        <section className="mkt-x mkt-pb" style={{ padding: '0 32px 120px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Need SSO, custom retention or a security review?{' '}
              <Link href="/contact" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>Talk to our team</Link>.
            </p>
          </div>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
