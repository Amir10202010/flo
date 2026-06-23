/**
 * Plan catalog, per-seat pricing and feature gates — PURE (no I/O), so it is
 * unit-testable (`npm run test:billing`) and shared by the pricing page, the
 * Settings → billing surface and the server-side limit checks at creation
 * points. Payment runs through the external checkout (Stripe-ready); nothing
 * here charges a card.
 */
import type { BillingPlan } from '@prisma/client'

export type { BillingPlan }

export interface PlanLimits {
  /** Max active members (Infinity = unlimited). */
  members: number
  /** Max connected shared inboxes. */
  inboxes: number
  /** Max active automation rules. */
  rules: number
  /** Analytics history retained, in days. */
  analyticsHistoryDays: number
  /** Audit log available. */
  audit: boolean
  /** Automations (routing rules) available. */
  automations: boolean
}

export interface PlanInfo {
  id: BillingPlan
  name: string
  /** Per-seat monthly price in USD; null = custom/contact sales. */
  pricePerSeat: number | null
  tagline: string
  features: string[]
  limits: PlanLimits
}

export const PLAN_CATALOG: Record<BillingPlan, PlanInfo> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    pricePerSeat: 0,
    tagline: 'Try the shared inbox with a small team.',
    features: ['Up to 3 teammates', '1 shared inbox', 'AI triage & priority', 'Assignment & internal notes'],
    limits: { members: 3, inboxes: 1, rules: 3, analyticsHistoryDays: 14, audit: false, automations: false },
  },
  TEAM: {
    id: 'TEAM',
    name: 'Team',
    pricePerSeat: 12,
    tagline: 'For growing teams running real volume.',
    features: [
      'Up to 15 teammates',
      '3 shared inboxes',
      'Routing rules & automations',
      'Custom tags & labels',
      'Risk alerts & weekly digest',
      '90-day analytics history',
    ],
    limits: { members: 15, inboxes: 3, rules: 50, analyticsHistoryDays: 90, audit: false, automations: true },
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business',
    pricePerSeat: 24,
    tagline: 'For larger orgs that need control & audit.',
    features: [
      'Unlimited teammates',
      '10 shared inboxes',
      'Audit log & activity history',
      'Advanced team analytics',
      'Priority support',
    ],
    limits: { members: Infinity, inboxes: 10, rules: 500, analyticsHistoryDays: 365, audit: true, automations: true },
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    pricePerSeat: null,
    tagline: 'For companies with security & scale needs.',
    features: [
      'Everything in Business',
      'Unlimited shared inboxes',
      'SSO / SAML (on request)',
      'Dedicated onboarding & SLA',
      'Custom data retention',
    ],
    limits: { members: Infinity, inboxes: Infinity, rules: Infinity, analyticsHistoryDays: 730, audit: true, automations: true },
  },
}

export const PLAN_ORDER: BillingPlan[] = ['FREE', 'TEAM', 'BUSINESS', 'ENTERPRISE']

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

export function hasFeature(plan: BillingPlan, feature: 'audit' | 'automations'): boolean {
  return planLimits(plan)[feature]
}

/** Monthly total for `seats` on a plan; null for custom plans. */
export function monthlyTotal(plan: BillingPlan, seats: number): number | null {
  const price = PLAN_CATALOG[plan].pricePerSeat
  return price === null ? null : price * Math.max(1, seats)
}
