'use client'

import { useState } from 'react'
import { Bell, Building2, Compass, Crown, FileText, History, Mail, ShieldCheck, Tag as TagIcon, Users, Zap } from 'lucide-react'
import type { OrgRole } from '@prisma/client'
import { can, ROLE_LABEL } from '@/lib/permissions'
import WidgetShell from '@/components/dashboard/WidgetShell'
import SignOutButton from '@/components/ui/SignOutButton'
import ReplayTourButton from '@/components/onboarding/ReplayTourButton'
import AlertEmailToggle from '@/components/settings/AlertEmailToggle'
import MembersPanel from '@/components/settings/MembersPanel'
import InboxesPanel from '@/components/settings/InboxesPanel'
import TagsPanel from '@/components/settings/TagsPanel'
import RulesPanel from '@/components/settings/RulesPanel'
import TemplatesPanel from '@/components/settings/TemplatesPanel'
import AuditPanel from '@/components/settings/AuditPanel'

const PLAN_LABEL: Record<string, string> = { FREE: 'Free', TEAM: 'Team', BUSINESS: 'Business', ENTERPRISE: 'Enterprise' }

export default function SettingsTabs({
  orgName,
  role,
  plan,
  seats,
  userName,
  userEmail,
}: {
  orgName: string
  role: OrgRole
  plan: string
  seats: number
  userName: string | null
  userEmail: string | null
}) {
  const tabs = [
    { id: 'workspace', label: 'Workspace', icon: Building2, show: true },
    { id: 'members', label: 'Members', icon: Users, show: can(role, 'members:manage') },
    { id: 'inboxes', label: 'Inboxes', icon: Mail, show: can(role, 'inbox:read') },
    { id: 'tags', label: 'Tags', icon: TagIcon, show: can(role, 'inbox:read') },
    { id: 'templates', label: 'Templates', icon: FileText, show: can(role, 'inbox:read') },
    { id: 'rules', label: 'Rules', icon: Zap, show: can(role, 'rules:manage') },
    { id: 'audit', label: 'Audit log', icon: History, show: can(role, 'audit:read') },
  ].filter((t) => t.show)

  const [active, setActive] = useState('workspace')
  const display = userName ?? userEmail ?? 'User'

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

      {active === 'workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <WidgetShell icon={<Building2 size={14} />} title="Organization" sub="Your team workspace" bodyStyle={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{orgName}</p>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', padding: '3px 10px', background: 'var(--bg-subtle)', borderRadius: 100 }}>
                  You are {ROLE_LABEL[role]}
                </span>
              </div>
            </div>
          </WidgetShell>

          <WidgetShell icon={<Crown size={14} />} title="Plan" sub="Billing and seats for this organization" bodyStyle={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{PLAN_LABEL[plan] ?? plan}</p>
                <span className="tag" style={{ fontSize: 10.5, padding: '2px 9px' }}>{seats} seat{seats === 1 ? '' : 's'}</span>
              </div>
              {can(role, 'billing:manage') && (
                <a href={process.env.NEXT_PUBLIC_CHECKOUT_URL || '/pricing'} className="btn-primary" style={{ fontSize: 13.5, padding: '9px 18px' }}>
                  Upgrade plan
                </a>
              )}
            </div>
          </WidgetShell>

          <WidgetShell icon={<Bell size={14} />} title="Notifications" sub="Urgent-alert emails for this organization" status="live" bodyStyle={{ padding: '6px 8px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent-dim)', border: '1px solid var(--border-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={14} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Urgent alert emails</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Sent to the owner when a client hits critical/high risk — throttled.</div>
              </div>
              <AlertEmailToggle />
            </div>
          </WidgetShell>

          <WidgetShell icon={<Compass size={14} />} title="Getting started" sub="Replay the guided product tour" bodyStyle={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 440 }}>Highlights Inbox, Clients, Insights, Risk, Analytics and the AI Assistant.</p>
              <ReplayTourButton />
            </div>
          </WidgetShell>

          <WidgetShell icon={<ShieldCheck size={14} />} title="Account" sub={userEmail ? `Signed in as ${userEmail}` : 'Session'} bodyStyle={{ padding: '6px 8px' }}>
            <div style={{ padding: '8px 4px 4px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 8 }}>{display}</p>
              <SignOutButton />
            </div>
          </WidgetShell>
        </div>
      )}

      {active === 'members' && <MembersPanel myRole={role} />}
      {active === 'inboxes' && <InboxesPanel canManage={can(role, 'inbox:manage')} />}
      {active === 'tags' && <TagsPanel canManage={can(role, 'tags:manage')} />}
      {active === 'templates' && <TemplatesPanel />}
      {active === 'rules' && <RulesPanel role={role} />}
      {active === 'audit' && <AuditPanel />}
    </div>
  )
}
