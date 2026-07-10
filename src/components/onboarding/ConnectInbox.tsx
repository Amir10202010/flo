'use client'

import { useState } from 'react'
import { ArrowRight, Lock, Mail, Snowflake, Sparkles, Undo2 } from 'lucide-react'
import RequestAccessForm from '@/components/integrations/RequestAccessForm'
import { track } from '@/lib/analytics'

const PERKS: { icon: typeof Mail; title: string; body: string }[] = [
  { icon: Mail, title: 'Reply to these today', body: 'Ranked by who matters — not just what’s newest.' },
  { icon: Snowflake, title: 'Who’s going cold', body: 'Spot the relationships slipping before they’re gone.' },
  { icon: Sparkles, title: 'Reply already written', body: 'A draft waiting for you — review and send.' },
]

/**
 * First-run connect screen. Velnox is single-user and reads one personal Gmail;
 * connecting starts the OAuth flow, which auto-provisions the user's private
 * space and lands them back on the dashboard. While the Google app is in
 * Testing mode, users who aren't approved yet can request access instead.
 */
export default function ConnectInbox() {
  const [showRequest, setShowRequest] = useState(false)

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 16, padding: '26px 24px', boxShadow: 'var(--shadow-sm)' }}>
      <ul style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
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

      {!showRequest ? (
        <>
          <a
            href="/api/auth/gmail"
            onClick={() => track('gmail_connect_clicked', { context: 'onboarding' })}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', gap: 8, fontSize: 14 }}
          >
            <Mail size={16} /> Connect your Gmail <ArrowRight size={15} />
          </a>
          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, margin: '12px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <Lock size={12} style={{ flexShrink: 0 }} />
            Connect in 30 seconds. It stays your inbox — tokens are encrypted, disconnect any time.
          </p>
          <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, textAlign: 'center' }}>
            Not approved yet?{' '}
            <button type="button" onClick={() => setShowRequest(true)} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', font: 'inherit' }}>
              Request access
            </button>{' '}
            while we finish Google verification.
          </p>
        </>
      ) : (
        <>
          <RequestAccessForm />
          <button
            type="button"
            onClick={() => setShowRequest(false)}
            className="btn-ghost"
            style={{ marginTop: 12, width: '100%', justifyContent: 'center', gap: 7, fontSize: 13 }}
          >
            <Undo2 size={14} /> Back to connect
          </button>
        </>
      )}
    </div>
  )
}
