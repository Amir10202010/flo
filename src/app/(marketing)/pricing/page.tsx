'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, type Variants, MotionConfig } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { PLAN_CATALOG, PLAN_ORDER, planPrice, type BillingPlan, type BillingPeriod } from '@/lib/billing'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
}
const stagger: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }

const POPULAR: BillingPlan = 'PRO'

function priceParts(plan: BillingPlan, period: BillingPeriod): { price: string; sub: string | null } {
  const monthly = planPrice(plan, 'monthly')
  if (monthly === null) return { price: 'Custom', sub: null }
  if (monthly === 0) return { price: 'Free', sub: null }
  if (period === 'annual') {
    const annual = planPrice(plan, 'annual') as number
    return { price: `$${Math.round(annual / 12)}`, sub: `/ mo · billed $${annual}/yr` }
  }
  return { price: `$${monthly}`, sub: '/ mo' }
}

function cta(plan: BillingPlan, period: BillingPeriod): { label: string; href: string } {
  if (plan === 'ENTERPRISE') return { label: 'Talk to sales', href: '/contact' }
  if (plan === 'FREE') return { label: 'Start free', href: '/signup' }
  return { label: `Get ${PLAN_CATALOG[plan].name}`, href: `/api/billing/checkout?plan=${plan}&period=${period}` }
}

function PlanCard({ plan, period }: { plan: BillingPlan; period: BillingPeriod }) {
  const info = PLAN_CATALOG[plan]
  const { price, sub } = priceParts(plan, period)
  const accent = plan === POPULAR
  const c = cta(plan, period)
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 24px',
        borderRadius: 14,
        background: '#FFFFFF',
        border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
      }}
    >
      {accent && (
        <span style={{ position: 'absolute', top: -10, left: 24, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#fff', background: 'var(--accent)', padding: '4px 11px', borderRadius: 6 }}>
          Most popular
        </span>
      )}
      <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{info.name}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.55, minHeight: 40 }}>{info.tagline}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{price}</span>
        {sub && <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{sub}</span>}
      </div>
      <Link href={c.href} className={accent ? 'btn-primary' : 'btn-ghost'} style={{ justifyContent: 'center', textDecoration: 'none', marginBottom: 20, gap: 8 }}>
        {c.label} <ArrowRight size={14} />
      </Link>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {info.features.map((f) => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <Check size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

export default function PricingPage() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly')
  return (
    <MotionConfig reducedMotion="user">
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <Navbar />

        <section className="hero-top mkt-x" style={{ paddingLeft: 32, paddingRight: 32 }}>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="display-title"
              style={{ fontSize: 'clamp(32px, 4.6vw, 46px)', margin: '0 0 16px' }}
            >
              Start solo, grow into a team
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
              style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 22px' }}
            >
              Flat pricing, no setup fees. Free for one mailbox; upgrade for full AI and your team.
            </motion.p>

            <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, border: '1px solid var(--border)', background: '#fff' }}>
              {(['monthly', 'annual'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    padding: '7px 16px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    color: period === p ? '#fff' : 'var(--text-secondary)',
                    background: period === p ? 'var(--text-primary)' : 'transparent',
                  }}
                >
                  {p === 'monthly' ? 'Monthly' : 'Annual · 2 months free'}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="section-padded mkt-x" style={{ paddingTop: 30, paddingBottom: 100, paddingLeft: 32, paddingRight: 32 }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="pricing-grid"
            style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, alignItems: 'stretch' }}
          >
            {PLAN_ORDER.map((p) => <PlanCard key={p} plan={p} period={period} />)}
          </motion.div>
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
