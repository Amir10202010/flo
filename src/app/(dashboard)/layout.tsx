import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import Brand from '@/components/layout/Brand'
import CommandPalette from '@/components/CommandPalette'
import ComposeModal from '@/components/ComposeModal'
import OnboardingTour from '@/components/onboarding/OnboardingTour'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // getCurrentUser() is request-scoped and cached via React.cache().
  // Child layouts and pages calling it in the same tree get the same result for free.
  const user = await getCurrentUser()

  if (!user) redirect('/login')

  const userName  = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null
  const userEmail = user.email ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Mobile-only top bar — the sidebar collapses to an icon rail and hides its logo below 768px */}
      <header className="dashboard-topbar">
        <Brand size={22} />
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar userName={userName} userEmail={userEmail} />
        <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>

      {/* Global ⌘K / Ctrl+K command palette + Smart Compose modal (client islands) */}
      <CommandPalette />
      <ComposeModal />

      {/* First-run onboarding spotlight tour (auto-runs once, replayable) */}
      <OnboardingTour />
    </div>
  )
}
