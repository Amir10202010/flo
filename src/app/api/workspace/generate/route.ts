import { type NextRequest } from 'next/server'
import { err, ok } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { TEMPLATE_KEYS, type TemplateKey } from '@/lib/workspace/templates'
import {
  coerceOnboardingAnswers,
  generateWorkspaceBlueprint,
} from '@/services/workspace/blueprint.generator'

/**
 * Generate a workspace blueprint for preview — NOTHING is applied here; the
 * user confirms via POST /api/workspace/apply (propose → confirm → execute).
 *   POST /api/workspace/generate  { answers?: {description,…}, templateKey? }
 *   → { blueprint, provider: "gemini" | "local", templateKey }
 */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'workspaceGenerate')
  if (limited) return limited

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return err('Invalid request body', 400)

  const templateKey =
    typeof body.templateKey === 'string' && TEMPLATE_KEYS.includes(body.templateKey as TemplateKey)
      ? (body.templateKey as TemplateKey)
      : undefined
  const answers = coerceOnboardingAnswers(body.answers)

  if (!templateKey && !answers) {
    return err('Describe the business (a sentence or two) or pick a template', 400)
  }

  const generated = await generateWorkspaceBlueprint(
    answers ?? { description: '' },
    { templateKey },
  )
  return ok(generated)
}
