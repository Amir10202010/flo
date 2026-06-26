import Link from 'next/link'
import { ArrowRight, Mail } from 'lucide-react'
import { Reveal } from './Motion'

const STEPS = [
  { n: 1, title: 'Connect your shared inbox', desc: 'Link a Gmail mailbox your team works out of — about 30 seconds.' },
  { n: 2, title: 'Velnox reads & prioritizes', desc: 'Threads are imported, analyzed and ranked by urgency and churn risk.' },
  { n: 3, title: 'Act on what matters', desc: 'Work the command center, reply with AI drafts, watch at-risk clients.' },
]

/** First-run state: the platform is real, it just needs a connected inbox. */
export default function DashboardEmpty({ hasIntegration }: { hasIntegration: boolean }) {
  return (
    <Reveal>
      <div className="widget" style={{ alignItems: 'center', textAlign: 'center', padding: '52px 28px 44px' }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 15,
            background: 'linear-gradient(135deg, #4F5CF4, #6D44F5)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 28px rgba(79,92,244,0.35)',
            marginBottom: 18,
          }}
        >
          <Mail size={23} />
        </div>
        <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-serif)', fontSize: 25, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          {hasIntegration ? 'Your first sync is on its way' : 'Connect a shared inbox to light up your dashboard'}
        </h2>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--text-secondary)', maxWidth: 440, lineHeight: 1.6 }}>
          {hasIntegration
            ? 'Threads are being imported and analyzed. The command center, risk monitor and analytics fill in as data arrives.'
            : 'Velnox triages your team’s shared inbox, ranks what needs attention, and watches for at-risk accounts. Everything below starts working the moment an inbox is connected.'}
        </p>
        <Link href="/settings?tab=connections" className="btn-primary" style={{ fontSize: 14 }}>
          {hasIntegration ? 'View sync status' : 'Connect a shared inbox'}
          <ArrowRight size={15} />
        </Link>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginTop: 36,
            width: '100%',
            maxWidth: 720,
          }}
        >
          {STEPS.map((s) => (
            <div
              key={s.n}
              style={{
                padding: '16px 16px',
                borderRadius: 13,
                border: '1px solid var(--border-light)',
                background: 'var(--bg-subtle)',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{s.title}</span>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  )
}
