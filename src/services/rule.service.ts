/**
 * Routing/automation rules: org-scoped CRUD and the apply step that runs over
 * newly-synced conversations. Pure matching lives in rule.engine.ts; this module
 * is the DB-bound orchestration (load rules, build context, persist actions).
 * Apply is best-effort — a rule failure must never break ingestion.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { domainOf } from '@/lib/categories'
import { recordAudit } from '@/services/audit.service'
import { evaluateRules, type RuleActions, type RuleCondition, type RuleDef, type MailContext } from '@/services/rule.engine'

export class RuleError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'RuleError'
  }
}

export interface RuleItem {
  id: string
  name: string
  isActive: boolean
  order: number
  conditions: RuleCondition
  actions: RuleActions
}

function toItem(r: { id: string; name: string; isActive: boolean; order: number; conditions: unknown; actions: unknown }): RuleItem {
  return {
    id: r.id,
    name: r.name,
    isActive: r.isActive,
    order: r.order,
    conditions: (r.conditions ?? {}) as RuleCondition,
    actions: (r.actions ?? {}) as RuleActions,
  }
}

export async function listRules(organizationId: string): Promise<RuleItem[]> {
  const rows = await prisma.rule.findMany({ where: { organizationId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] })
  return rows.map(toItem)
}

export async function createRule(
  organizationId: string,
  actorId: string,
  input: { name: string; conditions: RuleCondition; actions: RuleActions; isActive?: boolean },
): Promise<RuleItem> {
  const name = input.name.trim().slice(0, 80)
  if (!name) throw new RuleError('Rule name is required', 400)
  const count = await prisma.rule.count({ where: { organizationId } })
  const rule = await prisma.rule.create({
    data: {
      organizationId,
      name,
      isActive: input.isActive ?? true,
      order: count,
      conditions: input.conditions as unknown as Prisma.InputJsonValue,
      actions: input.actions as unknown as Prisma.InputJsonValue,
    },
  })
  await recordAudit({ organizationId, actorId, action: 'rule.created', summary: `Created rule “${name}”`, targetType: 'rule', targetId: rule.id })
  return toItem(rule)
}

export async function updateRule(
  organizationId: string,
  actorId: string,
  ruleId: string,
  patch: { name?: string; conditions?: RuleCondition; actions?: RuleActions; isActive?: boolean },
): Promise<RuleItem> {
  const rule = await prisma.rule.findFirst({ where: { id: ruleId, organizationId } })
  if (!rule) throw new RuleError('Rule not found', 404)
  const updated = await prisma.rule.update({
    where: { id: rule.id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 80) } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.conditions !== undefined ? { conditions: patch.conditions as unknown as Prisma.InputJsonValue } : {}),
      ...(patch.actions !== undefined ? { actions: patch.actions as unknown as Prisma.InputJsonValue } : {}),
    },
  })
  await recordAudit({ organizationId, actorId, action: 'rule.updated', summary: `Updated rule “${updated.name}”`, targetType: 'rule', targetId: updated.id })
  return toItem(updated)
}

export async function deleteRule(organizationId: string, actorId: string, ruleId: string): Promise<void> {
  const rule = await prisma.rule.findFirst({ where: { id: ruleId, organizationId } })
  if (!rule) throw new RuleError('Rule not found', 404)
  await prisma.rule.delete({ where: { id: rule.id } })
  await recordAudit({ organizationId, actorId, action: 'rule.deleted', summary: `Deleted rule “${rule.name}”`, targetType: 'rule', targetId: rule.id })
}

/**
 * Apply the org's active rules to one freshly-synced conversation. Best-effort:
 * resolves the action targets against the org (assignee membership, tags) so a
 * stale id is simply skipped, and never throws into the sync path.
 */
export async function applyRulesToConversation(organizationId: string, conversationId: string): Promise<void> {
  try {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      select: { id: true, inboxId: true, subject: true, categorySource: true, contact: { select: { email: true } } },
    })
    if (!conv) return

    const ruleRows = await prisma.rule.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, conditions: true, actions: true },
    })
    if (!ruleRows.length) return

    const rules: RuleDef[] = ruleRows.map((r) => ({ id: r.id, conditions: (r.conditions ?? {}) as RuleCondition, actions: (r.actions ?? {}) as RuleActions }))
    const fromEmail = (conv.contact.email ?? '').toLowerCase()
    const ctx: MailContext = {
      fromEmail,
      domain: domainOf(fromEmail) ?? '',
      subject: conv.subject ?? '',
      inboxId: conv.inboxId,
    }
    const actions = evaluateRules(rules, ctx)

    // Resolve + apply scalar actions in one update.
    const data: Prisma.ConversationUpdateInput = {}
    if (actions.assignMembershipId) {
      const m = await prisma.membership.findFirst({ where: { id: actions.assignMembershipId, organizationId, status: 'ACTIVE' }, select: { id: true } })
      if (m) data.assignee = { connect: { id: m.id } }
    }
    if (actions.setPriority) data.priority = actions.setPriority
    if (actions.setCategory && conv.categorySource !== 'manual') {
      data.category = actions.setCategory
      data.categorySource = 'rules'
    }
    if (actions.close) data.state = 'CLOSED'
    if (Object.keys(data).length) await prisma.conversation.update({ where: { id: conv.id }, data })

    // Tags (validated against the org).
    if (actions.addTagIds?.length) {
      const tags = await prisma.tag.findMany({ where: { id: { in: actions.addTagIds }, organizationId }, select: { id: true } })
      for (const t of tags) {
        await prisma.conversationTag.upsert({
          where: { conversationId_tagId: { conversationId: conv.id, tagId: t.id } },
          create: { conversationId: conv.id, tagId: t.id },
          update: {},
        })
      }
    }
  } catch (e) {
    console.warn('[rules] apply failed for', conversationId, e instanceof Error ? e.message : e)
  }
}
