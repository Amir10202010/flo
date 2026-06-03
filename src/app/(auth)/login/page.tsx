'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) setMessage(error.message)
    else setMessage('Check your email for a login link (magic link).')
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <form onSubmit={signIn} className="flex flex-col gap-2">
        <input className="border px-3 py-2 rounded" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <button className="bg-black text-white px-4 py-2 rounded">Send magic link</button>
      </form>
      {message && <p className="mt-4">{message}</p>}
    </div>
  )
}
