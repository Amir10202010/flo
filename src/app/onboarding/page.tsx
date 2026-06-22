import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import CreateOrgForm from '@/components/org/CreateOrgForm'

export const metadata: Metadata = { title: 'Create your workspace — Velnox' }

/**
 * First-run org creation. A signed-in user with no organization lands here
 * (via requireOrgPage). Once they create one, every dashboard page resolves an
 * org context and works. Batch 6 expands this into a multi-step flow (connect
 * inbox → invite teammates → first rule).
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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: 'var(--bg-base)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: '0 0 8px',
            }}
          >
            {firstName ? `Welcome, ${firstName}` : 'Welcome to Velnox'}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Create your team workspace to get started. You can invite teammates and
            connect a shared inbox next.
          </p>
        </div>
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '24px 22px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <CreateOrgForm defaultName={firstName ? `${firstName}'s Team` : ''} />
        </div>
      </div>
    </div>
  )
}
