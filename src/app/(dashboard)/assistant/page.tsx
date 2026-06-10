import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CalendarClock,
  CircleCheck,
  MessagesSquare,
  PenLine,
  ShieldAlert,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { Reveal } from '@/components/dashboard/Motion'
import ModulePill, { type ModuleStatus } from '@/components/dashboard/ModulePill'
import AssistantComposer from '@/components/dashboard/AssistantComposer'

export const metadata: Metadata = { title: 'AI Assistant — Velnox' }

const CAPABILITIES: {
  icon: React.ReactNode
  title: string
  desc: string
  status: ModuleStatus
  href?: string
}[] = [
  {
    icon: <BrainCircuit size={15} />,
    title: 'Thread summaries & risk flags',
    desc: 'Every synced conversation is analyzed: summary, churn risk, sentiment and a suggested next step.',
    status: 'live',
    href: '/inbox',
  },
  {
    icon: <ShieldAlert size={15} />,
    title: 'Churn-risk monitoring',
    desc: 'Clients going cold are flagged on the dashboard and Risk Monitor automatically.',
    status: 'live',
    href: '/risk',
  },
  {
    icon: <PenLine size={15} />,
    title: 'Drafted replies in your voice',
    desc: 'One-click reply drafts grounded in the full thread history and your past replies.',
    status: 'soon',
  },
  {
    icon: <CalendarClock size={15} />,
    title: 'Weekly relationship digest',
    desc: 'A Monday-morning brief: trends, quiet clients and your top three actions.',
    status: 'soon',
  },
]

const GROUNDING = [
  'Your synced Gmail threads and contacts',
  'AI analyses: summaries, risk levels, sentiment',
  'Engagement metrics: reply times, cadence, activity',
]

export default async function AssistantPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            AI Assistant
          </h1>
          <ModulePill status="beta" />
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
          A conversational layer over everything Velnox already knows about your clients.
        </p>
      </Reveal>

      {/* Hero */}
      <Reveal delay={0.06}>
        <div
          className="widget"
          style={{
            alignItems: 'center',
            textAlign: 'center',
            padding: '46px 28px 38px',
            background: 'linear-gradient(180deg, rgba(79,92,244,0.045), rgba(255,255,255,0)), #FFFFFF',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 15,
              background: 'linear-gradient(135deg, #4F5CF4, #6D44F5)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 28px rgba(79,92,244,0.35)',
              marginBottom: 16,
            }}
          >
            <Bot size={24} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Ask anything about your clients
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 460, lineHeight: 1.6 }}>
            The assistant answers from your real workspace — threads, analyses and engagement signals — not from thin air.
          </p>
          <AssistantComposer />
        </div>
      </Reveal>

      {/* Capabilities */}
      <Reveal delay={0.14}>
        <div className="insight-grid" style={{ marginTop: 14 }}>
          {CAPABILITIES.map((c) => {
            const inner = (
              <div className="card" style={{ padding: '18px 18px', height: '100%', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span className="widget-icon">{c.icon}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>{c.title}</span>
                  <ModulePill status={c.status} />
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{c.desc}</p>
                {c.href && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginTop: 'auto' }}>
                    Try it now
                    <ArrowRight size={12} />
                  </span>
                )}
              </div>
            )
            return c.href ? (
              <Link key={c.title} href={c.href} style={{ textDecoration: 'none', minWidth: 0 }}>
                {inner}
              </Link>
            ) : (
              <div key={c.title} style={{ minWidth: 0 }}>
                {inner}
              </div>
            )
          })}
        </div>
      </Reveal>

      {/* Grounding */}
      <Reveal delay={0.22}>
        <div className="widget" style={{ marginTop: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MessagesSquare size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>What answers are grounded in</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {GROUNDING.map((g) => (
              <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--text-secondary)' }}>
                <CircleCheck size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                {g}
              </div>
            ))}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
            Workspace Q&amp;A is rolling out to Early Access workspaces. Thread-level AI (summaries, risk, next steps) is already live in your inbox today.
          </p>
        </div>
      </Reveal>
    </div>
  )
}
