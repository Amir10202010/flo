/**
 * Routing / automation rule matcher — PURE (no DB), so it is unit-testable
 * (`npm run test:rules`). Conditions are AND-matched; a rule with no conditions
 * never matches (so an empty rule can't silently capture the whole inbox).
 * `evaluateRules` folds every matching rule into one action set: scalars are
 * first-match-wins (rules are evaluated in `order`), tags are unioned.
 */
import type { EmailCategory, PriorityLevel } from '@prisma/client'

export interface RuleCondition {
  /** Exact sender email (case-insensitive). */
  fromEquals?: string
  /** Sender domain, e.g. "acme.com" (case-insensitive). */
  domainEquals?: string
  /** Case-insensitive substring of the subject. */
  subjectContains?: string
  /** Restrict to a specific connected inbox. */
  inboxId?: string
}

export interface RuleActions {
  assignMembershipId?: string
  addTagIds?: string[]
  setPriority?: PriorityLevel
  setCategory?: EmailCategory
  close?: boolean
}

export interface RuleDef {
  id: string
  conditions: RuleCondition
  actions: RuleActions
}

export interface MailContext {
  fromEmail: string
  domain: string
  subject: string
  inboxId: string | null
}

export function matchRule(cond: RuleCondition, ctx: MailContext): boolean {
  const hasAny = Boolean(cond.fromEquals || cond.domainEquals || cond.subjectContains || cond.inboxId)
  if (!hasAny) return false // never match an empty rule
  if (cond.fromEquals && cond.fromEquals.toLowerCase() !== ctx.fromEmail.toLowerCase()) return false
  if (cond.domainEquals && cond.domainEquals.toLowerCase() !== ctx.domain.toLowerCase()) return false
  if (cond.subjectContains && !ctx.subject.toLowerCase().includes(cond.subjectContains.toLowerCase())) return false
  if (cond.inboxId && cond.inboxId !== ctx.inboxId) return false
  return true
}

export function evaluateRules(rules: RuleDef[], ctx: MailContext): RuleActions {
  const out: RuleActions = {}
  const tags = new Set<string>()
  for (const r of rules) {
    if (!matchRule(r.conditions, ctx)) continue
    const a = r.actions
    if (a.assignMembershipId && !out.assignMembershipId) out.assignMembershipId = a.assignMembershipId
    if (a.setPriority && !out.setPriority) out.setPriority = a.setPriority
    if (a.setCategory && !out.setCategory) out.setCategory = a.setCategory
    if (a.close) out.close = true
    for (const t of a.addTagIds ?? []) tags.add(t)
  }
  if (tags.size) out.addTagIds = [...tags]
  return out
}
