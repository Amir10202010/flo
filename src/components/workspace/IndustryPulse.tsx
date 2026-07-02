/**
 * Industry pulse — the schema-declared dashboard strip. Widgets come from
 * WorkspaceProfile.dashboard (blueprint-validated), data from real record
 * counts (recordStats: two groupBys total). Server component; no client JS.
 */
import { createElement } from 'react'
import Link from 'next/link'
import { iconFor } from '@/lib/workspace/icons'
import { recordStats, type ObjectStats } from '@/services/workspace/record.service'
import type { WorkspaceObjectModel, WorkspaceSchemaModel } from '@/services/workspace/workspace.service'

const EMPTY_STATS: ObjectStats = { total: 0, createdLast7d: 0, byStage: {} }

const cardStyle: React.CSSProperties = {
  display: 'block',
  background: '#FFFFFF',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg, 12px)',
  boxShadow: 'var(--shadow-xs)',
  padding: '13px 15px',
  textDecoration: 'none',
  minWidth: 0,
}

function CardLabel({ object, label }: { object: WorkspaceObjectModel; label?: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
      {createElement(iconFor(object.icon), { size: 12 })}
      {label ?? object.plural}
    </span>
  )
}

function CountCard({ object, label, stats }: { object: WorkspaceObjectModel; label?: string; stats: ObjectStats }) {
  return (
    <Link href={`/o/${object.key}`} style={cardStyle}>
      <CardLabel object={object} label={label} />
      <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
        {stats.total}
      </span>
      <span style={{ display: 'block', fontSize: 12, color: stats.createdLast7d > 0 ? 'var(--success)' : 'var(--text-muted)', marginTop: 4 }}>
        {stats.total === 0 ? `No ${object.plural.toLowerCase()} yet` : stats.createdLast7d > 0 ? `+${stats.createdLast7d} this week` : 'None added this week'}
      </span>
    </Link>
  )
}

function StageCard({ object, label, stats }: { object: WorkspaceObjectModel; label?: string; stats: ObjectStats }) {
  const stages = (object.pipeline ?? []).slice(0, 6)
  const max = Math.max(1, ...stages.map((s) => stats.byStage[s.key] ?? 0))
  return (
    <Link href={`/o/${object.key}`} style={cardStyle}>
      <CardLabel object={object} label={label} />
      {stats.total === 0 ? (
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No {object.plural.toLowerCase()} yet</span>
      ) : (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {stages.map((s) => {
            const count = stats.byStage[s.key] ?? 0
            return (
              <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 11.5, color: count > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', width: 92, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
                <span style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(count / max) * 100}%`, borderRadius: 3, background: count > 0 ? (s.terminal ? 'var(--text-muted)' : 'var(--accent)') : 'transparent' }} />
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)', width: 20, textAlign: 'right', flexShrink: 0 }}>
                  {count}
                </span>
              </span>
            )
          })}
        </span>
      )}
    </Link>
  )
}

export default async function IndustryPulse({
  schema,
  organizationId,
}: {
  schema: WorkspaceSchemaModel
  organizationId: string
}) {
  const widgets = schema.dashboard.slice(0, 4)
  if (!widgets.length) return null
  const stats = await recordStats(organizationId)

  return (
    <section
      aria-label={`${schema.profile.industryLabel} overview`}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: 12 }}
    >
      {widgets.map((w) => {
        const object = schema.objects.find((o) => o.key === w.objectKey)
        if (!object) return null
        const s = stats.get(object.id) ?? EMPTY_STATS
        return w.type === 'stage-breakdown' ? (
          <StageCard key={`${w.type}:${w.objectKey}`} object={object} label={w.label} stats={s} />
        ) : (
          <CountCard key={`${w.type}:${w.objectKey}`} object={object} label={w.label} stats={s} />
        )
      })}
    </section>
  )
}
