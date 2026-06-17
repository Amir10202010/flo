import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import Brand from '@/components/layout/Brand'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient()

  // getSession() reads the session from the cookie without making a network
  // request to Supabase (~5ms vs ~500ms for getUser()). This is safe here
  // because we only use it to redirect already-authenticated users away from
  // the login/signup pages. The real auth guard in (dashboard)/layout.tsx
  // calls getUser() which verifies the token with Supabase.
  const { data: { session } } = await supabase.auth.getSession()
  if (session) redirect('/dashboard')

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      <div className="mesh mesh-soft" />
      <div className="mesh-veil" />
      <div className="dot-grid" />

      <header
        className="glass"
        style={{ position: 'relative', zIndex: 2, flexShrink: 0 }}
      >
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 32px', height: 62, display: 'flex', alignItems: 'center' }}>
          <Brand size={26} />
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        {children}
      </div>
    </div>
  )
}
