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

const plans: Plan[] = [
  {
    name: 'Starter',
    price: 'Free',
    desc: 'For solo managers getting their inbox under control.',
    features: [
      'Up to 200 conversations / month',
      'Unified Gmail inbox',
      'AI priority labels (Hot · Attention · Cold · Spam)',
      'Basic conversation analysis',
    ],
    cta: 'Get started free',
    href: '/signup',
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/ month',
    desc: 'For managers who live in their inbox every day.',
    features: [
      'Unlimited conversations',
      'Telegram + Instagram + WhatsApp + Gmail',
      'AI auto-responder bot — lets the bot reply for you',
      'Full AI analysis: where you lost the client, what to say instead',
      'Smart "reply now" notifications',
      'Conversation score (1–10)',
      'Priority support',
    ],
    cta: 'Start free trial',
    href: '/signup',
    accent: true,
  },
  {
    name: 'Team',
    price: 'Custom',
    desc: 'For agencies and teams managing multiple inboxes.',
    features: [
      'Everything in Pro',
      'Team access & shared inbox',
      'Weekly mistakes report',
      'Win / loss analysis',
      'Lightweight CRM features',
      'Dedicated onboarding',
    ],
    cta: 'Talk to us',
    href: '/about',
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
              Simple pricing, <span style={{ color: 'var(--accent)' }}>for every team size</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
              style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}
            >
              Start free, upgrade when your inbox grows. No hidden fees, cancel anytime.
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

        <section className="mkt-x mkt-pb" style={{ padding: '0 32px 120px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Have questions about which plan fits your team?{' '}
              <Link href="/about" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>Get in touch</Link>.
            </p>
          </div>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
