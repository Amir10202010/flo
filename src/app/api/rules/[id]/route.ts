import { type NextRequest } from 'next/server'
import { ok, err } from '@/lib/api'
import { requireOrg } from '@/lib/org'
import { rateLimit } from '@/lib/ratelimit'
import { updateRule, deleteRule, RuleError } from '@/services/rule.service'
import type { RuleActions, RuleCondition } from '@/services/rule.engine'

/** Update (toggle/edit) or delete a routing rule (admin+). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error
  const limited = await rateLimit(ctx.userId, 'mutate')
  if (limited) return limited

  const { id } = await params
  const body = await req.json().catch(() => null) as { name?: string; isActive?: boolean; conditions?: RuleCondition; actions?: RuleActions } | null
  if (!body) return err('Invalid JSON', 400)

  try {
    const rule = await updateRule(ctx.organization.id, ctx.userId, id, {
      name: body.name,
      isActive: body.isActive,
      conditions: body.conditions,
      actions: body.actions,
    })
    return ok({ rule })
  } catch (e) {
    if (e instanceof RuleError) return err(e.message, e.status)
    return err('Could not update the rule', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireOrg('ADMIN')
  if (!ctx) return error
  const { id } = await params
  try {
    await deleteRule(ctx.organization.id, ctx.userId, id)
    return ok({ deleted: true })
  } catch (e) {
    if (e instanceof RuleError) return err(e.message, e.status)
    return err('Could not delete the rule', 500)
  }
}
