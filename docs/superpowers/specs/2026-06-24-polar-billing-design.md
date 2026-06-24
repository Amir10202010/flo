# Velnox Billing — Polar.sh Integration & Plan Restructure

**Date:** 2026-06-24
**Status:** Approved — implementing
**Branch:** `feat/b2b-organizations`

## 1. Goal

Turn the existing *scaffolded* billing (a `Subscription` model, a pure plan
catalog in `src/lib/billing.ts`, and CTAs that point at a placeholder
`NEXT_PUBLIC_CHECKOUT_URL`) into a **working paid product** powered by
[Polar.sh](https://polar.sh) as the payment processor / merchant of record.

Two things happen together:

1. **Plan restructure** — the catalog is B2B-only today (per-seat Team/Business).
   We add a **solo path** (Free + Pro) and switch the whole catalog to **flat
   per-tier pricing** (no per-seat multiplier).
2. **Polar integration** — real checkout, webhook-driven subscription state,
   customer portal, and a reconciliation backstop.

Polar is the billing engine only. The **source of truth for plan + seats stays
in our DB** (`Subscription` + `Membership`). Polar emits webhooks → we update
`Subscription`. This mirrors the existing Gmail push webhook posture (signature
verification, fail-closed in production, always 2xx-ack).

## 2. Confirmed product decisions

- **Five tiers, all flat** (one price per plan, *not* per seat):

  | Plan | Audience | $/mo | $/yr | Seats | Inboxes | History | Automations | Audit | AI features* |
  |------|----------|------|------|-------|---------|---------|-------------|-------|--------------|
  | **Free** | Solo, trying it | 0 | 0 | 1 | 1 | 7d | ✗ | ✗ | ✗ |
  | **Pro** | Serious solo | 12 | 120 | 1 | 1 | 90d | ✗ | ✗ | ✓ |
  | **Team** | Small teams | 40 | 400 | 5 | 3 | 90d | ✓ | ✗ | ✓ |
  | **Business** | Larger teams | 120 | 1200 | 20 | 10 | 365d | ✓ | ✓ | ✓ |
  | **Enterprise** | Custom | — | — | ∞ | ∞ | 730d | ✓ | ✓ | ✓ |

  *AI features = auto-drafts, weekly digest, AI assistant (Q&A + actions).

- **Annual = "2 months free"** (yearly price = 10× monthly). Both periods offered
  for Pro/Team/Business.
- **Free is strictly solo:** 1 member, 1 inbox. Team collaboration begins at Team.
- **AI features gated to Pro+** so Free ≠ Pro is meaningful. Today these features
  are gated only by AI-key presence / `GMAIL_USER_EMAIL`, never by plan — this is
  new enforcement.
- **Enterprise has no checkout** (contact sales). **Free has no checkout**
  (default plan on org creation). Only **Pro / Team / Business** need Polar
  products → **6 products** (3 plans × monthly/annual).

## 3. Non-goals (YAGNI)

- **No Polar seat-based pricing (beta).** It would make Polar own seat invitations
  (claim links, seat statuses), conflicting with our existing `Membership` +
  `Invitation` + `canAddSeat` flow. We keep flat tiers; seats are a *limit*, not a
  billed quantity.
- No metered/usage billing, no multi-currency, no in-app card forms (Polar hosts
  checkout and is the merchant of record — it handles tax/VAT).
- No proration UI — Polar handles proration on plan change/cancel.
- No automatic member removal on downgrade (see §9).

## 4. Current state (what exists vs. what changes)

Already built (keep):
- `Subscription` model per org: `plan`, `status`, `seats`, `externalCustomerId`,
  `currentPeriodEnd`. Created `FREE` in `createOrganization()`.
- `src/lib/billing.ts` — pure catalog + gates (`canAddSeat`, `canAddInbox`,
  `canAddRule`, `hasFeature`, `monthlyTotal`), unit-tested (`npm run test:billing`).
- Enforcement wired: `inviteMember()` calls `canAddSeat`; inbox/rule creation gate
  on their limits.
- `billing:manage` permission = ADMIN+; `recordAudit`; Gmail push webhook pattern;
  `RateLimit`; durable job queue; daily `/api/cron/gmail` maintenance.
- Pricing page (`/pricing`) and Settings → Plan card, both CTA →
  `NEXT_PUBLIC_CHECKOUT_URL` (placeholder).

Changes:
- Catalog gains `PRO`, switches to flat pricing, gains AI feature gates, Free → 1
  seat.
- `Subscription` gains `externalSubscriptionId`, `interval`, `cancelAtPeriodEnd`.
- New routes: checkout, webhook, portal. New cron reconcile step.
- `NEXT_PUBLIC_CHECKOUT_URL` removed from both call sites.

## 5. Data model (Prisma — local migration via `prisma migrate dev`)

```prisma
enum BillingPlan { FREE PRO TEAM BUSINESS ENTERPRISE }   // + PRO

model Subscription {
  // ...existing fields...
  externalSubscriptionId String?    // Polar subscription id
  interval               String?    // "month" | "year"
  cancelAtPeriodEnd      Boolean  @default(false)
}
```

Migrations are gitignored; `schema.prisma` is the committed source of truth.
Adding a `BillingPlan` enum value is additive (existing `FREE` rows unaffected).

## 6. Plan catalog (`src/lib/billing.ts` — pure, testable)

- `PlanInfo`: drop `pricePerSeat`; add `priceMonthly: number | null` and
  `priceAnnual: number | null`.
- `PlanLimits`: add boolean gates `aiDrafts`, `digest`, `assistant`.
- `PLAN_ORDER = ['FREE','PRO','TEAM','BUSINESS','ENTERPRISE']`.
- Replace `monthlyTotal(plan, seats)` with `planPrice(plan, period: 'monthly'|'annual'): number | null`.
- Extend `hasFeature` to accept `'audit' | 'automations' | 'aiDrafts' | 'digest' | 'assistant'`.
- Values per the §2 table.

Callers to update: `pricing/page.tsx`, `SettingsTabs.tsx`, `billing.check.ts`.

## 7. Polar plan mapping (`src/lib/polar-plans.ts` — pure, testable)

```ts
type Period = 'monthly' | 'annual'
planToProduct(plan: BillingPlan, period: Period): string | null   // → Polar productId from env
productToPlan(productId: string): { plan: BillingPlan; period: Period } | null  // reverse
```

Reads product ids from env. Pure → unit-tested (mapping round-trips, unknown
product → null).

### Environment variables (add to `.env.local` + document in `CLAUDE.md`)

```
POLAR_ACCESS_TOKEN              # organization access token (sandbox or prod)
POLAR_WEBHOOK_SECRET           # webhook signing secret
POLAR_SERVER                   # "sandbox" | "production"
POLAR_PRODUCT_PRO_MONTHLY
POLAR_PRODUCT_PRO_ANNUAL
POLAR_PRODUCT_TEAM_MONTHLY
POLAR_PRODUCT_TEAM_ANNUAL
POLAR_PRODUCT_BUSINESS_MONTHLY
POLAR_PRODUCT_BUSINESS_ANNUAL
```

`NEXT_PUBLIC_APP_URL` (already present) supplies success/return URLs.
`NEXT_PUBLIC_CHECKOUT_URL` is **removed**.

## 8. Routes

All three live under `src/app/api/billing/` and `src/app/api/webhooks/polar/`.
Dependency: `npm i @polar-sh/sdk` (verify exact method names against the installed
version during implementation).

### 8.1 `GET /api/billing/checkout?plan=PRO&period=monthly`
- Auth: unauthenticated → 302 `/login?next=<this url>`; no org → 302
  `/onboarding?next=<this url>`; authenticated but lacks `billing:manage` → 403.
- Resolve `productId = planToProduct(plan, period)`; invalid → 400.
- Create a Polar checkout via the SDK:
  - `products: [productId]`
  - `customerExternalId: organization.id`  (binds the Polar customer ↔ our org)
  - `customerEmail: ctx.email`
  - `metadata: { organizationId, plan, period }`  (redundant resolution path)
  - `successUrl: ${NEXT_PUBLIC_APP_URL}/settings?checkout=success`
- 302 → `checkout.url`.

`GET` is intentional (link-friendly, redirect-only side effect; mirrors the
`@polar-sh/nextjs` adapter convention).

### 8.2 `POST /api/webhooks/polar`
- Verify the signature with `POLAR_WEBHOOK_SECRET` (SDK `validateEvent` /
  standard-webhooks). **Fail closed in production** if the secret is unset (mirror
  `webhooks/gmail`). Always return 2xx once verified so Polar doesn't redeliver.
- A **pure** `subscriptionUpdateFromEvent(event)` derives the `Subscription`
  patch (unit-tested), then an idempotent upsert applies it:
  - `subscription.created | updated | active` → `plan` (from `productToPlan`),
    `status='active'`, `currentPeriodEnd`, `externalCustomerId`,
    `externalSubscriptionId`, `interval`, `cancelAtPeriodEnd=false`.
  - `subscription.canceled` → `cancelAtPeriodEnd=true` (keep plan/features until
    `currentPeriodEnd`).
  - `subscription.uncanceled` → `cancelAtPeriodEnd=false`.
  - `subscription.revoked` → `status='canceled'`, `plan='FREE'`.
- Resolve the org by `customer.externalId` (= `organizationId`), falling back to
  `metadata.organizationId`. Unknown org → ack + ignore (like the Gmail webhook's
  `no_integration`).
- `recordAudit` on plan changes (`billing.plan_changed`, `billing.canceled`).
- Idempotent: upserts are safe under redelivery; no event-id store needed.

### 8.3 `GET /api/billing/portal`
- Auth + `billing:manage`. Create a Polar customer session for
  `customerExternalId = organization.id` → 302 to the returned customer portal URL
  (manage card / cancel / invoices / receipts).

## 9. Reconciliation (in `/api/cron/gmail`, daily)

Backstop against missed/late webhooks: a bounded sweep downgrades orgs with
`cancelAtPeriodEnd = true` and `currentPeriodEnd < now()` to `plan='FREE'`,
`status='canceled'`. Cheap single query; runs alongside the existing prune steps.

## 10. AI feature gating (new enforcement)

New `src/services/billing.service.ts` (I/O):
- `getOrgPlan(organizationId): Promise<BillingPlan>` — reads `Subscription`,
  defaults `FREE`.
- `orgHasFeature(organizationId, feature): Promise<boolean>` — `getOrgPlan` →
  `hasFeature`.

Apply at:
- **Routes** (return **402 Payment Required** with an upgrade message when gated):
  - `POST /api/assistant`, `POST /api/assistant/act` → require `assistant`.
  - `POST /api/conversations/[id]/draft` → require `aiDrafts`.
- **Jobs / services** (plan loaded inside; skip silently, no error):
  - `GENERATE_DRAFT` / `upsertAutoDraft` → skip when org lacks `aiDrafts`.
  - `SEND_WEEKLY_DIGEST` / digest enqueue → skip when org lacks `digest`.

Pool-safety: these add **one** sequential `Subscription` lookup on the gated path
(never fan out — see the small-connection-pool rule).

## 11. UI

### 11.1 Pricing page (`/pricing`)
- Render **5** plans with a **Monthly / Annual** toggle (annual shows the discounted
  price + "2 months free").
- CTAs: Free → `/signup`; Pro/Team/Business → `/api/billing/checkout?plan=…&period=…`;
  Enterprise → `/contact`.
- Remove `NEXT_PUBLIC_CHECKOUT_URL`. Prices from `planPrice()`.

### 11.2 Settings → Plan card (`SettingsTabs.tsx`)
- Show current plan, billing period, and renewal/cancel date (`currentPeriodEnd`,
  `cancelAtPeriodEnd`).
- Free org → **Upgrade** (plan picker → checkout). Paid org → **Manage billing**
  (→ `/api/billing/portal`). Both gated on `billing:manage`.
- **Over-limit banner:** if active members > plan seat limit (e.g. after a
  downgrade), show a non-blocking banner ("You're over your plan's seat limit —
  upgrade or remove members"). We **never auto-remove** members; new invites are
  already blocked by `canAddSeat`.

## 12. Testing

- `npm run test:billing` — rewrite `billing.check.ts` for the new catalog (5 plans,
  flat `planPrice`, Free=1 seat, new AI gates).
- New pure test for `polar-plans.ts` (mapping round-trips, unknown → null) and
  `subscriptionUpdateFromEvent` (each event → expected patch). Wire as
  `npm run test:billing` additions or a new `test:polar` script.
- Manual e2e in **Polar sandbox** with a test card; `ngrok` to tunnel the webhook
  locally. Verify: checkout → `subscription.active` → DB plan flips → features
  unlock → portal cancel → `cancel_at_period_end` → reconcile downgrade.

## 13. Implementation phases

1. **Catalog + model + mapping** (§5, §6, §7) + tests — pure foundation, ships
   without breaking anything (no behavior change yet; CTAs still inert until §8).
2. **Polar checkout + webhook + portal + reconcile** (§8, §9) — real payments in
   sandbox.
3. **AI feature gating** (§10) — Free vs Pro becomes real.
4. **UI** (§11) — pricing toggle + Settings billing surface; remove
   `NEXT_PUBLIC_CHECKOUT_URL`.

## 14. Open implementation notes

- Confirm exact `@polar-sh/sdk` method names/shapes against the installed version
  (`checkouts.create`, `customerSessions.create`, `validateEvent`) — the SDK
  evolves; the design is API-shape-stable but names may differ.
- Confirm the webhook subscription payload field for the org link
  (`customer.externalId` vs `external_customer_id`) and set `metadata` as a belt.
- Decide the final annual discount copy ("2 months free" ⇒ ×10 monthly is the
  current assumption; trivially adjustable in the catalog).
