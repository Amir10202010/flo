import type { Metadata } from 'next'
import { requireOrgPage } from '@/lib/org'
import { can } from '@/lib/permissions'
import { getWorkspaceSchema } from '@/services/workspace/workspace.service'
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
    </div>
  )
}
