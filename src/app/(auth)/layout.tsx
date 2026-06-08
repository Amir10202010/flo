import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient()

  // getSession() reads the session from the cookie without making a network
  // request to Supabase (~5ms vs ~500ms for getUser()). This is safe here
  // because we only use it to redirect already-authenticated users away from
  // the login/signup pages. The real auth guard in (dashboard)/layout.tsx
  // calls getUser() which verifies the token with Supabase.
  const { data: { session } } = await supabase.auth.getSession()
  if (session) redirect('/inbox')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', backgroundImage: 'radial-gradient(circle, #D4D8F0 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
      <header style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', background: 'rgba(250,251,255,0.85)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>flo</span>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', marginBottom: 10, display: 'inline-block' }} />
          </Link>
        </div>
      </header>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        {children}
      </div>
    </div>
  )
}
