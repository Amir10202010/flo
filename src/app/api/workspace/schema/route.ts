import { ok } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { getWorkspaceSchema } from '@/services/workspace/workspace.service'

/**
 * The workspace schema read-model powering the adaptive UI (sidebar nav,
 * terminology, object pages, dashboard widgets).
 *   GET /api/workspace/schema → { schema: WorkspaceSchemaModel | null }
 * `schema` is null until onboarding applies a blueprint — clients render
 * their generic defaults in that case.
 */
export async function GET() {
  const { ctx, error } = await requireOrg('VIEWER')
  if (!ctx) return error
  const schema = await getWorkspaceSchema(ctx.organization.id)
  return ok({ schema })
}
