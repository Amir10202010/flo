# Velnox B2B — Organization-First Architecture

**Date:** 2026-06-22
**Status:** Approved — implementing
**Branch:** `feat/b2b-organizations`

## 1. Goal & positioning

Re-position Velnox from a single-user B2C "AI inbox for solo operators" into a
**B2B AI inbox / communication copilot for companies and teams**.

Confirmed product decisions:

- **Inbox model:** *shared team inbox* (Front / Help Scout / Missive style). An
  organization connects shared mailboxes (support@, sales@, hello@) and the whole
  team collaborates on them — assignment, internal notes, statuses, tags.
- **Positioning:** *general team comms / ops* — one product spanning support,
  sales, ops and founders/assistants. Vertical scenarios are presets, not forks.
- **Scope:** the full transformation (foundation → collaboration → admin → billing
  → analytics → content), delivered in sequenced batches, each leaving the project
  building. No B2C content, no TODOs, no stubs left behind.

## 2. Current state (what is single-user / B2C today)

- Supabase auth where `supabase.user.id` is used directly as the Prisma
  `User.id` (`api/auth/gmail/callback/route.ts`). One account = one person.
- Tenant key is `userId` everywhere: ~284 references across 40 files. Every model
  (`Conversation`, `Contact`, `RiskAlert`, `Reminder`, `ConversationDraft`,
  `CategoryRule`, `EmailDigest`, `ContactNote`) relates to `User` with cascade.
- `Integration @@unique([userId, type])` → exactly one Gmail per user. No concept
  of a shared/team mailbox.
- Digest + proactive notification identity hard-coded to a single env
  `GMAIL_USER_EMAIL` — structurally one owner per deployment.
- No Organization / Membership / Role / Inbox-as-entity / Assignment / Rule /
  Automation / AuditLog / Billing entities.
- Auth layer (`getCurrentUser`, `getAuthUser`) only answers "is there a user" — no
  roles, no membership, no access levels.
- Onboarding = "connect Gmail" on `/integrations`. Billing = a single external
  `NEXT_PUBLIC_CHECKOUT_URL`. Settings = per-mailbox notification flag.
- Marketing copy is solo-operator framed ("your Gmail", "never lose another
  client", "built for agencies, studios and consultants").

## 3. Target data model (organization-first)

The tenant key migrates `userId → organizationId`. `userId` is retained **only**
where it means "the acting user" (authorship of a draft/note/reminder, audit actor).

### New models

```
Organization { id, name, slug @unique, createdAt }
Membership   { id, organizationId, userId, role: OrgRole, status: MemberStatus, createdAt;
               @@unique([organizationId, userId]) }
Invitation   { id, organizationId, email, role: OrgRole, token @unique,
               status: InviteStatus, invitedById, expiresAt, acceptedAt, createdAt;
               @@index([organizationId]); @@index([email]) }
Inbox        { id, organizationId, name, address (lowercased), channel: ChannelEnum,
               color, isActive, createdAt; @@unique([organizationId, address]) }   // shared mailbox
InternalNote { id, organizationId, conversationId, authorId (userId), body, createdAt;
               @@index([conversationId, createdAt]) }
Tag          { id, organizationId, name, color, createdAt; @@unique([organizationId, name]) }
ConversationTag { conversationId, tagId; @@id([conversationId, tagId]) }
Rule         { id, organizationId, name, isActive, order, conditions: Json, actions: Json,
               createdAt, updatedAt; @@index([organizationId, isActive, order]) }
Template     { id, organizationId, title, body, shared, createdById, createdAt, updatedAt;
               @@index([organizationId]) }
AuditLog     { id, organizationId, actorId (userId, nullable for system), action,
               targetType, targetId, summary, metadata: Json, createdAt;
               @@index([organizationId, createdAt]) }
Subscription { id, organizationId @unique, plan: BillingPlan, status, seats,
               externalCustomerId, currentPeriodEnd, createdAt, updatedAt }
```

### Changed models

- `Integration`: add `organizationId`, `inboxId` (the mailbox it powers),
  `connectedById` (which user connected it). Drop `@@unique([userId, type])`;
  the connection is now per-inbox. Keep encrypted tokens + metadata. `userId`
  kept nullable as "connected by" provenance.
- `Conversation`: add `organizationId`, `inboxId`, `assigneeId` (→ Membership,
  nullable = unassigned), `state: ConversationState` (queue workflow). Keep
  `status` (ACTIVE/ARCHIVED/LOST — lifecycle for risk/analytics; orthogonal to
  `state`), `priority`, `category`. Re-point indexes from `userId` to
  `organizationId`.
- `Contact`, `RiskAlert`, `Reminder`, `CategoryRule`, `ConversationDraft`,
  `EmailDigest`, `ContactNote`: tenant scope `userId → organizationId`. Where a
  row also records authorship (draft, note, reminder), add/keep an `authorId`
  (userId) field separate from the tenant key.

### New enums

```
OrgRole           { OWNER, ADMIN, MEMBER, VIEWER }
MemberStatus      { ACTIVE, SUSPENDED }
InviteStatus      { PENDING, ACCEPTED, REVOKED, EXPIRED }
ConversationState { OPEN, SNOOZED, CLOSED }
BillingPlan       { FREE, TEAM, BUSINESS, ENTERPRISE }
```

### Design decisions on overlaps

- **`state` vs `status`:** `ConversationState` (OPEN/SNOOZED/CLOSED) is the
  shared-inbox queue workflow. Existing `ConversationStatus`
  (ACTIVE/ARCHIVED/LOST) stays as the higher-level lifecycle used by
  risk/analytics. They are orthogonal — a thread can be OPEN + ACTIVE.
- **`Rule` vs `CategoryRule`:** `CategoryRule` stays (learned email-classifier
  rules). New `Rule` is team routing/automation (assign / tag / set priority /
  close). Not merged, to avoid breaking the classifier.
- **Billing payment:** plan/seat model + feature gating + UI are built for real;
  the actual payment still flows through the external checkout URL
  (`externalCustomerId` makes it Stripe-ready). No fake payment processor.

## 4. Auth & RBAC

- Authentication stays Supabase. **Authorization** = membership + role, enforced
  server-side.
- New `src/lib/org.ts`:
  - `getOrgContext()` → `{ user, organization, membership, role }` for Server
    Components (resolves active org from the `velnox_org` cookie, validated
    against membership; falls back to the user's default membership).
  - `requireOrg(minRole?)` for Route Handlers → returns context or a 401/403
    `NextResponse`.
  - `can(role, action)` pure permission helper + a permission matrix.
- Active org stored in cookie `velnox_org`; switching validates membership.
- A logged-in user with **no** membership is redirected into onboarding.

### Permission matrix

| Action | OWNER | ADMIN | MEMBER | VIEWER |
|---|---|---|---|---|
| Read inbox / conversations / analytics | ✓ | ✓ | ✓ | ✓ |
| Reply / assign / note / tag / change state | ✓ | ✓ | ✓ | — |
| Manage inboxes (connect/disconnect) | ✓ | ✓ | — | — |
| Manage rules / templates / tags | ✓ | ✓ | — | — |
| Manage members + invites + roles | ✓ | ✓ | — | — |
| Manage billing / plan | ✓ | ✓ | — | — |
| Delete org / transfer ownership | ✓ | — | — | — |

(Admins cannot modify/remove an OWNER membership; only an owner can.)

## 5. Shared inbox & collaboration

- `Inbox` = a connected shared mailbox owned by the org; `Integration` (tokens)
  attaches to it. An org can connect several inboxes.
- Conversation belongs to `organizationId` + `inboxId`.
- Collaboration on a thread: **assignment** (`assigneeId`), **state**
  (OPEN/SNOOZED/CLOSED), **internal notes** (team-only), **tags**.
- Inbox queue filters: *assigned to me*, *unassigned*, *all*, *by inbox*, plus
  existing priority/status filters.
- All assignment / state / note actions write an `AuditLog` entry.

## 6. Rules · Templates · Audit · Billing · Analytics

- **Rules:** `conditions` (inbox, from, domain, subject/keyword, channel) →
  `actions` (assign member, add tag, set priority, set category, close). Applied
  in the inbound sync pipeline after classification, before analysis enqueues.
  Bounded + ordered; `isActive` toggle.
- **Templates:** org-scoped saved replies, inserted in the composer; `shared`
  flag controls team visibility.
- **AuditLog:** written on member invite/role-change/removal, inbox
  connect/disconnect, assignment, state change, rule/template/tag CRUD, billing
  change, org settings change. Viewer in Settings → Audit (admin+ only).
- **Billing:** `seats` = count of ACTIVE memberships; plan gates inbox count,
  rule count, analytics depth, audit retention. Pricing page → Team / Business /
  Enterprise. Settings → Billing shows plan + seats used + upgrade (external
  checkout).
- **Team analytics:** existing analytics re-scoped to org + per-member breakdown
  (volume, response time, assignments handled) and per-inbox load + SLA.

## 7. Background jobs — identity rework

Remove the single `GMAIL_USER_EMAIL` owner identity. Jobs carry `organizationId`
(and `inboxId` where relevant). `loadWorkspace(userId)` → `loadWorkspace(orgId)`.
Digest is built per org and sent to org owners/admins; proactive notifications
respect per-org notification settings (moved off `Integration.metadata` singletons
to an org-level setting). All read-model services re-scoped to org.

## 8. Navigation, settings & onboarding

- **Sidebar:** org-switcher at top; Inbox (with queue sub-filters); Dashboard
  (team activity); Intelligence (Clients / Insights / Risk / Analytics);
  Assistant; Settings. `Integrations` folds into **Settings → Inboxes**.
- **Settings tabs:** Organization · Members & roles · Inboxes · Tags · Rules ·
  Templates · Billing · Audit. Tab visibility follows the permission matrix.
- **Onboarding (multi-step):** create organization → connect first shared inbox
  (Gmail OAuth) → invite teammates with roles → optional first rule → done. A
  user without an org lands here.

## 9. Content rework

- **Landing:** B2B hero ("The shared inbox your team actually works in" / "AI
  inbox copilot for teams"), team benefits, use cases (support / sales / ops /
  founders), collaboration features, integrations, security/compliance, team
  social proof, CTA for demo + signup. Remove all solo "your inbox" language.
- **Pricing:** Team / Business / Enterprise (per-seat).
- **Marketing pages** (features, about, contact): corporate, team-first language.

## 10. Data migration (non-destructive)

A Prisma migration adds the new columns/tables, followed by an **idempotent
backfill** (`scripts/backfill-orgs.ts`):

1. For each `User` without a Membership: create an `Organization` (name from the
   user's name/email), create a Membership(role=OWNER, status=ACTIVE), create a
   `Subscription`(plan=FREE).
2. For each existing `Integration`: create an `Inbox` under that user's org from
   `Integration.email`, set `Integration.organizationId/inboxId/connectedById`.
3. Backfill `organizationId` (and `inboxId` for conversations) on all the user's
   `Conversation`, `Contact`, `RiskAlert`, `Reminder`, `CategoryRule`,
   `ConversationDraft`, `EmailDigest`, `ContactNote` rows.
4. Default `Conversation.state = OPEN` (CLOSED if `status` is ARCHIVED/LOST).

The script is safe to re-run; it skips users that already have a membership.
Because `/prisma/migrations` is gitignored, `schema.prisma` is the source of
truth and the migration is applied locally with `prisma migrate dev`.

## 11. Implementation batches

Each batch ends with `npm run build` (+ `npm run lint` and relevant
`npm run test:*`) green before moving on.

| # | Batch | Deliverable |
|---|---|---|
| 1 | Schema + backfill | new models/enums, re-scoped columns, idempotent backfill script |
| 2 | Auth/RBAC | `getOrgContext`/`requireOrg`/`can`, org cookie + switcher, onboarding gate |
| 3 | Re-scope services + API | `userId→orgId` across services & routes; jobs carry orgId; per-org digest/notify |
| 4 | Inbox collaboration | assignment, states, internal notes, tags, queue filters |
| 5 | Rules + Templates | rule engine in sync; templates in composer; management pages |
| 6 | Admin/Settings IA + Onboarding | settings tabs, members/invites, multi-step onboarding |
| 7 | Billing | plan/seat model, gating, pricing tiers, Settings→Billing |
| 8 | Team analytics + dashboard | per-member/per-inbox metrics |
| 9 | Content | B2B landing + marketing rewrite |
| 10 | Final verification | build/lint/tests/smoke; changelog of decisions |

## 12. Out of scope (future / enterprise)

SSO/SAML, SCIM provisioning, real payment-processor webhooks, custom roles beyond
the four levels, multi-channel ingestion (Telegram/WhatsApp remain placeholders),
per-inbox granular ACLs. The schema (Membership.role, Subscription, AuditLog) is
shaped so these slot in without another tenant migration.
