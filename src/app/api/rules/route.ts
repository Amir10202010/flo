import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { listRules, createRule, RuleError } from '@/services/rule.service'
import type { RuleActions, RuleCondition } from '@/services/rule.engine'

/** Org routing rules. GET (any member) / POST create (admin+). */
export async function GET() {
  const { ctx, error } = await requireOrg()
  if (!ctx) return error
  const rules = await listRules(ctx.organization.id)
  return ok({ rules })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const body = await req.json().catch(() => null)
  const name = typeof (body as { name?: unknown })?.name === 'string' ? (body as { name: string }).name : ''
  const conditions = ((body as { conditions?: unknown })?.conditions ?? {}) as RuleCondition
  const actions = ((body as { actions?: unknown })?.actions ?? {}) as RuleActions

  try {
    const rule = await createRule(ctx.organization.id, ctx.userId, { name, conditions, actions })
    return ok({ rule }, 201)
  } catch (e) {
    if (e instanceof RuleError) return err(e.message, e.status)
    console.error('[rules] create failed:', e)
    return err('Could not create the rule', 500)
  }
}
