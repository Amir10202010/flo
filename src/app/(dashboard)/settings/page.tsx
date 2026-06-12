import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Bell, CircleCheck, Crown, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { Reveal } from '@/components/dashboard/Motion'
import WidgetShell from '@/components/dashboard/WidgetShell'
import SignOutButton from '@/components/ui/SignOutButton'

export const metadata: Metadata = { title: 'Settings — Velnox' }

const PRO_PERKS = ['Unlimited synced threads', 'Full AI analysis on every conversation']

const UPCOMING_NOTIFICATIONS = [
  {
    icon: <Mail size={14} />,
    title: 'Weekly digest email',
    desc: 'A Monday-morning brief: trends, quiet clients, top actions.',
  },
  {
    icon: <ShieldCheck size={14} />,
    title: 'Risk alerts',
    desc: 'An email the moment AI flags a client as critical.',
  },
]

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const userName  = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null
  const userEmail = user.email ?? null
  const display   = userName ?? userEmail ?? 'User'
  const letter    = display[0]?.toUpperCase() ?? '?'

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 820, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: '0 0 5px', fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Settings
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Your profile, plan and workspace preferences.
            </p>
          </div>
        </div>
      </Reveal>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Profile */}
        <Reveal delay={0.05}>
          <WidgetShell
            icon={<UserRound size={14} />}
            title="Profile"
            sub="How you appear across the workspace"
            bodyStyle={{ padding: '18px 20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,#4b6bff,#9b6bff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {letter}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</p>
                {userEmail && userName && (
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</p>
                )}
              </div>
            </div>
          </WidgetShell>
        </Reveal>

        {/* Plan / Billing — drop NEXT_PUBLIC_CHECKOUT_URL (Stripe Payment Link,
            LemonSqueezy, or Paddle) to turn the button into a real checkout. */}
        <Reveal delay={0.1}>
          <WidgetShell
            icon={<Crown size={14} />}
            title="Plan"
            sub="Billing and limits for this workspace"
            bodyStyle={{ padding: '18px 20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Starter</p>
                  <span className="tag" style={{ fontSize: 10.5, padding: '2px 9px' }}>Free</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {PRO_PERKS.map((perk) => (
                    <span key={perk} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      <CircleCheck size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      {perk} <span style={{ color: 'var(--text-muted)' }}>· Pro</span>
                    </span>
                  ))}
                </div>
              </div>
              <a
                href={process.env.NEXT_PUBLIC_CHECKOUT_URL || '/pricing'}
                className="btn-primary"
                style={{ fontSize: 13.5, padding: '9px 18px', flexShrink: 0 }}
              >
                Upgrade to Pro — $39/mo
              </a>
            </div>
          </WidgetShell>
        </Reveal>

        {/* Notifications — honest upcoming module, same policy as the dashboard */}
        <Reveal delay={0.15}>
          <WidgetShell
            icon={<Bell size={14} />}
            title="Notifications"
            sub="Email alerts from your workspace"
            status="soon"
            bodyStyle={{ padding: '6px 8px 8px' }}
          >
            {UPCOMING_NOTIFICATIONS.map((n) => (
              <div key={n.title} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', minWidth: 0 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {n.icon}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{n.desc}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>Coming to Early Access</span>
              </div>
            ))}
          </WidgetShell>
        </Reveal>

        {/* Account */}
        <Reveal delay={0.2}>
          <WidgetShell
            icon={<ShieldCheck size={14} />}
            title="Account"
            sub={userEmail ? `Signed in as ${userEmail}` : 'Session and access'}
            bodyStyle={{ padding: '6px 8px' }}
          >
            <SignOutButton />
          </WidgetShell>
        </Reveal>

        <Reveal delay={0.25}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', paddingLeft: 4 }}>Velnox · Early Access</p>
        </Reveal>
      </div>
    </div>
  )
}
