'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'

export default function SignOutButton() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <button type="button" className="row-danger" onClick={handleSignOut} disabled={signingOut}>
      <LogOut size={15} />
      {signingOut ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
