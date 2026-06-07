import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // getCurrentUser() is request-scoped and cached via React.cache().
  // Child layouts and pages calling it in the same tree get the same result for free.
  const user = await getCurrentUser()

  if (!user) redirect('/login')

  const userName  = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null
  const userEmail = user.email ?? null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar userName={userName} userEmail={userEmail} />
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
