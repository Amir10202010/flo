import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import ConnectInbox from '@/components/onboarding/ConnectInbox'

export const metadata: Metadata = { title: 'Connect your Gmail — Velnox' }

/**
 * First-run onboarding for a single-user account. There is no team or workspace
 * to set up: the user just connects their Gmail. The OAuth flow auto-provisions
 * their private space and returns them to the dashboard, so a user who already
 * has one (a returning connect) skips straight there.
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
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 className="display-title" style={{ fontSize: 26, margin: '0 0 8px' }}>
            {firstName ? `Welcome, ${firstName}` : 'Welcome to Velnox'}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            One step left — connect your Gmail and Velnox starts telling you who to reply to and follow up with.
          </p>
        </div>
        <ConnectInbox />
      </div>
    </div>
  )
}
