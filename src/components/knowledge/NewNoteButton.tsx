'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

/** Creates an empty note and opens it — writing starts immediately. */
export default function NewNoteButton({ title }: { title?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title ?? '' }),
      })
      if (!res.ok) throw new Error(`create failed (${res.status})`)
      const { id } = (await res.json()) as { id: string }
      router.push(`/knowledge/notes/${id}`)
    } catch {
      setBusy(false)
    }
  }

  return (
    <button type="button" className="btn-primary" onClick={create} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <Plus size={14} />
      {busy ? 'Creating…' : 'New note'}
    </button>
  )
}
