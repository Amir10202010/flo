'use client'

import Link from 'next/link'
import { motion, type Variants, MotionConfig } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
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

type Plan = {
  name: string
  price: string
  period?: string
  desc: string
  features: string[]
  cta: string
  href: string
  accent?: boolean
}

// Drop a Stripe Payment Link / LemonSqueezy / Paddle checkout URL into
// NEXT_PUBLIC_CHECKOUT_URL to turn the Pro CTA into a real paid checkout.
// Until then it falls back to /signup so the flow still works end-to-end.
const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL || '/signup'

const plans: Plan[] = [
  {
    name: 'Starter',
    price: 'Free',
    desc: 'See Velnox on your own Gmail and get your inbox sorted.',
    features: [
      'Connect 1 Gmail account',
      'Up to 100 client threads / month',
      'AI priority labels (Hot · Attention · Cold · Spam)',
      'Basic conversation analysis',
    ],
    cta: 'Get early access',
    href: '/signup',
  },
  {
    name: 'Pro',
    price: '$39',
    period: '/ month',
    desc: 'For client-facing teams who can’t afford to let a deal go cold.',
    features: [
      'Unlimited client threads',
      'Full AI analysis — why a deal is at risk and what to say instead',
      'One-click AI-drafted replies',
      'Smart “reply now” alerts before a client goes cold',
      'Conversation health score',
      'Priority email support',
    ],
    cta: 'Get Velnox Pro',
    href: CHECKOUT_URL,
    accent: true,
  },
  {
    name: 'Agency',
    price: 'Custom',
    desc: 'For agencies and studios running several inboxes at once.',
    features: [
      'Everything in Pro',
      'Multiple Gmail accounts',
      'Shared team inbox',
      'Weekly missed-client report',
      'Win / loss analysis',
      'Dedicated onboarding',
    ],
    cta: 'Talk to us',
    href: '/contact',
  },
]

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 28px',
        borderRadius: 18,
        background: plan.accent ? 'linear-gradient(180deg, rgba(79,92,244,0.05) 0%, #FFFFFF 40%)' : '#FFFFFF',
        border: `1px solid ${plan.accent ? 'rgba(79,92,244,0.25)' : 'var(--border)'}`,
        boxShadow: plan.accent ? '0 12px 40px rgba(79,92,244,0.12)' : 'var(--shadow-sm)',
        position: 'relative',
      }}
    >
      {plan.accent && (
        <span style={{ position: 'absolute', top: -12, left: 28, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: 'var(--accent)', padding: '5px 12px', borderRadius: 999 }}>
          Most popular
        </span>
      )}
      <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{plan.name}</h3>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 22px', lineHeight: 1.6, minHeight: 42 }}>{plan.desc}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 26 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{plan.price}</span>
        {plan.period && <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{plan.period}</span>}
      </div>
      <Link
        href={plan.href}
        className={plan.accent ? 'btn-primary' : 'btn-ghost'}
        style={{ justifyContent: 'center', textDecoration: 'none', marginBottom: 26, gap: 8 }}
      >
        {plan.cta} <ArrowRight size={14} />
      </Link>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {plan.features.map(f => (
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
              Pricing that pays for itself <span style={{ color: 'var(--accent)' }}>the first client you keep</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
              style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}
            >
              Start free on your own Gmail. Upgrade to Pro the moment you’re done losing deals to a buried inbox — cancel anytime, no card to start.
            </motion.p>
          </div>
        </section>

        <section className="section-padded mkt-x" style={{ paddingTop: 24, paddingBottom: 100, paddingLeft: 32, paddingRight: 32 }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="pricing-grid"
            style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, alignItems: 'stretch' }}
          >
            {plans.map(p => <PlanCard key={p.name} plan={p} />)}
          </motion.div>
        </section>

        {/* ── ROI / value framing ─────────────────────────────────────────── */}
        <section className="mkt-x" style={{ padding: '0 32px 64px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 32px', borderRadius: 18, background: 'linear-gradient(180deg, rgba(79,92,244,0.05), #FFFFFF)', border: '1px solid rgba(79,92,244,0.18)', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              One saved client pays for a year of Velnox.
            </p>
            <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
              If a single client is worth more than $39 to you, Pro pays for itself the first time it catches a deal going cold — and gives you back the hours you’d spend digging through Gmail.
            </p>
          </div>
        </section>

        <section className="mkt-x mkt-pb" style={{ padding: '0 32px 120px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Have questions about which plan fits your team?{' '}
              <Link href="/contact" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>Get in touch</Link>.
            </p>
          </div>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
