import { ok } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { INDUSTRY_TEMPLATES, TEMPLATE_KEYS } from '@/lib/workspace/templates'

/**
 * Industry template catalog for the onboarding "pick a template" path.
 *   GET /api/workspace/templates → { templates: [{ key, label, objects }] }
 */
export async function GET() {
  const { ctx, error } = await requireOrg('VIEWER')
  if (!ctx) return error
  const templates = TEMPLATE_KEYS.map((key) => {
    const t = INDUSTRY_TEMPLATES[key]
    return {
      key,
      label: t.label,
      objects: (t.blueprint.objects ?? []).map((o) => o.plural),
    }
  })
  return ok({ templates })
}
