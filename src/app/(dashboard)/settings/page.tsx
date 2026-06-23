import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth'
import { requireOrgPage } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { Reveal } from '@/components/dashboard/Motion'
import SettingsTabs from '@/components/settings/SettingsTabs'

export const metadata: Metadata = { title: 'Settings — Velnox' }

export default async function SettingsPage() {
  const ctx = await requireOrgPage()
  const user = await getCurrentUser()

  const sub = await prisma.subscription.findUnique({
    where: { organizationId: ctx.organization.id },
    select: { plan: true, seats: true },
  })

  const userName = (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null) as string | null
  const userEmail = user?.email ?? null

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 880, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: '0 0 5px', fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Settings
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Organization, team members, inboxes and audit log.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <SettingsTabs
          orgName={ctx.organization.name}
          role={ctx.role}
          plan={sub?.plan ?? 'FREE'}
          seats={sub?.seats ?? 1}
          userName={userName}
          userEmail={userEmail}
        />
      </Reveal>
    </div>
  )
}
