import Link from 'next/link'
import { ArrowRight, Mail } from 'lucide-react'
import { Reveal } from './Motion'

const STEPS = [
  { n: 1, title: 'Request inbox access', desc: 'Velnox is invite-only for now — request access with the Gmail your team works out of.' },
  { n: 2, title: 'We approve & sync starts', desc: 'Once approved you connect in two clicks; threads import and get analyzed.' },
  { n: 3, title: 'Act on what matters', desc: 'Work the command center, reply with AI drafts, and stay ahead of at-risk clients.' },
]

/** First-run state: the platform is real, it just needs a connected inbox. */
export default function DashboardEmpty({ hasIntegration }: { hasIntegration: boolean }) {
  return (
    <Reveal>
      <div className="widget" style={{ alignItems: 'center', textAlign: 'center', padding: '52px 28px 44px' }}>
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
          }}
        >
          <Mail size={22} />
        </div>
        <h2 className="section-title" style={{ margin: '0 0 8px', fontSize: 22 }}>
          {hasIntegration ? 'Your first sync is on its way' : 'Request access to connect your inbox'}
        </h2>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--text-secondary)', maxWidth: 460, lineHeight: 1.6 }}>
          {hasIntegration
            ? 'Threads are being imported and analyzed. The command center, insights and trends fill in as data arrives.'
            : 'Velnox is invite-only while we finish Google verification. Request access with the Gmail you want to connect — your dashboard fills in the moment it’s synced.'}
        </p>
        <Link href="/settings?tab=connections" className="btn-primary" style={{ fontSize: 14 }}>
          {hasIntegration ? 'View sync status' : 'Request inbox access'}
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
                borderRadius: 12,
                border: '1px solid var(--border-light)',
                background: 'var(--bg-subtle)',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</span>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  )
}
