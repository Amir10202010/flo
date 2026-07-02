import type { Metadata } from 'next'
import { Zap } from 'lucide-react'
import { requireOrgPage } from '@/lib/org'
import { can } from '@/lib/permissions'
import { getWorkspaceSchema, listActiveAutomations } from '@/services/workspace/workspace.service'
import WorkspaceSetupLauncher from '@/components/workspace/WorkspaceSetupLauncher'

export const metadata: Metadata = { title: 'Workspace setup — Velnox' }

/**
 * Industry specialization for EXISTING organizations — the same AI interview
 * → preview → apply flow new signups get in onboarding. Orgs created before
 * the adaptive layer (or that skipped the step) start here; re-running is
 * safe: apply is archive-only and never touches records.
 */
export default async function WorkspaceSetupPage() {
  const ctx = await requireOrgPage()
  const allowed = can(ctx.role, 'workspace:manage')
  const schema = await getWorkspaceSchema(ctx.organization.id)
  const automations = schema ? await listActiveAutomations(ctx.organization.id) : []

  return (
    <div style={{ padding: '28px 32px 56px', maxWidth: 560, margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ margin: '0 0 5px' }}>
        {schema ? 'Reshape your workspace' : 'Shape Velnox around your business'}
      </h1>
      <p style={{ margin: '0 0 22px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {schema
          ? `Currently configured as “${schema.profile.industryLabel}”. Regenerating updates objects, pipelines and KPIs — nothing you created is ever deleted (removed objects are archived).`
          : 'Describe what your company does and Velnox generates your own CRM objects, pipelines, dashboard KPIs and AI copilot.'}
      </p>

      {allowed ? (
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 16, padding: '26px 24px', boxShadow: 'var(--shadow-sm)' }}>
          <WorkspaceSetupLauncher />
        </div>
      ) : (
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          Workspace setup needs an admin. Ask an organization admin or owner to run it.
        </p>
      )}

      {automations.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <h2 className="section-title" style={{ margin: '0 0 4px', fontSize: 13 }}>Active automations</h2>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-muted)' }}>
            These fire when records move stages — each creates a follow-up reminder, never sends mail.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {automations.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 11px', background: '#FFFFFF' }}>
                <Zap size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ minWidth: 0, flex: 1 }}>{a.name}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0 }}>{a.objectSingular}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
