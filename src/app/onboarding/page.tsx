import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import OnboardingWizard from '@/components/org/OnboardingWizard'

export const metadata: Metadata = { title: 'Create your workspace — Velnox' }

/**
 * First-run onboarding. A signed-in user with no organization lands here (via
 * requireOrgPage). The wizard creates the workspace, then optionally invites
 * teammates and connects a shared inbox.
 */
export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const ctx = await getOrgContext()
  if (ctx) redirect('/dashboard')

  const firstName =
    (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    (user.user_metadata?.name as string | undefined)?.split(' ')[0] ??
    null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', background: 'var(--bg-base)' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <h1 className="display-title" style={{ fontSize: 26, margin: '0 0 8px' }}>
            {firstName ? `Welcome, ${firstName}` : 'Welcome to Velnox'}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Tell us what you do — Velnox shapes itself around your business.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <OnboardingWizard defaultName={firstName ? `${firstName}'s Team` : ''} />
        </div>
      </div>
    </div>
  )
}
