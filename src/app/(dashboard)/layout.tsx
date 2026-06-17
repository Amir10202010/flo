import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import CommandPalette from '@/components/CommandPalette'
import ComposeModal from '@/components/ComposeModal'

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
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>velnox</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginBottom: 8, display: 'inline-block' }} />
        </Link>
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
    </div>
  )
}
