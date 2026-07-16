import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Sparkles } from 'lucide-react'
import { requireOrgPage } from '@/lib/org'
import { listNotes } from '@/services/note.knowledge.service'
import { Reveal } from '@/components/dashboard/Motion'
import ModulePill from '@/components/dashboard/ModulePill'
import KnowledgeTabs from '@/components/knowledge/KnowledgeTabs'
import NewNoteButton from '@/components/knowledge/NewNoteButton'
import EntityChip from '@/components/knowledge/EntityChip'

export const metadata: Metadata = { title: 'Notes — Velnox' }

export default async function NotesPage() {
  const ctx = await requireOrgPage()
  const notes = await listNotes(ctx.userId)

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 880, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <h1 className="page-title" style={{ margin: 0 }}>Knowledge</h1>
              <ModulePill status="beta" />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Notes link themselves to the people, companies and topics they mention.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KnowledgeTabs />
            <NewNoteButton />
          </div>
        </div>
      </Reveal>

      {notes.length === 0 ? (
        <Reveal delay={0.06}>
          <div className="widget" style={{ padding: '52px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--bg-elevated)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <FileText size={20} />
            </span>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Write your first note</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, lineHeight: 1.55, margin: 0 }}>
              Call prep, an idea, something a client said — write it down and Velnox connects it to the right people, companies and topics on its own.
            </p>
            <div style={{ marginTop: 6 }}>
              <NewNoteButton />
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal delay={0.06}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notes.map((n) => (
              <Link key={n.id} href={`/knowledge/notes/${n.id}`} className="kn-note-row">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {n.title || n.excerpt.slice(0, 60) || 'Untitled'}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 'auto' }}>{n.updatedAgo}</span>
                </div>
                {n.title && n.excerpt && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>
                    {n.excerpt}
                  </div>
                )}
                {(n.linked.length > 0 || n.pendingLink) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8, alignItems: 'center' }}>
                    {n.linked.slice(0, 6).map((c) => (
                      <EntityChip key={c.ref} nodeRef={c.ref} type={c.type} label={c.label} />
                    ))}
                    {n.pendingLink && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                        <Sparkles size={10.5} style={{ color: 'var(--accent)' }} className="kn-pulse" />
                        Linking…
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  )
}
