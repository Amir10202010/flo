'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bell, CalendarClock, Crown, Mail, ShieldCheck } from 'lucide-react'
import type { OrgRole } from '@prisma/client'
import { can } from '@/lib/permissions'
import WidgetShell from '@/components/dashboard/WidgetShell'
import SignOutButton from '@/components/ui/SignOutButton'
import AlertEmailToggle from '@/components/settings/AlertEmailToggle'
import SendDigestButton from '@/components/dashboard/SendDigestButton'
import InboxesPanel from '@/components/settings/InboxesPanel'

const PLAN_LABEL: Record<string, string> = { FREE: 'Free', PRO: 'Pro', TEAM: 'Team', BUSINESS: 'Business', ENTERPRISE: 'Enterprise' }

export default function SettingsTabs({
  role,
  plan,
  interval,
  renewalLabel,
  cancelAtPeriodEnd,
  userName,
  userEmail,
}: {
  role: OrgRole
  plan: string
  interval: string | null
  renewalLabel: string | null
  cancelAtPeriodEnd: boolean
  userName: string | null
  userEmail: string | null
}) {
  const tabs = [
    { id: 'general', label: 'Account', icon: ShieldCheck },
    { id: 'connections', label: 'Gmail', icon: Mail },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: Crown },
  ]

  // Deep-link a tab via ?tab=; the OAuth callback lands on ?connected / ?error,
  // which forces the Connections tab so its banner is visible.
  const searchParams = useSearchParams()
  const validIds = new Set(tabs.map((t) => t.id))
  const connectFlow = searchParams.get('connected') || searchParams.get('error')
  const tabParam = searchParams.get('tab')
  const initialTab =
    connectFlow
      ? 'connections'
      : tabParam && validIds.has(tabParam)
        ? tabParam
        : 'general'

  const [active, setActive] = useState(initialTab)
  const display = userName ?? userEmail ?? 'You'

  return (
    <div>
      <div className="settings-tabnav" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 18, overflowX: 'auto' }}>
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              data-active={active === t.id}
              className="settings-tab"
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {active === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <WidgetShell icon={<ShieldCheck size={14} />} title="Account" sub={userEmail ? `Signed in as ${userEmail}` : 'Session'} bodyStyle={{ padding: '6px 8px' }}>
            <div style={{ padding: '8px 4px 4px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 8 }}>{display}</p>
              <SignOutButton />
            </div>
          </WidgetShell>
        </div>
      )}

      {active === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <WidgetShell icon={<Bell size={14} />} title="Going-cold emails" sub="When a relationship starts slipping" status="live" bodyStyle={{ padding: '6px 8px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid var(--border-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={14} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Email me when someone’s going cold</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>One throttled email when a relationship starts slipping or a reply is overdue.</div>
              </div>
              <AlertEmailToggle />
            </div>
          </WidgetShell>

          <WidgetShell icon={<CalendarClock size={14} />} title="Weekly digest" sub="A Monday-morning summary, sent from your connected Gmail" status="live" bodyStyle={{ padding: '16px 18px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                <li>Response-time and volume trends vs last week</li>
                <li>Who went quiet and threads to push</li>
                <li>Your top recommended actions for the week</li>
              </ul>
              <SendDigestButton />
            </div>
          </WidgetShell>
        </div>
      )}

      {active === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <WidgetShell icon={<Crown size={14} />} title="Plan" sub="Your Velnox subscription" bodyStyle={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{PLAN_LABEL[plan] ?? plan}</p>
                  {interval && <span className="tag" style={{ fontSize: 10.5, padding: '2px 9px' }}>{interval === 'year' ? 'Annual' : 'Monthly'}</span>}
                </div>
                {renewalLabel && (
                  <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {cancelAtPeriodEnd ? 'Ends' : 'Renews'} {renewalLabel}
                  </p>
                )}
              </div>
              {can(role, 'billing:manage') && (
                plan === 'FREE' ? (
                  <a href="/pricing" className="btn-primary" style={{ fontSize: 13.5, padding: '9px 18px' }}>Upgrade to Pro</a>
                ) : (
                  <a href="/api/billing/portal" className="btn-ghost" style={{ fontSize: 13.5, padding: '9px 18px' }}>Manage billing</a>
                )
              )}
            </div>
          </WidgetShell>
        </div>
      )}

      {active === 'connections' && <InboxesPanel canManage={can(role, 'inbox:manage')} />}
    </div>
  )
}
