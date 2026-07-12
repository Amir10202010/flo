'use client'

import { Lock, Mail, Snowflake, Sparkles } from 'lucide-react'
import RequestAccessForm from '@/components/integrations/RequestAccessForm'
import { track } from '@/lib/analytics'

const PERKS: { icon: typeof Mail; title: string; body: string }[] = [
  { icon: Mail, title: 'Reply to these today', body: 'Ranked by who matters — not just what’s newest.' },
  { icon: Snowflake, title: 'Who’s going cold', body: 'Spot the relationships slipping before they’re gone.' },
  { icon: Sparkles, title: 'Reply already written', body: 'A draft waiting for you — review and send.' },
]

/**
 * First-run connect screen. Velnox is single-user and reads one personal Gmail.
 * While the Google OAuth app is in Testing mode the PRIMARY action is
 * requesting access (the founder approves each mailbox by hand in the Google
 * Console); already-approved users connect directly via the link below.
 */
export default function ConnectInbox() {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 16, padding: '26px 24px', boxShadow: 'var(--shadow-sm)' }}>
      <ul style={{ listStyle: 'none', margin: '0 0 8px', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {PERKS.map(({ icon: Icon, title, body }) => (
          <li key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={15} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{body}</div>
            </div>
          </li>
        ))}
      </ul>

      <RequestAccessForm />

      <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, textAlign: 'center' }}>
        Velnox is in limited early access while Google verifies the app — we approve requests within a day.
        <br />
        Already approved?{' '}
        <a
          href="/api/auth/gmail"
          onClick={() => track('gmail_connect_clicked', { context: 'onboarding' })}
          style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
        >
          Connect your Gmail →
        </a>
      </p>

      <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, margin: '12px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        <Lock size={12} style={{ flexShrink: 0 }} />
        It stays your inbox — tokens are encrypted, disconnect any time.
      </p>
    </div>
  )
}
