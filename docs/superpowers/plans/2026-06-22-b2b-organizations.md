# Velnox B2B Organization-First — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Velnox from a single-user (`userId`-scoped) B2C inbox into an organization-first B2B shared-inbox copilot for teams.

**Architecture:** Introduce `Organization` as the tenant; `Membership` maps users→orgs with roles; a connected mailbox becomes a shared `Inbox` owned by the org; conversations gain `organizationId`/`inboxId`/`assigneeId`/`state`. All tenant scoping moves `userId → organizationId`; `userId` is retained only as authorship/actor. Delivered in 10 batches, each leaving `npm run build` green.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Prisma 5 · Supabase Postgres · Zustand · Tailwind 4.

## Global Constraints (apply to every task)

- **Verification model:** no unit-test framework. Pure logic → `tsx` script under `scripts/` wired as an `npm run test:*` (mirror `test:classifier`/`test:agentic`). Everything else → `npm run build` + `npm run lint` + smoke. A batch is "done" only when `npm run build` passes.
- **Connection pool:** never `Promise.all` Prisma queries in a request path — sequential only (Supabase transaction pooler, small `connection_limit`; P2024 risk).
- **Two Supabase clients:** `supabase.ts` (browser) client-side; `supabase-server.ts` (server) for Route Handlers/Server Components. Never the browser client server-side.
- **Migrations gitignored:** `schema.prisma` is the source of truth; apply with `npx prisma migrate dev`, regenerate with `npx prisma generate`.
- **Module honesty:** every dashboard module carries a `ModulePill` status (`live`/`beta`/`soon`); no unlabelled mock data.
- **No B2C leftovers:** no solo "your inbox" copy, no TODOs, no stubs in shipped code.
- **AI provider boundary:** business logic never touches a vendor SDK; go through `src/services/ai/`.
- **Drafts are review-before-send:** never auto-send mail.
- **Brand:** product name is **Velnox**.

---

## File-structure map (whole migration)

**New core libs**
- `src/lib/org.ts` — `getOrgContext()`, `requireOrg(minRole?)`, active-org cookie resolution.
- `src/lib/permissions.ts` — `OrgRole`, `can(role, action)`, permission matrix (pure, testable).
- `src/lib/billing.ts` — plan catalog, `planLimits(plan)`, `seatCount`, feature gates (pure).

**New services**
- `src/services/organization.service.ts` — org/membership CRUD, invites, switch.
- `src/services/inbox.service.ts` — inbox CRUD over Integration.
- `src/services/assignment.service.ts` — assign/state/notes/tags + audit writes.
- `src/services/rule.service.ts` + `src/services/rule.engine.ts` (pure matcher) — routing/automation.
- `src/services/template.service.ts` — saved replies.
- `src/services/audit.service.ts` — `recordAudit()` + `listAudit()`.

**Schema**
- `prisma/schema.prisma` — new models/enums + re-scoped columns.
- `scripts/backfill-orgs.ts` — idempotent data migration.

**Auth/onboarding**
- `src/app/(onboarding)/onboarding/*` — multi-step org creation.
- `src/components/org/OrgSwitcher.tsx` — sidebar switcher.

**Settings IA**
- `src/app/(dashboard)/settings/*` — tabbed: organization / members / inboxes / tags / rules / templates / billing / audit.

**Content**
- `src/app/page.tsx`, `(marketing)/pricing/page.tsx`, marketing sections — B2B rewrite.

---

## Batch 1 — Schema + backfill (DETAILED)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `scripts/backfill-orgs.ts`
- Modify: `package.json` (add `backfill:orgs` script)

**Interfaces produced (consumed by all later batches):**

New models/enums added to `schema.prisma`:

```prisma
model Organization {
  id           String        @id @default(cuid())
  name         String
  slug         String        @unique
  createdAt    DateTime      @default(now())
  memberships  Membership[]
  invitations  Invitation[]
  inboxes      Inbox[]
  subscription Subscription?
}

model Membership {
  id             String       @id @default(cuid())
  organizationId String
  userId         String
  role           OrgRole      @default(MEMBER)
  status         MemberStatus @default(ACTIVE)
  createdAt      DateTime     @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  assigned       Conversation[] @relation("ConversationAssignee")
  @@unique([organizationId, userId])
  @@index([userId])
}

model Invitation {
  id             String       @id @default(cuid())
  organizationId String
  email          String
  role           OrgRole      @default(MEMBER)
  token          String       @unique
  status         InviteStatus @default(PENDING)
  invitedById    String?
  expiresAt      DateTime
  acceptedAt     DateTime?
  createdAt      DateTime     @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([email])
}

model Inbox {
  id             String        @id @default(cuid())
  organizationId String
  name           String
  address        String
  channel        ChannelEnum   @default(GMAIL)
  color          String?
  isActive       Boolean       @default(true)
  createdAt      DateTime      @default(now())
  organization   Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  integration    Integration?
  conversations  Conversation[]
  @@unique([organizationId, address])
}

model InternalNote {
  id             String       @id @default(cuid())
  organizationId String
  conversationId String
  authorId       String
  body           String
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId, createdAt])
}

model Tag {
  id             String       @id @default(cuid())
  organizationId String
  name           String
  color          String       @default("#6366F1")
  createdAt      DateTime     @default(now())
  conversations  ConversationTag[]
  @@unique([organizationId, name])
}

model ConversationTag {
  conversationId String
  tagId          String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  tag            Tag          @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([conversationId, tagId])
}

model Rule {
  id             String       @id @default(cuid())
  organizationId String
  name           String
  isActive       Boolean      @default(true)
  order          Int          @default(0)
  conditions     Json         @default("{}")
  actions        Json         @default("{}")
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  @@index([organizationId, isActive, order])
}

model Template {
  id             String       @id @default(cuid())
  organizationId String
  title          String
  body           String
  shared         Boolean      @default(true)
  createdById    String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  @@index([organizationId])
}

model AuditLog {
  id             String       @id @default(cuid())
  organizationId String
  actorId        String?
  action         String
  targetType     String?
  targetId       String?
  summary        String
  metadata       Json         @default("{}")
  createdAt      DateTime     @default(now())
  @@index([organizationId, createdAt])
}

model Subscription {
  id                 String       @id @default(cuid())
  organizationId     String       @unique
  plan               BillingPlan  @default(FREE)
  status             String       @default("active")
  seats              Int          @default(1)
  externalCustomerId String?
  currentPeriodEnd   DateTime?
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt
  organization       Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

enum OrgRole { OWNER ADMIN MEMBER VIEWER }
enum MemberStatus { ACTIVE SUSPENDED }
enum InviteStatus { PENDING ACCEPTED REVOKED EXPIRED }
enum ConversationState { OPEN SNOOZED CLOSED }
enum BillingPlan { FREE TEAM BUSINESS ENTERPRISE }
```

Changed columns (add, keep old `userId` for now to allow a non-breaking backfill, drop the old unique on Integration):
- `User` += `memberships Membership[]`
- `Integration` += `organizationId String?`, `inboxId String? @unique`, `connectedById String?`; relations to `Organization`/`Inbox`; **remove** `@@unique([userId, type])`, add `@@index([organizationId])`.
- `Conversation` += `organizationId String?`, `inboxId String?`, `assigneeId String?`, `state ConversationState @default(OPEN)`; relations (`assignee Membership? @relation("ConversationAssignee")`, `inbox Inbox?`, `tags ConversationTag[]`, `internalNotes InternalNote[]`); add `@@index([organizationId, state])`, `@@index([organizationId, assigneeId])`.
- `Contact`, `RiskAlert`, `Reminder`, `CategoryRule`, `ConversationDraft`, `EmailDigest`, `ContactNote` += `organizationId String?` + `@@index([organizationId])`.

> Columns are added **nullable** in Batch 1 so the backfill can populate them without a destructive migration. A later hardening pass (end of Batch 3) tightens the ones that are safe to make required.

- [ ] **Step 1: Edit `schema.prisma`** — add the models/enums above and the changed columns. Keep existing `userId` fields.
- [ ] **Step 2: Apply migration** — `npx prisma migrate dev --name b2b_organizations` then `npx prisma generate`. Expected: migration applies, client regenerates.
- [ ] **Step 3: Write `scripts/backfill-orgs.ts`** — idempotent: for each `User` with no `Membership`, create `Organization` (slug = unique-ified from email), `Membership(OWNER, ACTIVE)`, `Subscription(FREE)`; wrap the user's `Integration` into an `Inbox` (address = `integration.email`), set `integration.organizationId/inboxId/connectedById`; set `organizationId` (and `inboxId` for conversations) on all the user's scoped rows; set `Conversation.state = (status in [ARCHIVED,LOST]) ? CLOSED : OPEN`. Run all writes sequentially (pool constraint). Log a summary.
- [ ] **Step 4: Add npm script** — `"backfill:orgs": "tsx scripts/backfill-orgs.ts"` in `package.json`.
- [ ] **Step 5: Run backfill** — `npm run backfill:orgs`. Expected: prints `orgs created: N, integrations linked: M, conversations updated: K`. Re-run → prints `0 created` (idempotent).
- [ ] **Step 6: Build** — `npm run build`. Expected: PASS.
- [ ] **Step 7: Commit** — `git commit -m "feat(b2b): organization-first schema + idempotent backfill"`.

---

## Batch 2 — Auth / RBAC org context

**Files:** Create `src/lib/permissions.ts`, `src/lib/org.ts`, `src/components/org/OrgSwitcher.tsx`, `src/app/api/orgs/route.ts`, `src/app/api/orgs/switch/route.ts`; Modify `src/proxy.ts` (forward membership), `(dashboard)/layout.tsx`, `Sidebar.tsx`; Test `scripts/test-permissions.ts`.

**Interfaces produced:**
- `permissions.ts`: `type OrgRole`; `type OrgAction`; `can(role: OrgRole, action: OrgAction): boolean`; `ROLE_RANK: Record<OrgRole, number>`.
- `org.ts`: `getOrgContext(): Promise<{ user, organization, membership, role } | null>`; `requireOrg(minRole?: OrgRole): Promise<{ ctx } | { error: NextResponse }>`; `ACTIVE_ORG_COOKIE = 'velnox_org'`.

Tasks: write `can()` + matrix with a `tsx` test (TDD-style: write `scripts/test-permissions.ts` asserting the matrix, run, implement, run); implement `org.ts` resolving active org from cookie validated against membership; org-switch route sets the cookie + audits; sidebar `OrgSwitcher`; onboarding gate (no membership → redirect `/onboarding`). Verify: `npm run test:permissions`, `npm run build`.

---

## Batch 3 — Re-scope services + API to org

**Files:** every file in the `userId`-grep set (40) — services in `src/services/*`, routes in `src/app/api/**`, dashboard pages. Modify `src/services/jobs/*` (payloads carry `organizationId`). Rework `digest.service.ts` + `notification.service.ts` to per-org identity (remove `GMAIL_USER_EMAIL` hardcode → org owner mailbox / inbox address).

Approach: change service signatures `userId → organizationId`; routes resolve `requireOrg()` then pass `organizationId`; `loadWorkspace(organizationId)`. Keep authorship `userId` where a row records "who". Update the two `tsx` tests (`test:classifier`, `test:agentic`) for new signatures. Verify after: `npm run test:classifier`, `npm run test:agentic`, `npm run build`, `npm run lint`. Then a hardening sub-pass: make backfilled columns `NOT NULL` where safe.

---

## Batch 4 — Inbox collaboration

**Files:** Create `src/services/assignment.service.ts`, `src/services/audit.service.ts`, `src/app/api/conversations/[id]/assign/route.ts`, `.../state/route.ts`, `.../notes/route.ts`, `.../tags/route.ts`; Modify inbox list/thread components + `InboxListContent.tsx`, `/api/conversations` (queue filters `assignee`, `state`, `inbox`).

Deliverable: assign to member, set OPEN/SNOOZED/CLOSED, internal notes panel in thread, tag chips; queue filters (assigned to me / unassigned / by inbox). Every mutation writes audit. Verify: `npm run build`, smoke the inbox.

---

## Batch 5 — Rules + Templates

**Files:** Create `src/services/rule.engine.ts` (pure), `src/services/rule.service.ts`, `src/services/template.service.ts`, `scripts/test-rules.ts`; Modify the sync pipeline (`gmail.service.ts`/`jobs/handlers.ts`) to run rules on inbound; composer to insert templates; settings pages.

Deliverable: rule matcher (conditions→actions) applied on inbound sync; template insert in composer. TDD the pure `matchRule`/`evaluateConditions` via `scripts/test-rules.ts`. Verify: `npm run test:rules`, `npm run build`.

---

## Batch 6 — Admin / Settings IA + Onboarding

**Files:** Restructure `(dashboard)/settings/*` into tabs (organization / members / inboxes / tags / rules / templates / billing / audit); Create `(onboarding)/onboarding/*` (create org → connect inbox → invite → rule); invite accept route `/api/invitations/[token]`.

Deliverable: full org admin surface + multi-step onboarding. Permission-gated tabs. Verify: `npm run build`, smoke.

---

## Batch 7 — Billing

**Files:** Create `src/lib/billing.ts` (plan catalog + gates), `scripts/test-billing.ts`; Modify pricing page → Team/Business/Enterprise; Settings→Billing (plan, seats used, upgrade via external checkout); enforce seat/inbox/rule limits at creation points.

Deliverable: plan/seat model + gating + team pricing. TDD `planLimits`/`canAddSeat`. Verify: `npm run test:billing`, `npm run build`.

---

## Batch 8 — Team analytics + dashboard

**Files:** Modify `analytics.service.ts`, `dashboard.service.ts`, `metrics.helpers.ts` for per-member/per-inbox breakdowns + SLA; dashboard widgets for team activity + assignment load.

Deliverable: team-scoped analytics + dashboard. Verify: `npm run build`, smoke.

---

## Batch 9 — Content (landing/pricing/marketing)

**Files:** `src/app/page.tsx`, `(marketing)/*`, marketing components, `FAQ`/testimonials/compare data, metadata.

Deliverable: B2B hero, team use cases, collaboration features, security, team social proof, demo CTA; all solo B2C copy removed. Verify: `npm run build`, `npm run lint`, visual smoke.

---

## Batch 10 — Final verification

`npm run build` + `npm run lint` + `npm run test:*` + smoke key flows. Produce a changelog: changed files, key decisions, follow-ups.

---

## Self-review (plan vs spec)

- Spec §3 models → Batch 1 (all models/enums present). ✓
- Spec §4 RBAC → Batch 2 (`permissions.ts` matrix matches the table). ✓
- Spec §5 collaboration → Batch 4. ✓
- Spec §6 rules/templates/audit/billing/analytics → Batches 5,7,8 (+ audit lib in 4). ✓
- Spec §7 job identity rework → Batch 3 (digest/notify per-org). ✓
- Spec §8 nav/settings/onboarding → Batches 2 (switcher) + 6. ✓
- Spec §9 content → Batch 9. ✓
- Spec §10 migration → Batch 1 backfill. ✓

Later-batch tasks are intentionally task-level (not line-level) because their final UI code depends on earlier batch outcomes; each is expanded to bite-sized steps at execution time per executing-plans.
