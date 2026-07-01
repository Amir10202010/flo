import { type NextRequest } from 'next/server'
import { err, ok } from '@/lib/api'
import { requireCan } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { safeParseBlueprint } from '@/lib/workspace/blueprint'
import { coerceOnboardingAnswers } from '@/services/workspace/blueprint.generator'
import { applyBlueprint, getWorkspaceSchema } from '@/services/workspace/workspace.service'

/**
 * Apply a blueprint to the organization (the confirm step). The blueprint is
 * RE-VALIDATED server-side — the client-held copy is never trusted. Apply is
 * additive/archive-only; records are never touched.
 *   POST /api/workspace/apply  { blueprint, provider?, answers? }
 *   → { schema } (the fresh read-model)
 */
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireCan('workspace:manage')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return err('Invalid request body', 400)

  const parsed = safeParseBlueprint(body.blueprint)
  if (!parsed.ok) return err(`Invalid blueprint: ${parsed.error}`, 400)

  const provider = body.provider === 'gemini' || body.provider === 'local' ? body.provider : undefined
  const answers = coerceOnboardingAnswers(body.answers) ?? undefined

  await applyBlueprint(ctx.organization.id, parsed.blueprint, {
    source: provider === 'gemini' ? 'AI' : 'TEMPLATE',
    provider,
    answers,
    actorId: ctx.userId,
  })

  const schema = await getWorkspaceSchema(ctx.organization.id)
  return ok({ schema })
}
