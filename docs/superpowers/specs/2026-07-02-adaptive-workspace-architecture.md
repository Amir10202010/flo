# Adaptive Workspace Architecture — Velnox as an AI-generated, industry-native CRM

**Date:** 2026-07-02 · **Branch:** `feat/adaptive-workspace` (based on `redesign/premium-saas`)
**Status:** Approved direction; Phase 1 implementation plan lives in
`docs/superpowers/plans/2026-07-02-adaptive-workspace-phase1.md`.

## 1. Vision

Every Velnox workspace carries an **Industry Profile**. Instead of one generic CRM,
the workspace's terminology, sidebar, CRM objects, pipelines, dashboards, KPIs and
AI copilot are **generated from metadata** — seeded by industry templates and
customized by AI from the customer's own description of their business. A dental
clinic sees Patients / Appointments / Treatment Plans; a recruiting agency sees
Candidates / Vacancies / Placements — same application code, different workspace
schema. No industry logic is hardcoded in application code.

## 2. What we build on (current architecture)

The codebase already has the right substrate; the adaptive layer plugs into it
rather than replacing it:

| Capability | Where | Why it matters here |
|---|---|---|
| Org-first tenancy | `Organization` + `Membership`, `src/lib/org.ts` (`getOrgContext`/`requireOrg`/`requireOrgPage`, ~176 call sites) | The workspace schema hangs off `Organization`; every read/write is already org-scoped |
| RBAC | `src/lib/permissions.ts` (pure, unit-tested) | New actions (`workspace:manage`, `records:*`) slot into `MIN_ROLE` |
| AI provider layer | `src/services/ai/` — `AiTextProvider.generateJson<T>()` with response schema, retryable-error contract, deterministic local fallback | The workspace generator is "just another structured-JSON entry point"; free-tier 429s and no-key mode degrade exactly like analysis/drafts do |
| Automation primitive | `Rule` model (JSON `conditions`/`actions`) + `rule.engine` | Industry automation templates target this engine in Phase 3 |
| Job queue | `Job` table + runner | Not needed for interactive generation (seconds), available for backfills |
| Small app surface | Redesign collapsed the shell to `/dashboard`, `/inbox`, `/clients`, `/settings`, `/onboarding` | Fewer hardcoded screens to migrate |
| Test harness | `tsx scripts/*.check.ts` pure-logic checks | Blueprint validation/coercion/templates get the same treatment |

## 3. Hardcoded inventory (what must become metadata)

| Surface | File(s) | What is fixed today | Adaptive strategy |
|---|---|---|---|
| Sidebar nav | `src/components/layout/Sidebar.tsx` `SECTIONS`/`SYSTEM` consts | Items, order, icons, labels ("Clients") | Generated from workspace schema; icon names resolved via a bounded registry |
| Dashboard KPIs + widgets | `src/app/(dashboard)/dashboard/page.tsx`, `dashboard.service.ts` | Three fixed KPI cards, fixed widget arrangement, fixed copy ("Clients at risk") | Industry KPI/object widgets rendered from schema `dashboard` config through a widget registry; copy through terminology |
| CRM objects | Prisma: only `Conversation`/`Contact` | No user-definable objects, fields, stages | `ObjectDefinition`/`FieldDefinition` metadata + JSONB `CrmRecord` rows |
| Pipelines/stages | none (priority enum only) | `PriorityLevel`, `EmailCategory` enums are the only taxonomy | Per-object `pipeline` (stage list) in object metadata; records store `stageKey` |
| Terminology | scattered strings: "Clients", "clients at risk", digest/alert/assistant copy | English CRM-generic | Org `terminology` map (`contact → Patient`, …) resolved by a shared helper server- and client-side |
| Onboarding | `OnboardingWizard.tsx` (name → invites) | No business profiling | AI interview step → blueprint generation → preview → apply |
| AI assistant persona | `assistant.service.ts` one generic prompt | Same assistant for everyone | `copilot` persona (title/style/focus) from the profile injected into the briefing prompt |
| Command palette | `CommandPalette.tsx` page/action list | Static destinations | Reads the same nav read-model (Phase 2) |
| Alert/digest copy | `alert.engine.ts`, `digest.service.ts` | "client" phrasing | Terminology-aware copy (Phase 2) |

## 4. Target architecture

### 4.1 Data model (Prisma, all org-scoped, additive)

```
Organization 1—1 WorkspaceProfile     // industry identity + workspace-level config
Organization 1—N ObjectDefinition     // "Patient", "Appointment", …
ObjectDefinition 1—N FieldDefinition  // typed fields, ordered
ObjectDefinition 1—N CrmRecord        // JSONB data rows
```

- **`WorkspaceProfile`** — `industryKey`, `industryLabel`, `subIndustry?`,
  `businessModel?`, `companySize?`, `description` (the user's own words),
  `source` (`TEMPLATE | AI | MANUAL`), `provider` (`gemini | local`) for module
  honesty, plus JSON configs: `terminology`, `navigation`, `dashboard`
  (widget instances), `copilot` (persona), `onboardingAnswers`.
- **`ObjectDefinition`** — `key` (stable slug, e.g. `patient`), `singular`,
  `plural`, `icon` (registry name), `color?`, `description?`, `order`,
  `pipeline Json?` (ordered `{key,label,color?,terminal?}` stages — one board
  per object, stage renames keep keys stable), `isArchived` (regeneration never
  deletes), unique `(organizationId, key)`.
- **`FieldDefinition`** — `key`, `label`, `type` (`FieldType` enum: TEXT,
  LONG_TEXT, NUMBER, MONEY, DATE, DATETIME, BOOLEAN, SELECT, MULTI_SELECT,
  EMAIL, PHONE, URL), `config Json` (select options, currency…), `required`,
  `showInList`, `order`, unique `(objectId, key)`.
- **`CrmRecord`** — `organizationId`, `objectId`, `title`, `stageKey?`,
  `data Json` (validated against FieldDefinitions in the service layer),
  `ownerMembershipId?`, `contactId?` (bridge to the native Contact),
  timestamps; indexed `(organizationId, objectId, updatedAt)` and
  `(objectId, stageKey)`.

**Storage decision — one JSONB record table, no runtime DDL, no EAV.**
Per-tenant DDL is operationally dangerous (migrations, pooler, backup story)
and EAV destroys readability and query plans. A single `CrmRecord` table with
app-layer validation matches this codebase's pragmatism (cf. in-process cosine
over pgvector) and keeps Prisma the only data path. Promoted columns (`title`,
`stageKey`, `contactId`, owner) cover the hot query patterns; everything else
lives in `data`.

**System objects stay native.** Conversations/contacts keep their Prisma models
and sync/AI machinery — the schema layer *relabels and arranges* them
(nav entries of kind `system`, terminology overrides like Clients → Patients)
instead of porting Gmail infrastructure into JSONB. Custom industry objects are
`CrmRecord`s. Phase 2 links them (`conversation ↔ record`).

### 4.2 The Blueprint contract (unit of generation)

A **`WorkspaceBlueprint`** is a Zod-validated JSON document: profile
(industry identity), terminology, objects (fields + pipeline), navigation hints,
dashboard widget instances, copilot persona, and suggested automations
(descriptive in Phase 1; wired to the Rule engine in Phase 3). It is the single
artifact that templates export, the AI emits, the preview renders, and the
materializer applies. `src/lib/workspace/blueprint.ts` owns the Zod schema and
hard bounds (≤ 12 objects, ≤ 30 fields/object, ≤ 12 stages, icon ∈ registry,
keys slug-shaped and unique) so nothing unvalidated ever reaches the database.

### 4.3 Registries (code) — schema references keys, never components

| Registry | File | Maps |
|---|---|---|
| Field types | `src/lib/workspace/field-types.ts` | `FieldType` → validate/coerce/format (+ input kind for forms) |
| Icons | `src/lib/workspace/icons.ts` | bounded name → lucide component (AI/templates pick from the names) |
| Industry templates | `src/lib/workspace/templates/` | `templateKey` → `WorkspaceBlueprint` (dental-clinic, marketing-agency, law-firm, recruiting-agency, real-estate, generic; adding an industry = adding one file) |
| Terminology | `src/lib/workspace/terminology.ts` | term key → `{singular, plural}` with CRM-generic defaults |
| Dashboard widgets | `src/components/workspace/widgets/` | widget `type` → React component (Phase 1: `object-stat`, `pipeline-overview`; Phase 2: absorb the existing inbox widgets) |

### 4.4 Generation pipeline (propose → confirm → execute, like the assistant)

```
onboarding answers ──► blueprint.generator ──► WorkspaceBlueprint ──► preview UI ──► materializer
   (4 questions)        template selection +      (Zod-validated,       (user sees      (idempotent
                        AI customization via       bounded, provider-    their CRM       upserts, org-
                        AiTextProvider             tagged)               before apply)   scoped, additive)
```

- The model **selects a base template and emits customizations** (industry
  label, terminology, object renames, extra fields, extra objects, KPI picks,
  persona) rather than free-form schema. Deterministic code resolves
  template + customizations into the full blueprint. This keeps a quality
  floor on the free tier and keeps the LLM outside the trust boundary —
  the same design stance as `assistant.actions.ts`.
- **Local fallback**: no key / non-retryable error → keyword match (en+ru) to
  the nearest template, tagged `provider:'local'` and labelled in the UI
  (module honesty rule).
- **Materialization is never destructive**: objects missing from a re-applied
  blueprint are archived, not deleted; records are never touched; field
  removals only hide. Sequential Prisma writes (small pool — no `Promise.all`).

### 4.5 Read-model + adaptive UI

`getWorkspaceSchema(orgId)` returns one serializable read-model
(profile, terminology, nav entries, objects+fields+pipelines, dashboard
widgets). It powers:

- **Sidebar** — stays a client component in the DB-free layout, so it
  self-fetches `GET /api/workspace/schema` (same pattern as `OrgSwitcher`) and
  renders the current static nav as fallback until the schema arrives (also the
  correct UI for orgs with no profile yet).
- **Dynamic object pages** — `/o/[objectKey]` (table view from `showInList`
  fields; board view when the object has a pipeline) and record create/edit
  with a dynamic form from FieldDefinitions. Server components via
  `requireOrgPage` + services, per house style.
- **Dashboard** — an industry strip of schema-declared widgets (record counts,
  stage funnels) above the existing live inbox widgets; greeting/copy pull from
  terminology.
- **Copilot** — assistant briefing gets the persona block ("You are the
  workspace copilot for a dental clinic; the team calls contacts patients…").

### 4.6 Key decisions & rejected alternatives

1. **JSONB records over per-tenant DDL / EAV** — see 4.1.
2. **Template + AI-customization over free-form generation** — bounded output,
   free-tier reliable, template quality floor; free-form regeneration can be
   layered on later behind the same Zod gate.
3. **System objects stay native** — don't migrate Gmail sync into metadata;
   relabel and link instead. Incremental and honest.
4. **Nav self-fetch, layout stays DB-free** — preserves the documented
   fast-navigation constraint (`getCurrentUser` header fast-path).
5. **Stages as JSON on the object, records store `stageKey`** — atomic
   generation, cheap reorder/rename, no extra table until analytics need it.
6. **Generation is interactive, not queued** — seconds-long, rate-limited,
   `fallbackOnRetryable` like `/draft`; the job queue stays for background work.

### 4.7 Invariants

- Nothing AI-emitted reaches the DB without Zod validation + bounds coercion.
- Regeneration/apply never deletes user data (archive-only).
- The LLM proposes; deterministic, org-scoped code executes.
- Offline/local results are always labelled (`provider` tag) — module honesty.
- No industry string ever appears in application code — only in
  `src/lib/workspace/templates/*` and org metadata.
- Sequential Prisma queries in request paths (pool limit).

## 5. Phased roadmap

- **Phase 1 (this branch):** metadata models · blueprint contract + registries ·
  6 industry templates · AI generator + local fallback · materializer +
  read-model · records CRUD + APIs · adaptive sidebar · `/o/[objectKey]` pages ·
  onboarding interview + preview/apply · dashboard industry strip · copilot
  persona injection · checks (`npm run test:workspace`).
- **Phase 2:** widget registry absorbs the existing dashboard widgets; record ↔
  conversation linking (+ inbox context panel); relation fields with a
  `RecordLink` table and reverse lookups; saved views; CSV import; palette +
  alert/digest terminology.
- **Phase 3:** automation templates wired to the Rule engine (record triggers:
  stage change, date due); per-industry assistant actions on records
  (create/move/remind) through the existing propose→confirm→execute layer;
  industry artifact generation (recall emails, proposals, outreach) via
  templated prompts in a prompt registry.
- **Phase 4:** continuous learning — usage signals (manual field edits, stage
  renames) feed AI suggestions ("You seem to track Insurance Policy Number —
  add it everywhere?"); in-app schema editor; template sharing.

## 6. Risks

- **Schema sprawl / garbage generation** → bounds + template floor + preview
  before apply + archive-only.
- **JSONB query limits at scale** → promoted columns now; GIN index or
  read-model tables when list filtering demands it (measured, later).
- **Free-tier quota during onboarding** → local template fallback keeps the
  flow working with zero AI; the profile records `provider` so the UI can offer
  "regenerate with AI" later.
- **Merge risk with `redesign/premium-saas`** → this branch is based on it;
  land the redesign first, then this.
