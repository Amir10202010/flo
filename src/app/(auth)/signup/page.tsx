import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { safeNextPath } from '@/lib/constants'
import AuthForm from '@/components/auth/AuthForm'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams
  const dest = safeNextPath(next)

  // Already signed in → skip the form and continue to the intended destination.
  const supabase = await getSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session) redirect(dest)

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ marginBottom: 26, textAlign: 'center' }}>
        <h1 className="display-title" style={{ fontSize: 28, margin: '0 0 8px' }}>
          Create your account
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
          Free to start — no credit card needed.
        </p>
      </div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', boxShadow: 'var(--shadow-sm)' }}>
        <AuthForm mode="signup" next={dest} initialError={error} />
      </div>
    </div>
  )
}
