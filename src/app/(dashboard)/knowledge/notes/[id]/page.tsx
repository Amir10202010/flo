import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireOrgPage } from '@/lib/org'
import { getNoteDetail } from '@/services/note.knowledge.service'
import { Reveal } from '@/components/dashboard/Motion'
import NoteEditor from '@/components/knowledge/NoteEditor'

export const metadata: Metadata = { title: 'Note — Velnox' }

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgPage()
  const { id } = await params
  const note = await getNoteDetail(ctx.userId, id)
  if (!note) notFound()

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 880, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Reveal style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <NoteEditor initial={note} />
      </Reveal>
    </div>
  )
}
