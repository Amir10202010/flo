import type { Metadata } from 'next'
import { Share2 } from 'lucide-react'
import { requireOrgPage } from '@/lib/org'
import { getKnowledgeGraph } from '@/services/graph.service'
import { Reveal } from '@/components/dashboard/Motion'
import ModulePill from '@/components/dashboard/ModulePill'
import GraphExplorer from '@/components/graph/GraphExplorer'
import DashboardEmpty from '@/components/dashboard/DashboardEmpty'
import KnowledgeTabs from '@/components/knowledge/KnowledgeTabs'

export const metadata: Metadata = { title: 'Knowledge — Velnox' }

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string }>
}) {
  const ctx = await requireOrgPage()
  const graph = await getKnowledgeGraph(ctx.userId)
  const focus = (await searchParams)?.focus ?? null

  return (
    <div className="dash-page" style={{ padding: '28px 32px 40px', maxWidth: 1480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <h1 className="page-title" style={{ margin: 0 }}>Knowledge</h1>
              <ModulePill status="beta" />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Everything your inbox knows — people, companies, topics, meetings and notes, connected automatically.
            </p>
          </div>
          <KnowledgeTabs />
        </div>
      </Reveal>

      {!graph.hasData ? (
        graph.nodes.length === 0 ? (
          <DashboardEmpty hasIntegration />
        ) : (
          <div className="widget" style={{ padding: '48px 32px', textAlign: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--bg-elevated)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Share2 size={20} />
            </span>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>The graph is still forming</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.55, margin: 0 }}>
              Entities are extracted as your conversations are analyzed. Sync your mailbox (or run <code>npm run backfill:graph</code>) to populate people, companies and topics.
            </p>
          </div>
        )
      ) : (
        <Reveal delay={0.08} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <GraphExplorer graph={graph} initialFocus={focus} />
        </Reveal>
      )}
    </div>
  )
}
