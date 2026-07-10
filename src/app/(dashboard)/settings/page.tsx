import type { Metadata } from 'next'
import { Suspense } from 'react'
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
    select: { plan: true, interval: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  })
  const renewalLabel = sub?.currentPeriodEnd
    ? sub.currentPeriodEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null

  const userName = (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null) as string | null
  const userEmail = user?.email ?? null

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 880, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title" style={{ margin: '0 0 5px' }}>
              Settings
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Manage your account, Gmail connection, billing and notifications.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Suspense>
        <SettingsTabs
          role={ctx.role}
          plan={sub?.plan ?? 'FREE'}
          interval={sub?.interval ?? null}
          renewalLabel={renewalLabel}
          cancelAtPeriodEnd={sub?.cancelAtPeriodEnd ?? false}
          userName={userName}
          userEmail={userEmail}
        />
        </Suspense>
      </Reveal>
    </div>
  )
}
