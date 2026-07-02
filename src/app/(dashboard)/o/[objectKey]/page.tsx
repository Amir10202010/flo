import { createElement } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireOrgPage } from '@/lib/org'
import { listRecords } from '@/services/workspace/record.service'
import { iconFor } from '@/lib/workspace/icons'
import { Reveal } from '@/components/dashboard/Motion'
import ModulePill from '@/components/dashboard/ModulePill'
import ObjectPage from '@/components/workspace/ObjectPage'

/**
 * Dynamic workspace-object page — ONE route renders every industry object
 * (Patients, Cases, Campaigns…) from its metadata: columns from field
 * definitions, board from the object's pipeline. No object is hardcoded.
 */
export async function generateMetadata({ params }: { params: Promise<{ objectKey: string }> }): Promise<Metadata> {
  const { objectKey } = await params
  const label = objectKey.replace(/[-_]+/g, ' ')
  return { title: `${label.charAt(0).toUpperCase()}${label.slice(1)} — Velnox` }
}

export default async function WorkspaceObjectPage({ params }: { params: Promise<{ objectKey: string }> }) {
  const ctx = await requireOrgPage()
  const { objectKey } = await params

  const result = await listRecords(ctx.organization.id, objectKey)
  if (!result) notFound()

  const { object, records } = result

  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      <Reveal>
        <div className="dash-header-row" style={{ marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              {createElement(iconFor(object.icon), { size: 20, style: { color: 'var(--text-secondary)' }, 'aria-hidden': true })}
              <h1 className="page-title" style={{ margin: 0 }}>{object.plural}</h1>
              <ModulePill status="live" />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              {object.description ?? `${object.plural} tracked in your workspace.`}
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <ObjectPage object={object} records={records} />
      </Reveal>
    </div>
  )
}
