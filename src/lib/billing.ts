/**
 * Plan catalog, flat per-tier pricing and feature gates — PURE (no I/O), so it
 * is unit-testable (`npm run test:billing`) and shared by the pricing page, the
 * Settings → billing surface and the server-side limit checks. Payment runs
 * through Polar (src/lib/polar.ts); nothing here charges a card.
 */
import type { BillingPlan } from '@prisma/client'

export type { BillingPlan }
export type BillingPeriod = 'monthly' | 'annual'

export interface PlanLimits {
  /** Max active members (Infinity = unlimited). */
  members: number
  /** Max connected shared inboxes. */
  inboxes: number
  /** Max active automation rules. */
  rules: number
  /** Analytics history retained, in days. */
  analyticsHistoryDays: number
  audit: boolean
  automations: boolean
  /** On-demand AI drafting — the interactive "AI draft" button + smart compose. */
  aiDrafts: boolean
  /** Auto-drafts (the "reply already written" badge) allowed per calendar month.
   * The free taste of the core value; Infinity = unlimited. */
  autoDraftsPerMonth: number
  /** Proactive going-cold / follow-up alert emails. */
  alerts: boolean
  /** Weekly digest email. */
  digest: boolean
  /** AI assistant (Ask-AI Q&A + actions). */
  assistant: boolean
}

export interface PlanInfo {
  id: BillingPlan
  name: string
  /** Flat monthly price in USD; null = custom/contact sales. */
  priceMonthly: number | null
  /** Flat annual price in USD (2 months free); null = custom. */
  priceAnnual: number | null
  tagline: string
  features: string[]
  limits: PlanLimits
}

export const PLAN_CATALOG: Record<BillingPlan, PlanInfo> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: 0,
    tagline: 'Get on top of your inbox, free.',
    features: ['Your Gmail, AI-triaged', 'Auto-drafts on urgent threads (20/mo)', 'See who’s going cold', '7-day history'],
    limits: { members: 1, inboxes: 1, rules: 0, analyticsHistoryDays: 7, audit: false, automations: false, aiDrafts: false, autoDraftsPerMonth: 20, alerts: false, digest: false, assistant: false },
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    priceMonthly: 12,
    priceAnnual: 120,
    tagline: 'For anyone who lives in their inbox.',
    features: ['Unlimited AI drafts & smart compose', 'Going-cold email alerts', 'Weekly digest & Ask-AI assistant', '90-day history'],
    limits: { members: 1, inboxes: 1, rules: 0, analyticsHistoryDays: 90, audit: false, automations: false, aiDrafts: true, autoDraftsPerMonth: Infinity, alerts: true, digest: true, assistant: true },
  },
  TEAM: {
    id: 'TEAM',
    name: 'Team',
    priceMonthly: 40,
    priceAnnual: 400,
    tagline: 'For growing teams running real volume.',
    features: ['Up to 5 teammates', '3 shared inboxes', 'Routing rules & automations', 'Saved replies / templates', 'All AI features', '90-day analytics history'],
    limits: { members: 5, inboxes: 3, rules: 50, analyticsHistoryDays: 90, audit: false, automations: true, aiDrafts: true, autoDraftsPerMonth: Infinity, alerts: true, digest: true, assistant: true },
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business',
    priceMonthly: 120,
    priceAnnual: 1200,
    tagline: 'For larger orgs that need control & audit.',
    features: ['Up to 20 teammates', '10 shared inboxes', 'Audit log & activity history', 'Advanced team analytics', 'Priority support'],
    limits: { members: 20, inboxes: 10, rules: 500, analyticsHistoryDays: 365, audit: true, automations: true, aiDrafts: true, autoDraftsPerMonth: Infinity, alerts: true, digest: true, assistant: true },
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    priceMonthly: null,
    priceAnnual: null,
    tagline: 'For companies with security & scale needs.',
    features: ['Everything in Business', 'Unlimited teammates & inboxes', 'SSO / SAML (on request)', 'Dedicated onboarding & SLA', 'Custom data retention'],
    limits: { members: Infinity, inboxes: Infinity, rules: Infinity, analyticsHistoryDays: 730, audit: true, automations: true, aiDrafts: true, autoDraftsPerMonth: Infinity, alerts: true, digest: true, assistant: true },
  },
}

export const PLAN_ORDER: BillingPlan[] = ['FREE', 'PRO', 'TEAM', 'BUSINESS', 'ENTERPRISE']

export function planLimits(plan: BillingPlan): PlanLimits {
  return PLAN_CATALOG[plan].limits
}

/** Can the org add another active member under its plan? */
export function canAddSeat(plan: BillingPlan, currentSeats: number): boolean {
  return currentSeats < planLimits(plan).members
}

/** Can the org connect another shared inbox under its plan? */
export function canAddInbox(plan: BillingPlan, currentInboxes: number): boolean {
  return currentInboxes < planLimits(plan).inboxes
}

/** Can the org add another automation rule under its plan? */
export function canAddRule(plan: BillingPlan, currentRules: number): boolean {
  const l = planLimits(plan)
  return l.automations && currentRules < l.rules
}

export function hasFeature(
  plan: BillingPlan,
  feature: 'audit' | 'automations' | 'aiDrafts' | 'alerts' | 'digest' | 'assistant',
): boolean {
  return planLimits(plan)[feature]
}

/** Auto-drafts a plan may generate per calendar month (Infinity = unlimited). */
export function autoDraftAllowance(plan: BillingPlan): number {
  return planLimits(plan).autoDraftsPerMonth
}

/** Flat price for a plan at a billing period; null for custom plans. */
export function planPrice(plan: BillingPlan, period: BillingPeriod): number | null {
  const info = PLAN_CATALOG[plan]
  return period === 'annual' ? info.priceAnnual : info.priceMonthly
}
