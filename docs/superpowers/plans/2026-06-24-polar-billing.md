# Polar.sh Billing + Plan Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Polar.sh as the real payment engine behind Velnox's existing billing scaffold, and restructure the plan catalog into five flat tiers (Free / Pro / Team / Business / Enterprise) with a solo path and AI feature gates.

**Architecture:** Polar is billing-only; the DB (`Subscription` + `Membership`) stays the source of truth for plan/seats. A hosted Polar checkout starts from our own GET route (carrying the org id as `customerExternalId`). Polar webhooks drive `Subscription` updates through a pure, unit-tested mapping. A daily cron sweep is the missed-webhook backstop. AI features (auto-drafts, weekly digest, assistant) are gated to Pro+.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 5 (Supabase Postgres), `@polar-sh/sdk`, tsx pure-logic test scripts (`node:assert`).

## Global Constraints

- **Flat pricing, no per-seat billing.** Seats are a plan *limit* (`canAddSeat`), never a billed quantity. Do NOT use Polar seat-based pricing (beta).
- **Prices (USD):** Free 0/0 · Pro 12/120 · Team 40/400 · Business 120/1200 · Enterprise null/null (monthly/annual). Annual = "2 months free" (10× monthly).
- **Limits:** Free {members 1, inboxes 1, history 7d} · Pro {1, 1, 90d} · Team {5, 3, 90d} · Business {20, 10, 365d} · Enterprise {∞, ∞, 730d}.
- **AI feature gates** (`aiDrafts`, `digest`, `assistant`): OFF for Free, ON for Pro/Team/Business/Enterprise.
- **`PLAN_ORDER = ['FREE','PRO','TEAM','BUSINESS','ENTERPRISE']`.**
- **Webhook posture:** verify signature; fail closed in production if the secret is unset; always 2xx-ack once verified (mirror `src/app/api/webhooks/gmail/route.ts`).
- **Pool safety:** never `Promise.all` Prisma queries in a request path (small connection pool). Gating adds at most ONE sequential `Subscription` lookup.
- **No fan-out, no auto-removal of members on downgrade.** Over-limit orgs see a banner; new invites are already blocked by `canAddSeat`.
- **Migrations are gitignored** — edit `prisma/schema.prisma` (committed) and apply locally with `npx prisma migrate dev`.
- Type-check with `npx tsc --noEmit`; lint with `npm run lint`. Pure tests run via `tsx scripts/<name>.check.ts`.

---

## Phase 1 — Catalog + data model + Polar mapping (pure foundation)

### Task 1: Prisma schema — add `PRO` plan + subscription fields

**Files:**
- Modify: `prisma/schema.prisma` (enum `BillingPlan` ~line 635; model `Subscription` ~line 323)

**Interfaces:**
- Produces: `BillingPlan` enum value `PRO`; `Subscription.externalSubscriptionId`, `Subscription.interval`, `Subscription.cancelAtPeriodEnd`.

- [ ] **Step 1: Add `PRO` to the enum**

In `enum BillingPlan` change:

```prisma
enum BillingPlan {
  FREE
  PRO
  TEAM
  BUSINESS
  ENTERPRISE
}
```

- [ ] **Step 2: Add the three fields to `Subscription`**

Inside `model Subscription`, after `externalCustomerId String?` add:

```prisma
  externalSubscriptionId String?
  interval               String?    // "month" | "year"
  cancelAtPeriodEnd      Boolean  @default(false)
```

- [ ] **Step 3: Apply the migration + regenerate the client**

Run: `npx prisma migrate dev --name polar_billing_fields`
Expected: migration applies cleanly; `prisma generate` runs (PRO + new fields appear in the client types).

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (no usages reference the new fields yet).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(billing): add PRO plan + subscription period/cancel fields"
```

---

### Task 2: Rewrite the plan catalog (flat pricing + AI gates)

**Files:**
- Modify: `src/lib/billing.ts` (full rewrite of the catalog/types)
- Modify: `scripts/billing.check.ts` (full rewrite of assertions)
- Modify: `src/app/(marketing)/pricing/page.tsx` (compile fix only — full redesign in Task 12)

**Interfaces:**
- Produces:
  - `type BillingPeriod = 'monthly' | 'annual'`
  - `PlanInfo { id, name, priceMonthly: number|null, priceAnnual: number|null, tagline, features: string[], limits }`
  - `PlanLimits { members, inboxes, rules, analyticsHistoryDays, audit, automations, aiDrafts, digest, assistant }`
  - `planPrice(plan: BillingPlan, period: BillingPeriod): number | null`
  - `hasFeature(plan, feature: 'audit'|'automations'|'aiDrafts'|'digest'|'assistant'): boolean`
  - `canAddSeat`, `canAddInbox`, `canAddRule`, `planLimits`, `PLAN_CATALOG`, `PLAN_ORDER` (unchanged signatures)
- Removed: `pricePerSeat`, `monthlyTotal`.

- [ ] **Step 1: Rewrite `scripts/billing.check.ts` (failing test first)**

Replace the whole file with:

```ts
/**
 * Verification harness for the billing plan catalog (src/lib/billing.ts).
 * Pure (no DB / network) — run with: `npm run test:billing`.
 */
import assert from 'node:assert/strict'
import { canAddSeat, canAddInbox, canAddRule, hasFeature, planPrice, planLimits } from '@/lib/billing'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('billing — seat limits:')
check('FREE and PRO are solo (1 seat)', () => {
  assert.equal(canAddSeat('FREE', 0), true)
  assert.equal(canAddSeat('FREE', 1), false)
  assert.equal(canAddSeat('PRO', 0), true)
  assert.equal(canAddSeat('PRO', 1), false)
})
check('TEAM caps at 5, BUSINESS at 20', () => {
  assert.equal(canAddSeat('TEAM', 4), true)
  assert.equal(canAddSeat('TEAM', 5), false)
  assert.equal(canAddSeat('BUSINESS', 19), true)
  assert.equal(canAddSeat('BUSINESS', 20), false)
})
check('ENTERPRISE is unlimited members', () => {
  assert.equal(canAddSeat('ENTERPRISE', 100000), true)
})

console.log('billing — inbox limits:')
check('FREE/PRO 1 inbox, TEAM 3, BUSINESS 10', () => {
  assert.equal(canAddInbox('FREE', 0), true)
  assert.equal(canAddInbox('FREE', 1), false)
  assert.equal(canAddInbox('PRO', 1), false)
  assert.equal(canAddInbox('TEAM', 2), true)
  assert.equal(canAddInbox('TEAM', 3), false)
  assert.equal(canAddInbox('BUSINESS', 9), true)
})

console.log('billing — feature gates:')
check('automations are TEAM+', () => {
  assert.equal(canAddRule('FREE', 0), false)
  assert.equal(canAddRule('PRO', 0), false)
  assert.equal(canAddRule('TEAM', 0), true)
  assert.equal(hasFeature('TEAM', 'automations'), true)
})
check('audit is BUSINESS+', () => {
  assert.equal(hasFeature('FREE', 'audit'), false)
  assert.equal(hasFeature('TEAM', 'audit'), false)
  assert.equal(hasFeature('BUSINESS', 'audit'), true)
})
check('AI features are Pro+ (off for Free)', () => {
  for (const f of ['aiDrafts', 'digest', 'assistant'] as const) {
    assert.equal(hasFeature('FREE', f), false)
    assert.equal(hasFeature('PRO', f), true)
    assert.equal(hasFeature('TEAM', f), true)
    assert.equal(hasFeature('BUSINESS', f), true)
  }
})

console.log('billing — pricing (flat):')
check('flat monthly/annual prices; enterprise custom (null)', () => {
  assert.equal(planPrice('FREE', 'monthly'), 0)
  assert.equal(planPrice('PRO', 'monthly'), 12)
  assert.equal(planPrice('PRO', 'annual'), 120)
  assert.equal(planPrice('TEAM', 'monthly'), 40)
  assert.equal(planPrice('TEAM', 'annual'), 400)
  assert.equal(planPrice('BUSINESS', 'monthly'), 120)
  assert.equal(planPrice('BUSINESS', 'annual'), 1200)
  assert.equal(planPrice('ENTERPRISE', 'monthly'), null)
})
check('annual is 10× monthly (2 months free)', () => {
  for (const p of ['PRO', 'TEAM', 'BUSINESS'] as const) {
    assert.equal(planPrice(p, 'annual'), (planPrice(p, 'monthly') as number) * 10)
  }
})
check('analytics history grows with plan', () => {
  assert.ok(planLimits('PRO').analyticsHistoryDays > planLimits('FREE').analyticsHistoryDays)
  assert.ok(planLimits('BUSINESS').analyticsHistoryDays >= planLimits('TEAM').analyticsHistoryDays)
})

console.log(`\n${passed} checks passed.`)
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm run test:billing`
Expected: FAIL (compile error — `planPrice` / new gates don't exist yet).

- [ ] **Step 3: Rewrite `src/lib/billing.ts`**

Replace the whole file with:

```ts
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
  /** AI reply drafts (interactive + auto). */
  aiDrafts: boolean
  /** Weekly digest email. */
  digest: boolean
  /** AI workspace assistant (Q&A + actions). */
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
    tagline: 'For one person getting started.',
    features: ['1 mailbox', 'AI triage & priority', '7-day history', 'Just you'],
    limits: { members: 1, inboxes: 1, rules: 0, analyticsHistoryDays: 7, audit: false, automations: false, aiDrafts: false, digest: false, assistant: false },
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    priceMonthly: 12,
    priceAnnual: 120,
    tagline: 'For solo operators who live in their inbox.',
    features: ['1 mailbox', 'AI drafts, summaries & assistant', 'Risk alerts & weekly digest', '90-day history'],
    limits: { members: 1, inboxes: 1, rules: 0, analyticsHistoryDays: 90, audit: false, automations: false, aiDrafts: true, digest: true, assistant: true },
  },
  TEAM: {
    id: 'TEAM',
    name: 'Team',
    priceMonthly: 40,
    priceAnnual: 400,
    tagline: 'For growing teams running real volume.',
    features: ['Up to 5 teammates', '3 shared inboxes', 'Routing rules & automations', 'Saved replies / templates', 'All AI features', '90-day analytics history'],
    limits: { members: 5, inboxes: 3, rules: 50, analyticsHistoryDays: 90, audit: false, automations: true, aiDrafts: true, digest: true, assistant: true },
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business',
    priceMonthly: 120,
    priceAnnual: 1200,
    tagline: 'For larger orgs that need control & audit.',
    features: ['Up to 20 teammates', '10 shared inboxes', 'Audit log & activity history', 'Advanced team analytics', 'Priority support'],
    limits: { members: 20, inboxes: 10, rules: 500, analyticsHistoryDays: 365, audit: true, automations: true, aiDrafts: true, digest: true, assistant: true },
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    priceMonthly: null,
    priceAnnual: null,
    tagline: 'For companies with security & scale needs.',
    features: ['Everything in Business', 'Unlimited teammates & inboxes', 'SSO / SAML (on request)', 'Dedicated onboarding & SLA', 'Custom data retention'],
    limits: { members: Infinity, inboxes: Infinity, rules: Infinity, analyticsHistoryDays: 730, audit: true, automations: true, aiDrafts: true, digest: true, assistant: true },
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
  feature: 'audit' | 'automations' | 'aiDrafts' | 'digest' | 'assistant',
): boolean {
  return planLimits(plan)[feature]
}

/** Flat price for a plan at a billing period; null for custom plans. */
export function planPrice(plan: BillingPlan, period: BillingPeriod): number | null {
  const info = PLAN_CATALOG[plan]
  return period === 'annual' ? info.priceAnnual : info.priceMonthly
}
```

- [ ] **Step 4: Run the test**

Run: `npm run test:billing`
Expected: PASS (all checks).

- [ ] **Step 5: Fix the pricing page compile error (minimal)**

In `src/app/(marketing)/pricing/page.tsx`, replace the `priceParts` function so it no longer references `pricePerSeat`:

```tsx
function priceParts(plan: BillingPlan): { price: string; period: string | null } {
  const p = PLAN_CATALOG[plan].priceMonthly
  if (p === null) return { price: 'Custom', period: null }
  if (p === 0) return { price: 'Free', period: null }
  return { price: `$${p}`, period: '/ mo' }
}
```

(The toggle + 5-card layout come in Task 12; this only keeps the build green.)

- [ ] **Step 6: Verify the whole project type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/billing.ts scripts/billing.check.ts src/app/(marketing)/pricing/page.tsx
git commit -m "feat(billing): flat 5-tier catalog (add Pro) + AI feature gates"
```

---

### Task 3: Polar plan ↔ product mapping (pure)

**Files:**
- Create: `src/lib/polar-plans.ts`
- Create: `scripts/polar.check.ts`
- Modify: `package.json` (add `test:polar` script)

**Interfaces:**
- Produces:
  - `planToProduct(plan: BillingPlan, period: BillingPeriod): string | null`
  - `productToPlan(productId: string): { plan: BillingPlan; period: BillingPeriod } | null`

- [ ] **Step 1: Add the test script entry to `package.json`**

In `"scripts"`, after `"test:billing": ...` add:

```json
    "test:polar": "tsx scripts/polar.check.ts",
```

- [ ] **Step 2: Write the failing test `scripts/polar.check.ts`**

```ts
/**
 * Pure tests for the Polar plan↔product mapping (src/lib/polar-plans.ts).
 * Run with: `npm run test:polar`.
 */
import assert from 'node:assert/strict'

// Set product-id env BEFORE importing the module (it reads env at call time).
process.env.POLAR_PRODUCT_PRO_MONTHLY = 'prod_pro_m'
process.env.POLAR_PRODUCT_PRO_ANNUAL = 'prod_pro_a'
process.env.POLAR_PRODUCT_TEAM_MONTHLY = 'prod_team_m'
process.env.POLAR_PRODUCT_TEAM_ANNUAL = 'prod_team_a'
process.env.POLAR_PRODUCT_BUSINESS_MONTHLY = 'prod_biz_m'
process.env.POLAR_PRODUCT_BUSINESS_ANNUAL = 'prod_biz_a'

const { planToProduct, productToPlan } = await import('@/lib/polar-plans')

let passed = 0
function check(name: string, fn: () => void) { fn(); passed++; console.log(`  ✓ ${name}`) }

console.log('polar-plans — planToProduct:')
check('paid plans map to their product ids', () => {
  assert.equal(planToProduct('PRO', 'monthly'), 'prod_pro_m')
  assert.equal(planToProduct('PRO', 'annual'), 'prod_pro_a')
  assert.equal(planToProduct('TEAM', 'monthly'), 'prod_team_m')
  assert.equal(planToProduct('BUSINESS', 'annual'), 'prod_biz_a')
})
check('FREE and ENTERPRISE have no product', () => {
  assert.equal(planToProduct('FREE', 'monthly'), null)
  assert.equal(planToProduct('ENTERPRISE', 'monthly'), null)
})

console.log('polar-plans — productToPlan (reverse):')
check('known product ids resolve back to {plan, period}', () => {
  assert.deepEqual(productToPlan('prod_pro_m'), { plan: 'PRO', period: 'monthly' })
  assert.deepEqual(productToPlan('prod_biz_a'), { plan: 'BUSINESS', period: 'annual' })
})
check('unknown product id → null', () => {
  assert.equal(productToPlan('nope'), null)
})
check('round-trips', () => {
  for (const plan of ['PRO', 'TEAM', 'BUSINESS'] as const) {
    for (const period of ['monthly', 'annual'] as const) {
      const id = planToProduct(plan, period)!
      assert.deepEqual(productToPlan(id), { plan, period })
    }
  }
})

console.log(`\n${passed} checks passed.`)
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm run test:polar`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/lib/polar-plans.ts`**

```ts
/**
 * Maps our BillingPlan + period to Polar product ids and back. PURE except for
 * reading product-id env vars (read at call time so tests can set them). Only
 * Pro/Team/Business are sold via Polar; Free and Enterprise have no product.
 */
import type { BillingPlan, BillingPeriod } from '@/lib/billing'

const PAID: BillingPlan[] = ['PRO', 'TEAM', 'BUSINESS']

function envKey(plan: BillingPlan, period: BillingPeriod): string {
  return `POLAR_PRODUCT_${plan}_${period.toUpperCase()}`
}

/** Polar product id for a sellable plan+period, or null if not sold via Polar. */
export function planToProduct(plan: BillingPlan, period: BillingPeriod): string | null {
  if (!PAID.includes(plan)) return null
  return process.env[envKey(plan, period)]?.trim() || null
}

/** Reverse lookup: which {plan, period} owns a Polar product id. */
export function productToPlan(productId: string): { plan: BillingPlan; period: BillingPeriod } | null {
  if (!productId) return null
  for (const plan of PAID) {
    for (const period of ['monthly', 'annual'] as const) {
      if (process.env[envKey(plan, period)]?.trim() === productId) return { plan, period }
    }
  }
  return null
}
```

- [ ] **Step 5: Run the test**

Run: `npm run test:polar`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/polar-plans.ts scripts/polar.check.ts package.json
git commit -m "feat(billing): Polar plan↔product mapping (pure, tested)"
```

---

## Phase 2 — Polar checkout, webhook, portal, reconcile

### Task 4: Polar SDK client + env documentation

**Files:**
- Create: `src/lib/polar.ts`
- Modify: `package.json` / lockfile (via install)

**Interfaces:**
- Produces: `getPolar(): Polar` (memoized server-side Polar client).

- [ ] **Step 1: Install the SDK**

Run: `npm i @polar-sh/sdk`
Expected: package added to `dependencies`.

- [ ] **Step 2: Implement `src/lib/polar.ts`**

```ts
/**
 * Server-only Polar SDK client, built from env. `POLAR_SERVER` selects the
 * sandbox vs production API. Memoized so we don't reconstruct per request.
 */
import { Polar } from '@polar-sh/sdk'

let _polar: Polar | null = null

export function getPolar(): Polar {
  if (_polar) return _polar
  const accessToken = process.env.POLAR_ACCESS_TOKEN
  if (!accessToken) throw new Error('POLAR_ACCESS_TOKEN is not set')
  const server = process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox'
  _polar = new Polar({ accessToken, server })
  return _polar
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS. (If the SDK's `server` option name differs in the installed version, adjust per its types — see plan note in the spec §14.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/polar.ts package.json package-lock.json
git commit -m "feat(billing): add @polar-sh/sdk + server client factory"
```

---

### Task 5: Checkout route

**Files:**
- Create: `src/app/api/billing/checkout/route.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (`@/lib/auth`), `getOrgContext` (`@/lib/org`), `can` (`@/lib/permissions`), `planToProduct` (`@/lib/polar-plans`), `getPolar` (`@/lib/polar`).
- Produces: `GET /api/billing/checkout?plan=PRO&period=monthly` → 303 redirect to a Polar checkout URL.

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import type { BillingPlan } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import { can } from '@/lib/permissions'
import { planToProduct } from '@/lib/polar-plans'
import { getPolar } from '@/lib/polar'

export const dynamic = 'force-dynamic'

const PAID: BillingPlan[] = ['PRO', 'TEAM', 'BUSINESS']

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const self = req.nextUrl.pathname + req.nextUrl.search

  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(self)}`, appUrl))

  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.redirect(new URL(`/onboarding?next=${encodeURIComponent(self)}`, appUrl))
  if (!can(ctx.role, 'billing:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const plan = (req.nextUrl.searchParams.get('plan') || '').toUpperCase() as BillingPlan
  const period = req.nextUrl.searchParams.get('period') === 'annual' ? 'annual' : 'monthly'
  if (!PAID.includes(plan)) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const productId = planToProduct(plan, period)
  if (!productId) return NextResponse.json({ error: 'Plan not available for checkout' }, { status: 400 })

  try {
    const polar = getPolar()
    const checkout = await polar.checkouts.create({
      products: [productId],
      customerExternalId: ctx.organization.id,
      customerEmail: ctx.email ?? undefined,
      successUrl: `${appUrl}/settings?checkout=success`,
      metadata: { organizationId: ctx.organization.id, plan, period },
    })
    return NextResponse.redirect(checkout.url, { status: 303 })
  } catch (e) {
    console.error('[billing/checkout] failed:', e)
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS. (If `checkouts.create` parameter names differ in the installed SDK version, adjust to its types; the shape — products[], customerExternalId, customerEmail, successUrl, metadata — is stable.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/billing/checkout/route.ts
git commit -m "feat(billing): Polar checkout route (org-scoped, billing:manage)"
```

---

### Task 6: Webhook event → subscription patch (pure) + test

**Files:**
- Create: `src/services/billing.webhook.ts`
- Modify: `scripts/polar.check.ts` (add event-mapping checks)

**Interfaces:**
- Produces:
  - `interface PolarSubInput { type, productId, status, currentPeriodEnd, recurringInterval, customerExternalId, customerId, subscriptionId, metadataOrganizationId }` (all string|null except `type: string`)
  - `type SubPatch = { organizationId, plan, status, interval, cancelAtPeriodEnd, currentPeriodEnd, externalCustomerId, externalSubscriptionId } | { ignore: true; reason: string }`
  - `subscriptionUpdateFromEvent(e: PolarSubInput, lookup): SubPatch`

- [ ] **Step 1: Add failing tests to `scripts/polar.check.ts`**

Append before the final `console.log(...)`:

```ts
const { subscriptionUpdateFromEvent } = await import('@/services/billing.webhook')

const lookup = (id: string) => productToPlan(id)
const baseEvent = {
  productId: 'prod_team_m',
  status: 'active',
  currentPeriodEnd: '2026-07-24T00:00:00.000Z',
  recurringInterval: 'month',
  customerExternalId: 'org_123',
  customerId: 'cus_1',
  subscriptionId: 'sub_1',
  metadataOrganizationId: null,
}

console.log('billing.webhook — subscriptionUpdateFromEvent:')
check('active subscription → plan from product, status active', () => {
  const p = subscriptionUpdateFromEvent({ ...baseEvent, type: 'subscription.active' }, lookup)
  assert.ok(!('ignore' in p))
  if (!('ignore' in p)) {
    assert.equal(p.organizationId, 'org_123')
    assert.equal(p.plan, 'TEAM')
    assert.equal(p.status, 'active')
    assert.equal(p.interval, 'month')
    assert.equal(p.cancelAtPeriodEnd, false)
    assert.equal(p.externalSubscriptionId, 'sub_1')
    assert.equal(p.externalCustomerId, 'cus_1')
    assert.ok(p.currentPeriodEnd instanceof Date)
  }
})
check('canceled → keeps plan, sets cancelAtPeriodEnd', () => {
  const p = subscriptionUpdateFromEvent({ ...baseEvent, type: 'subscription.canceled' }, lookup)
  if (!('ignore' in p)) {
    assert.equal(p.plan, 'TEAM')
    assert.equal(p.cancelAtPeriodEnd, true)
  } else assert.fail('should not ignore')
})
check('revoked → plan FREE, status canceled', () => {
  const p = subscriptionUpdateFromEvent({ ...baseEvent, type: 'subscription.revoked' }, lookup)
  if (!('ignore' in p)) {
    assert.equal(p.plan, 'FREE')
    assert.equal(p.status, 'canceled')
  } else assert.fail('should not ignore')
})
check('resolves org from metadata when externalId missing', () => {
  const p = subscriptionUpdateFromEvent(
    { ...baseEvent, type: 'subscription.active', customerExternalId: null, metadataOrganizationId: 'org_meta' },
    lookup,
  )
  if (!('ignore' in p)) assert.equal(p.organizationId, 'org_meta')
  else assert.fail('should not ignore')
})
check('ignores non-subscription events', () => {
  const p = subscriptionUpdateFromEvent({ ...baseEvent, type: 'order.created' }, lookup)
  assert.deepEqual(p, { ignore: true, reason: 'unhandled_event' })
})
check('ignores unknown product (non-revoke)', () => {
  const p = subscriptionUpdateFromEvent({ ...baseEvent, type: 'subscription.active', productId: 'nope' }, lookup)
  assert.deepEqual(p, { ignore: true, reason: 'unknown_product' })
})
check('ignores when no org can be resolved', () => {
  const p = subscriptionUpdateFromEvent(
    { ...baseEvent, type: 'subscription.active', customerExternalId: null, metadataOrganizationId: null },
    lookup,
  )
  assert.deepEqual(p, { ignore: true, reason: 'no_org' })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm run test:polar`
Expected: FAIL (`@/services/billing.webhook` not found).

- [ ] **Step 3: Implement `src/services/billing.webhook.ts`**

```ts
/**
 * PURE derivation of a Subscription patch from a Polar webhook event. Kept
 * provider-shape-free (route adapts the SDK event into PolarSubInput) so it is
 * unit-tested without the SDK. `lookup` is injected (productToPlan) for the
 * same reason.
 */
import type { BillingPlan } from '@prisma/client'
import type { BillingPeriod } from '@/lib/billing'

export interface PolarSubInput {
  type: string
  productId: string | null
  status: string | null
  currentPeriodEnd: string | null
  recurringInterval: string | null // 'month' | 'year'
  customerExternalId: string | null
  customerId: string | null
  subscriptionId: string | null
  metadataOrganizationId: string | null
}

export type SubPatch =
  | {
      organizationId: string
      plan: BillingPlan
      status: string
      interval: string | null
      cancelAtPeriodEnd: boolean
      currentPeriodEnd: Date | null
      externalCustomerId: string | null
      externalSubscriptionId: string | null
    }
  | { ignore: true; reason: string }

type Lookup = (productId: string) => { plan: BillingPlan; period: BillingPeriod } | null

export function subscriptionUpdateFromEvent(e: PolarSubInput, lookup: Lookup): SubPatch {
  if (!e.type.startsWith('subscription.')) return { ignore: true, reason: 'unhandled_event' }

  const organizationId = e.customerExternalId || e.metadataOrganizationId
  if (!organizationId) return { ignore: true, reason: 'no_org' }

  const interval = e.recurringInterval === 'year' ? 'year' : e.recurringInterval === 'month' ? 'month' : null
  const currentPeriodEnd = e.currentPeriodEnd ? new Date(e.currentPeriodEnd) : null
  const base = {
    organizationId,
    interval,
    currentPeriodEnd,
    externalCustomerId: e.customerId,
    externalSubscriptionId: e.subscriptionId,
  }

  if (e.type === 'subscription.revoked') {
    return { ...base, plan: 'FREE', status: 'canceled', cancelAtPeriodEnd: false }
  }

  const resolved = e.productId ? lookup(e.productId) : null
  if (!resolved) return { ignore: true, reason: 'unknown_product' }

  if (e.type === 'subscription.canceled') {
    return { ...base, plan: resolved.plan, status: e.status || 'active', cancelAtPeriodEnd: true }
  }

  // subscription.created | updated | active | uncanceled
  return { ...base, plan: resolved.plan, status: e.status || 'active', cancelAtPeriodEnd: false }
}
```

- [ ] **Step 4: Run the test**

Run: `npm run test:polar`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/billing.webhook.ts scripts/polar.check.ts
git commit -m "feat(billing): pure Polar webhook→subscription mapping (tested)"
```

---

### Task 7: Webhook route

**Files:**
- Create: `src/app/api/webhooks/polar/route.ts`

**Interfaces:**
- Consumes: `validateEvent` (`@polar-sh/sdk/webhooks`), `prisma`, `productToPlan` (`@/lib/polar-plans`), `subscriptionUpdateFromEvent` + `PolarSubInput` (`@/services/billing.webhook`), `recordAudit` (`@/services/audit.service`).
- Produces: `POST /api/webhooks/polar` — verifies signature, upserts `Subscription`, audits.

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { validateEvent } from '@polar-sh/sdk/webhooks'
import { prisma } from '@/lib/prisma'
import { productToPlan } from '@/lib/polar-plans'
import { subscriptionUpdateFromEvent, type PolarSubInput } from '@/services/billing.webhook'
import { recordAudit } from '@/services/audit.service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET
  const bodyText = await req.text()

  // Fail closed in production when unverifiable (mirror webhooks/gmail).
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('[webhooks/polar] POLAR_WEBHOOK_SECRET not set — refusing in production')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any
  try {
    if (secret) {
      const headers = Object.fromEntries(req.headers.entries())
      event = validateEvent(bodyText, headers, secret)
    } else {
      event = JSON.parse(bodyText) // dev only (no secret configured)
    }
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const type = String(event?.type || '')
  if (!type.startsWith('subscription.')) {
    return NextResponse.json({ ok: true, ignored: 'not_subscription' })
  }

  const d = event.data || {}
  const input: PolarSubInput = {
    type,
    productId: d.productId ?? d.product?.id ?? null,
    status: d.status ?? null,
    currentPeriodEnd: d.currentPeriodEnd ?? null,
    recurringInterval: d.recurringInterval ?? null,
    customerExternalId: d.customer?.externalId ?? d.customerExternalId ?? null,
    customerId: d.customerId ?? d.customer?.id ?? null,
    subscriptionId: d.id ?? null,
    metadataOrganizationId: (d.metadata?.organizationId as string) ?? null,
  }

  const patch = subscriptionUpdateFromEvent(input, productToPlan)
  if ('ignore' in patch) return NextResponse.json({ ok: true, ignored: patch.reason })

  const org = await prisma.organization.findUnique({ where: { id: patch.organizationId }, select: { id: true } })
  if (!org) return NextResponse.json({ ok: true, ignored: 'unknown_org' })

  const data = {
    plan: patch.plan,
    status: patch.status,
    interval: patch.interval,
    cancelAtPeriodEnd: patch.cancelAtPeriodEnd,
    currentPeriodEnd: patch.currentPeriodEnd,
    externalCustomerId: patch.externalCustomerId,
    externalSubscriptionId: patch.externalSubscriptionId,
  }
  await prisma.subscription.upsert({
    where: { organizationId: patch.organizationId },
    create: { organizationId: patch.organizationId, seats: 1, ...data },
    update: data,
  })

  await recordAudit({
    organizationId: patch.organizationId,
    actorId: null,
    action: 'billing.subscription_updated',
    summary: `Subscription → ${patch.plan} (${patch.status})`,
    targetType: 'subscription',
    targetId: patch.organizationId,
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS. (If `validateEvent` import path/signature differs in the installed SDK version, adjust to its exports — see spec §14.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/polar/route.ts
git commit -m "feat(billing): Polar webhook receiver (verify, upsert subscription, audit)"
```

---

### Task 8: Customer portal route

**Files:**
- Create: `src/app/api/billing/portal/route.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `getOrgContext`, `can`, `getPolar`.
- Produces: `GET /api/billing/portal` → 303 redirect to the Polar customer portal URL.

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import { can } from '@/lib/permissions'
import { getPolar } from '@/lib/polar'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(new URL('/login', appUrl))

  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.redirect(new URL('/onboarding', appUrl))
  if (!can(ctx.role, 'billing:manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const polar = getPolar()
    const session = await polar.customerSessions.create({ customerExternalId: ctx.organization.id })
    return NextResponse.redirect(session.customerPortalUrl, { status: 303 })
  } catch (e) {
    console.error('[billing/portal] failed:', e)
    return NextResponse.redirect(new URL('/settings?portal=error', appUrl))
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS. (If `customerSessions.create` / `customerPortalUrl` names differ in the installed SDK version, adjust to its types.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/billing/portal/route.ts
git commit -m "feat(billing): Polar customer portal route"
```

---

### Task 9: Daily reconcile (cron backstop)

**Files:**
- Modify: `src/app/api/cron/gmail/route.ts` (inside `handle`, before `kickJobQueue()`; extend the JSON response)

**Interfaces:**
- Consumes: `prisma` (already imported in the file).
- Produces: downgrades expired-canceled subscriptions to FREE; adds `downgraded` to the response body.

- [ ] **Step 1: Add the reconcile step**

In `src/app/api/cron/gmail/route.ts`, immediately before the `kickJobQueue()` call near the end of `handle`, insert:

```ts
  // Billing reconcile (backstop for missed webhooks): any subscription set to
  // cancel-at-period-end whose period has lapsed drops to FREE.
  let downgraded = 0
  try {
    const res = await prisma.subscription.updateMany({
      where: { cancelAtPeriodEnd: true, currentPeriodEnd: { lt: new Date() }, plan: { not: 'FREE' } },
      data: { plan: 'FREE', status: 'canceled', cancelAtPeriodEnd: false },
    })
    downgraded = res.count
  } catch (e) {
    errors.push(`billing-reconcile: ${String(e)}`)
  }
```

- [ ] **Step 2: Include it in the response**

Change the final `return NextResponse.json({ integrations, maintenanceQueued, prunedJobs, errors })` to:

```ts
  return NextResponse.json({ integrations, maintenanceQueued, prunedJobs, downgraded, errors })
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/gmail/route.ts
git commit -m "feat(billing): daily reconcile downgrades expired-canceled subs to FREE"
```

---

## Phase 3 — AI feature gating

### Task 10: Org plan/feature helper

**Files:**
- Create: `src/services/billing.service.ts`

**Interfaces:**
- Consumes: `prisma`, `hasFeature` (`@/lib/billing`).
- Produces:
  - `getOrgPlan(organizationId: string): Promise<BillingPlan>`
  - `orgHasFeature(organizationId: string, feature: 'audit'|'automations'|'aiDrafts'|'digest'|'assistant'): Promise<boolean>`

- [ ] **Step 1: Implement the helper**

```ts
/**
 * Billing reads for enforcement points. One sequential Subscription lookup per
 * gated path (never fan out — small Prisma pool). Defaults to FREE when no
 * subscription row exists.
 */
import type { BillingPlan } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hasFeature } from '@/lib/billing'

export async function getOrgPlan(organizationId: string): Promise<BillingPlan> {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { plan: true },
  })
  return sub?.plan ?? 'FREE'
}

export async function orgHasFeature(
  organizationId: string,
  feature: 'audit' | 'automations' | 'aiDrafts' | 'digest' | 'assistant',
): Promise<boolean> {
  return hasFeature(await getOrgPlan(organizationId), feature)
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/billing.service.ts
git commit -m "feat(billing): org plan/feature lookup helper"
```

---

### Task 11: Gate the AI routes (assistant, assistant/act, draft) → 402

**Files:**
- Modify: `src/app/api/assistant/route.ts`
- Modify: `src/app/api/assistant/act/route.ts`
- Modify: `src/app/api/conversations/[id]/draft/route.ts`

**Interfaces:**
- Consumes: `orgHasFeature` (`@/services/billing.service`).

- [ ] **Step 1: Gate `assistant/route.ts`**

Add the import near the other imports:

```ts
import { orgHasFeature } from '@/services/billing.service'
```

Then, right after the `rateLimit` guard (`if (limited) return limited`), add:

```ts
  if (!(await orgHasFeature(ctx.organization.id, 'assistant'))) {
    return err('Upgrade to Pro to use the AI assistant', 402)
  }
```

- [ ] **Step 2: Gate `assistant/act/route.ts`**

Add the same import, and after `if (limited) return limited` add:

```ts
  if (!(await orgHasFeature(ctx.organization.id, 'assistant'))) {
    return err('Upgrade to Pro to use the AI assistant', 402)
  }
```

- [ ] **Step 3: Gate the draft route `conversations/[id]/draft/route.ts`**

Add the import, then in the `POST` handler, after the conversation ownership/channel checks (`if (conv.channel !== 'GMAIL') ...`) and before parsing the body, add:

```ts
  if (!(await orgHasFeature(ctx.organization.id, 'aiDrafts'))) {
    return err('Upgrade to Pro to use AI drafts', 402)
  }
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual smoke (optional, requires running app + a FREE org)**

With a FREE-plan org session: `POST /api/assistant` → 402. With a PRO org → normal answer. (Set the org's `Subscription.plan` directly in `npx prisma studio` to test both.)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/assistant/route.ts src/app/api/assistant/act/route.ts "src/app/api/conversations/[id]/draft/route.ts"
git commit -m "feat(billing): gate AI assistant + drafts to Pro+ (402 otherwise)"
```

---

### Task 12: Gate the background AI jobs (auto-draft + weekly digest)

**Files:**
- Modify: `src/services/draft.service.ts` (`upsertAutoDraft`)
- Modify: `src/services/digest.service.ts` (`sendWeeklyDigest` + its result type)

**Interfaces:**
- Consumes: `orgHasFeature` (`@/services/billing.service`).

- [ ] **Step 1: Gate `upsertAutoDraft`**

In `src/services/draft.service.ts`, add the import:

```ts
import { orgHasFeature } from '@/services/billing.service'
```

In `upsertAutoDraft`, immediately after the org guard `if (!conv.organizationId) return { generated: false, reason: 'no-org' }`, add:

```ts
  if (!(await orgHasFeature(conv.organizationId, 'aiDrafts'))) {
    return { generated: false, reason: 'plan' }
  }
```

- [ ] **Step 2: Gate `sendWeeklyDigest`**

In `src/services/digest.service.ts`, add the import:

```ts
import { orgHasFeature } from '@/services/billing.service'
```

Extend the `DigestSendResult` skipped reason (around line 320) to include `'plan'`:

```ts
  | { status: 'skipped'; reason: 'no-integration' | 'no-recipient' | 'no-data' | 'plan' }
```

Then make the plan gate the FIRST statement inside `sendWeeklyDigest` (before `resolveDigestTarget`). The manual preview bypasses it:

```ts
  if (!opts.manual && !(await orgHasFeature(organizationId, 'digest'))) {
    return { status: 'skipped', reason: 'plan' }
  }
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Verify existing pure tests still pass**

Run: `npm run test:billing && npm run test:polar && npm run test:agentic`
Expected: PASS (agentic covers draft action parse/validate — confirm gating didn't break its imports).

- [ ] **Step 5: Commit**

```bash
git add src/services/draft.service.ts src/services/digest.service.ts
git commit -m "feat(billing): gate auto-drafts + weekly digest to plans that include them"
```

---

## Phase 4 — UI + docs

### Task 13: Pricing page — 5 plans + monthly/annual toggle + real checkout CTAs

**Files:**
- Modify: `src/app/(marketing)/pricing/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `PLAN_CATALOG`, `PLAN_ORDER`, `planPrice`, `BillingPlan`, `BillingPeriod` (`@/lib/billing`).

- [ ] **Step 1: Rewrite the page**

Replace the whole file with:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, type Variants, MotionConfig } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { PLAN_CATALOG, PLAN_ORDER, planPrice, type BillingPlan, type BillingPeriod } from '@/lib/billing'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
}
const stagger: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }

const POPULAR: BillingPlan = 'PRO'

function priceParts(plan: BillingPlan, period: BillingPeriod): { price: string; sub: string | null } {
  const monthly = planPrice(plan, 'monthly')
  if (monthly === null) return { price: 'Custom', sub: null }
  if (monthly === 0) return { price: 'Free', sub: null }
  if (period === 'annual') {
    const annual = planPrice(plan, 'annual') as number
    return { price: `$${Math.round(annual / 12)}`, sub: `/ mo · billed $${annual}/yr` }
  }
  return { price: `$${monthly}`, sub: '/ mo' }
}

function cta(plan: BillingPlan, period: BillingPeriod): { label: string; href: string } {
  if (plan === 'ENTERPRISE') return { label: 'Talk to sales', href: '/contact' }
  if (plan === 'FREE') return { label: 'Start free', href: '/signup' }
  return { label: `Get ${PLAN_CATALOG[plan].name}`, href: `/api/billing/checkout?plan=${plan}&period=${period}` }
}

function PlanCard({ plan, period }: { plan: BillingPlan; period: BillingPeriod }) {
  const info = PLAN_CATALOG[plan]
  const { price, sub } = priceParts(plan, period)
  const accent = plan === POPULAR
  const c = cta(plan, period)
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 24px',
        borderRadius: 18,
        background: accent ? 'linear-gradient(180deg, rgba(79,92,244,0.05) 0%, #FFFFFF 40%)' : '#FFFFFF',
        border: `1px solid ${accent ? 'rgba(79,92,244,0.25)' : 'var(--border)'}`,
        boxShadow: accent ? '0 12px 40px rgba(79,92,244,0.12)' : 'var(--shadow-sm)',
        position: 'relative',
      }}
    >
      {accent && (
        <span style={{ position: 'absolute', top: -12, left: 24, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: 'var(--accent)', padding: '5px 12px', borderRadius: 999 }}>
          Most popular
        </span>
      )}
      <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{info.name}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.55, minHeight: 40 }}>{info.tagline}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 34, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{price}</span>
        {sub && <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{sub}</span>}
      </div>
      <Link href={c.href} className={accent ? 'btn-primary' : 'btn-ghost'} style={{ justifyContent: 'center', textDecoration: 'none', marginBottom: 20, gap: 8 }}>
        {c.label} <ArrowRight size={14} />
      </Link>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {info.features.map((f) => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <Check size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

export default function PricingPage() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly')
  return (
    <MotionConfig reducedMotion="user">
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <Navbar />

        <section className="hero-top mkt-x" style={{ paddingLeft: 32, paddingRight: 32 }}>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 16px' }}
            >
              Start solo, grow into a <span style={{ color: 'var(--accent)' }}>team</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
              style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 22px' }}
            >
              Flat pricing, no setup fees. Free for one mailbox; upgrade for full AI and your team.
            </motion.p>

            <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, border: '1px solid var(--border)', background: '#fff' }}>
              {(['monthly', 'annual'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    padding: '7px 16px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    color: period === p ? '#fff' : 'var(--text-secondary)',
                    background: period === p ? 'var(--accent)' : 'transparent',
                  }}
                >
                  {p === 'monthly' ? 'Monthly' : 'Annual · 2 months free'}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="section-padded mkt-x" style={{ paddingTop: 30, paddingBottom: 100, paddingLeft: 32, paddingRight: 32 }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="pricing-grid"
            style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, alignItems: 'stretch' }}
          >
            {PLAN_ORDER.map((p) => <PlanCard key={p} plan={p} period={period} />)}
          </motion.div>
        </section>

        <section className="mkt-x mkt-pb" style={{ padding: '0 32px 120px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Need SSO, custom retention or a security review?{' '}
              <Link href="/contact" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>Talk to our team</Link>.
            </p>
          </div>
        </section>

        <Footer />
      </div>
    </MotionConfig>
  )
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Verify the page renders**

Run: `npm run dev`, open `http://localhost:3000/pricing`.
Expected: 5 cards; Monthly/Annual toggle switches Pro/Team/Business prices (annual shows "/ mo · billed $X/yr"); paid CTAs link to `/api/billing/checkout?plan=…&period=…`. If 5 columns are too tight on your viewport, the existing `.pricing-grid` responsive CSS collapses them — confirm and, if needed, add a `@media` override in `globals.css` (note: Turbopack won't hot-reload `globals.css` — `rm -rf .next` after editing it).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(marketing)/pricing/page.tsx"
git commit -m "feat(billing): pricing page — 5 plans, monthly/annual toggle, Polar checkout CTAs"
```

---

### Task 14: Settings → Plan card (upgrade / manage billing / over-limit) + drop `NEXT_PUBLIC_CHECKOUT_URL`

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx` (extend the subscription query + member count, pass new props)
- Modify: `src/components/settings/SettingsTabs.tsx` (Plan card rewrite; add `PRO` label; remove `NEXT_PUBLIC_CHECKOUT_URL`)

**Interfaces:**
- Consumes: `planLimits`, `PLAN_CATALOG` (`@/lib/billing`); `prisma`.
- Produces: Plan card shows plan + period + renewal/cancel state, an Upgrade (Free) / Manage billing (paid) action, and an over-limit banner.

- [ ] **Step 1: Extend the Settings page data**

In `src/app/(dashboard)/settings/page.tsx`, replace the `sub` query and add a member count:

```tsx
  const sub = await prisma.subscription.findUnique({
    where: { organizationId: ctx.organization.id },
    select: { plan: true, seats: true, interval: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  })
  const memberCount = await prisma.membership.count({
    where: { organizationId: ctx.organization.id, status: 'ACTIVE' },
  })
```

Then pass the new props into `<SettingsTabs>`:

```tsx
        <SettingsTabs
          orgName={ctx.organization.name}
          role={ctx.role}
          plan={sub?.plan ?? 'FREE'}
          seats={sub?.seats ?? 1}
          interval={sub?.interval ?? null}
          renewalISO={sub?.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null}
          cancelAtPeriodEnd={sub?.cancelAtPeriodEnd ?? false}
          memberCount={memberCount}
          userName={userName}
          userEmail={userEmail}
        />
```

- [ ] **Step 2: Update the `SettingsTabs` props + plan label**

In `src/components/settings/SettingsTabs.tsx`:

Add the billing imports near the top:

```tsx
import { planLimits } from '@/lib/billing'
```

Add `PRO` to `PLAN_LABEL`:

```tsx
const PLAN_LABEL: Record<string, string> = { FREE: 'Free', PRO: 'Pro', TEAM: 'Team', BUSINESS: 'Business', ENTERPRISE: 'Enterprise' }
```

Extend the component props (the `}: {` destructure block and its type):

```tsx
export default function SettingsTabs({
  orgName,
  role,
  plan,
  seats,
  interval,
  renewalISO,
  cancelAtPeriodEnd,
  memberCount,
  userName,
  userEmail,
}: {
  orgName: string
  role: OrgRole
  plan: string
  seats: number
  interval: string | null
  renewalISO: string | null
  cancelAtPeriodEnd: boolean
  memberCount: number
  userName: string | null
  userEmail: string | null
}) {
```

- [ ] **Step 3: Rewrite the Plan `WidgetShell` block**

Replace the entire Plan `WidgetShell` (the one titled "Plan", currently lines ~81–93) with:

```tsx
          <WidgetShell icon={<Crown size={14} />} title="Plan" sub="Billing for this organization" bodyStyle={{ padding: '18px 20px' }}>
            {memberCount > planLimits(plan as import('@prisma/client').BillingPlan).members && (
              <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', fontSize: 12.5, color: '#b91c1c' }}>
                You have {memberCount} members but your plan allows {planLimits(plan as import('@prisma/client').BillingPlan).members}. Upgrade, or remove members to stay within your plan.
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{PLAN_LABEL[plan] ?? plan}</p>
                  <span className="tag" style={{ fontSize: 10.5, padding: '2px 9px' }}>{seats} seat{seats === 1 ? '' : 's'}</span>
                  {interval && <span className="tag" style={{ fontSize: 10.5, padding: '2px 9px' }}>{interval === 'year' ? 'Annual' : 'Monthly'}</span>}
                </div>
                {renewalISO && (
                  <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {cancelAtPeriodEnd ? 'Ends' : 'Renews'} {new Date(renewalISO).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>
              {can(role, 'billing:manage') && (
                plan === 'FREE' ? (
                  <a href="/pricing" className="btn-primary" style={{ fontSize: 13.5, padding: '9px 18px' }}>Upgrade plan</a>
                ) : (
                  <a href="/api/billing/portal" className="btn-ghost" style={{ fontSize: 13.5, padding: '9px 18px' }}>Manage billing</a>
                )
              )}
            </div>
          </WidgetShell>
```

- [ ] **Step 4: Verify no `NEXT_PUBLIC_CHECKOUT_URL` remains**

Run: `npx tsc --noEmit` then search the repo (Grep) for `NEXT_PUBLIC_CHECKOUT_URL`.
Expected: type-check PASS; the only remaining mention (if any) is in `CLAUDE.md`, fixed in Task 15.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/settings/page.tsx" src/components/settings/SettingsTabs.tsx
git commit -m "feat(billing): Settings plan card — upgrade/manage/over-limit, drop checkout-url env"
```

---

### Task 15: Documentation — env vars in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (Environment Variables section + the `NEXT_PUBLIC_CHECKOUT_URL` line)

**Interfaces:** none (docs only).

- [ ] **Step 1: Replace the `NEXT_PUBLIC_CHECKOUT_URL` line with the Polar block**

In `CLAUDE.md`, find the `NEXT_PUBLIC_CHECKOUT_URL` line in the env section and replace it with:

```
POLAR_ACCESS_TOKEN     # Polar organization access token (sandbox or production)
POLAR_WEBHOOK_SECRET   # Polar webhook signing secret (verifies /api/webhooks/polar)
POLAR_SERVER           # "sandbox" (default) | "production"
POLAR_PRODUCT_PRO_MONTHLY        # Polar product id — Pro, monthly
POLAR_PRODUCT_PRO_ANNUAL         # Polar product id — Pro, annual
POLAR_PRODUCT_TEAM_MONTHLY       # Polar product id — Team, monthly
POLAR_PRODUCT_TEAM_ANNUAL        # Polar product id — Team, annual
POLAR_PRODUCT_BUSINESS_MONTHLY   # Polar product id — Business, monthly
POLAR_PRODUCT_BUSINESS_ANNUAL    # Polar product id — Business, annual
```

- [ ] **Step 2: Add a one-line note under "Key Decisions" (optional but recommended)**

Add a bullet noting Polar is the payment engine and the DB stays the source of truth for plan/seats; flat tiers (Free/Pro/Team/Business/Enterprise); AI features gated to Pro+.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document Polar billing env vars + plan model"
```

---

## Manual end-to-end verification (Polar sandbox)

Do this once after Phase 2–4, with `POLAR_SERVER=sandbox` and sandbox product ids set:

1. In Polar (sandbox): create the org, 6 products (Pro/Team/Business × monthly/annual), copy product ids into `.env.local`. Add a webhook endpoint → `https://<ngrok>/api/webhooks/polar` with the signing secret in `POLAR_WEBHOOK_SECRET`.
2. `npm run dev`; `ngrok http 3000` (tunnel for webhooks).
3. As an org OWNER on a FREE org, open `/pricing` → Get Pro → complete Polar checkout with a sandbox test card.
4. Confirm the `subscription.active` webhook hits `/api/webhooks/polar` and the org's `Subscription.plan` flips to `PRO` (check `npx prisma studio`).
5. Confirm AI features unlock (assistant answers; draft generates) — they 402'd while FREE.
6. In Settings → Plan → Manage billing → Polar portal → cancel. Confirm `cancelAtPeriodEnd=true`, plan retained until `currentPeriodEnd`.
7. Simulate expiry (set `currentPeriodEnd` to the past in studio) and hit `/api/cron/gmail` with the cron secret → confirm `downgraded` ≥ 1 and plan back to FREE.

---

## Self-review notes (coverage check)

- Spec §5 (model) → Task 1. §6 (catalog) → Task 2. §7 (mapping + env) → Task 3, Task 15.
- §8.1 checkout → Task 5 (client Task 4). §8.2 webhook → Tasks 6–7. §8.3 portal → Task 8.
- §9 reconcile → Task 9. §10 gating → Tasks 10–12. §11 UI → Tasks 13–14.
- §12 testing → Tasks 2, 3, 6 (pure) + manual e2e section.
- SDK method/field names (`checkouts.create`, `customerSessions.create`, `validateEvent`, webhook payload fields) are flagged for version confirmation in the route tasks and spec §14.
