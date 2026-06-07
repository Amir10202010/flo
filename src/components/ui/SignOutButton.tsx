'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--hot)', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background 0.13s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hot-dim)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <LogOut size={15} />
      Sign out
    </button>
  )
}
