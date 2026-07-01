# Adaptive Workspace — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Metadata-driven workspaces: an org's industry profile, CRM objects, fields, pipelines, sidebar, dashboard widgets and copilot persona are generated (template + AI) at onboarding and rendered from a schema read-model — no industry logic in application code.

**Architecture:** Normalized object/field metadata + one JSONB record table; a Zod-validated `WorkspaceBlueprint` as the single generation artifact (templates export it, AI customizes it, the materializer applies it idempotently and non-destructively); UI reads one `getWorkspaceSchema` read-model. See `docs/superpowers/specs/2026-07-02-adaptive-workspace-architecture.md`.

**Tech Stack:** Next.js 16 App Router, Prisma 5 (additive migration), Zod 4 (already a dep), existing `src/services/ai` provider layer, `tsx scripts/*.check.ts` test harness.

## Global Constraints

- Sequential Prisma queries in request paths (small pooled connection limit — never `Promise.all` DB calls).
- Nothing AI-emitted reaches the DB without Zod validation; regeneration is archive-only (never deletes objects/fields, never touches records).
- Offline/local generation results carry `provider:'local'` and are labelled in the UI (module honesty).
- No industry strings in application code — only in `src/lib/workspace/templates/*` and org metadata.
- Follow redesign UI conventions (Inter, `.page-title`, `.btn-primary`/`.btn-ghost`, radius tokens, no decorative gradients).
- Migrations are gitignored: edit `schema.prisma`, run `npx prisma migrate dev`, commit only the schema.
- Every task ends with its checks green and a commit.

---

### Task 1: Prisma metadata models

**Files:**
- Modify: `prisma/schema.prisma` (add models + enums; add relations on `Organization`, `Contact`)

**Interfaces (produces):** Prisma models `WorkspaceProfile`, `ObjectDefinition`, `FieldDefinition`, `CrmRecord`; enums `FieldType`, `WorkspaceSource`.

- [ ] **Step 1: Add models** (relations `workspaceProfile WorkspaceProfile?`, `objectDefinitions ObjectDefinition[]`, `crmRecords CrmRecord[]` on Organization; `crmRecords CrmRecord[]` on Contact):

```prisma
/// Industry identity + workspace-level adaptive config for one organization.
/// `terminology`/`dashboard`/`copilot` are blueprint-shaped JSON (validated by
/// src/lib/workspace/blueprint.ts before every write). `provider` records
/// whether AI or the offline template produced the profile (module honesty).
model WorkspaceProfile {
  id                String          @id @default(cuid())
  organizationId    String          @unique
  industryKey       String          @default("generic")
  industryLabel     String          @default("General business")
  subIndustry       String?
  businessModel     String?
  companySize       String?
  description       String?
  source            WorkspaceSource @default(TEMPLATE)
  provider          String?
  terminology       Json            @default("{}")
  dashboard         Json            @default("[]")
  copilot           Json            @default("{}")
  automationIdeas   Json            @default("[]")
  onboardingAnswers Json            @default("{}")
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  organization      Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

/// A workspace-defined CRM object ("Patient", "Case", "Campaign"). `key` is a
/// stable slug records reference; `pipeline` is an ordered stage list
/// [{key,label,color?,terminal?}] — renames keep keys stable. Regeneration
/// archives (never deletes) so records are never orphaned.
model ObjectDefinition {
  id             String            @id @default(cuid())
  organizationId String
  key            String
  singular       String
  plural         String
  icon           String            @default("box")
  color          String?
  description    String?
  order          Int               @default(0)
  pipeline       Json?
  isArchived     Boolean           @default(false)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  organization   Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  fields         FieldDefinition[]
  records        CrmRecord[]

  @@unique([organizationId, key])
  @@index([organizationId, isArchived, order])
}

/// A typed field on an object. `config` holds type specifics (select options,
/// currency). Validation/coercion/formatting live in the field-type registry
/// (src/lib/workspace/field-types.ts) — the DB stores declarations only.
model FieldDefinition {
  id         String           @id @default(cuid())
  objectId   String
  key        String
  label      String
  type       FieldType        @default(TEXT)
  config     Json             @default("{}")
  required   Boolean          @default(false)
  showInList Boolean          @default(true)
  order      Int              @default(0)
  isArchived Boolean          @default(false)
  object     ObjectDefinition @relation(fields: [objectId], references: [id], onDelete: Cascade)

  @@unique([objectId, key])
  @@index([objectId, order])
}

/// One row of a workspace-defined object. `data` is validated against the
/// object's FieldDefinitions in the service layer; `title`/`stageKey`/`contactId`
/// are promoted columns for the hot list/board/link query paths.
model CrmRecord {
  id                String           @id @default(cuid())
  organizationId    String
  objectId          String
  title             String
  stageKey          String?
  data              Json             @default("{}")
  ownerMembershipId String?
  contactId         String?
  createdById       String?
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  organization      Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  object            ObjectDefinition @relation(fields: [objectId], references: [id], onDelete: Cascade)
  contact           Contact?         @relation(fields: [contactId], references: [id])

  @@index([organizationId, objectId, updatedAt(sort: Desc)])
  @@index([objectId, stageKey])
}

enum WorkspaceSource {
  TEMPLATE
  AI
  MANUAL
}

enum FieldType {
  TEXT
  LONG_TEXT
  NUMBER
  MONEY
  DATE
  DATETIME
  BOOLEAN
  SELECT
  MULTI_SELECT
  EMAIL
  PHONE
  URL
}
```

- [ ] **Step 2:** `npx prisma migrate dev --name add_adaptive_workspace` → expect "migration applied"; `npx prisma generate` (or rely on migrate's generate). `npx tsc --noEmit` unaffected.
- [ ] **Step 3:** Commit `feat(workspace): prisma metadata models for adaptive workspaces`.

### Task 2: Blueprint core — Zod contract, field types, icons, terminology (+ checks)

**Files:**
- Create: `src/lib/workspace/blueprint.ts`, `src/lib/workspace/field-types.ts`, `src/lib/workspace/icons.ts`, `src/lib/workspace/terminology.ts`
- Create: `scripts/workspace.check.ts`; Modify: `package.json` (`"test:workspace": "tsx scripts/workspace.check.ts"`)

**Interfaces (produces):**
- `blueprint.ts`: `WorkspaceBlueprint`, `BlueprintObject`, `BlueprintField`, `BlueprintStage`, `BlueprintWidget`, `BlueprintCopilot`, `TerminologyMap`; `safeParseBlueprint(raw: unknown): { ok: true; blueprint: WorkspaceBlueprint } | { ok: false; error: string }`; `RESERVED_OBJECT_KEYS`; bounds consts (`MAX_OBJECTS = 12`, `MAX_FIELDS = 30`, `MAX_STAGES = 12`, `MAX_WIDGETS = 8`).
- `field-types.ts`: `FieldTypeKey` (string union mirroring the Prisma enum), `FIELD_TYPES: Record<FieldTypeKey, FieldTypeDef>` with `{ input, validate(value, field), coerce(value, field), format(value, field) }`; `validateRecordData(fields: FieldSpec[], data: unknown, opts?: { partial?: boolean }): { ok: true; data: Record<string, unknown> } | { ok: false; errors: string[] }` (strips unknown keys, enforces `required` unless partial).
- `icons.ts`: `WORKSPACE_ICON_NAMES: string[]` (~28 curated lucide names incl. users, user-round, calendar, calendar-check, stethoscope, heart-pulse, briefcase, scale, gavel, building-2, home, folder-open, file-text, clipboard-list, target, megaphone, banknote, credit-card, receipt, truck, wrench, graduation-cap, dumbbell, car, package, handshake, phone, kanban, box), `iconFor(name?): LucideIcon` (fallback `Box`), `isWorkspaceIcon(name): boolean`.
- `terminology.ts`: `DEFAULT_TERMS` (`contact` → Client/Clients, `conversation` → Conversation/Conversations), `resolveTerm(map, key): { singular: string; plural: string }`.

Blueprint shape (Zod, keys `^[a-z][a-z0-9_]{1,31}$`, labels trimmed non-empty, icons must satisfy `isWorkspaceIcon`, object keys unique and ∉ `RESERVED_OBJECT_KEYS` (`dashboard,inbox,clients,contacts,conversations,settings,records,workspace,api,admin,org,o`); widgets/dashboard entries referencing unknown object keys are dropped in a post-parse normalize; arrays clamped to bounds):

```ts
interface WorkspaceBlueprint {
  profile: { industryKey: string; industryLabel: string; subIndustry?: string; businessModel?: string; companySize?: string }
  terminology: Record<string, { singular: string; plural: string }>
  objects: {
    key: string; singular: string; plural: string; icon: string; color?: string; description?: string
    fields: { key: string; label: string; type: FieldTypeKey; required?: boolean; showInList?: boolean; options?: string[]; currency?: string }[]
    pipeline?: { key: string; label: string; color?: string; terminal?: boolean }[]
  }[]
  dashboard: ({ type: 'object-count'; objectKey: string; label?: string } | { type: 'stage-breakdown'; objectKey: string; label?: string })[]
  copilot: { title: string; style?: string; focus?: string[] }
  automationIdeas: string[]
}
```

- [ ] **Step 1:** Write failing checks in `scripts/workspace.check.ts` (style of `permissions.check.ts`: `check(name, fn)` + `assert/strict`): valid minimal blueprint parses; duplicate object keys rejected; reserved key rejected; unknown icon rejected; >12 objects rejected; widget for unknown object dropped by normalize; `validateRecordData` — required TEXT missing → error; NUMBER coerces `"42"` → 42; SELECT outside options → error; MULTI_SELECT filters to options; DATE accepts `2026-07-02`, rejects `tomorrow`; MONEY formats with currency; unknown data keys stripped; `resolveTerm` falls back to defaults.
- [ ] **Step 2:** Run `npm run test:workspace` → FAIL (modules missing).
- [ ] **Step 3:** Implement the four modules (pure, no I/O; `icons.ts` may import lucide-react only).
- [ ] **Step 4:** `npm run test:workspace` → PASS.
- [ ] **Step 5:** Commit `feat(workspace): blueprint contract + field-type/icon/terminology registries`.

### Task 3: Industry templates (6) + integrity checks

**Files:**
- Create: `src/lib/workspace/templates/{dental-clinic,marketing-agency,law-firm,recruiting-agency,real-estate,generic}.ts`, `src/lib/workspace/templates/index.ts`
- Modify: `scripts/workspace.check.ts` (template integrity section)

**Interfaces (produces):** `IndustryTemplate = { key: TemplateKey; label: string; keywords: string[] /* en+ru, lowercase */; blueprint: WorkspaceBlueprint }`; `INDUSTRY_TEMPLATES: Record<TemplateKey, IndustryTemplate>`; `TEMPLATE_KEYS: TemplateKey[]`; `pickTemplateByKeywords(text: string): TemplateKey` (scores keyword hits; `generic` fallback).

Content guide (each 3–5 objects, 5–10 fields each, ≥1 object with a pipeline, 3–5 dashboard widgets, terminology overriding `contact`/`conversation`, a copilot persona, 4–6 automation ideas):
- dental-clinic: patient, appointment (pipeline Requested→Confirmed→Completed→No-show/Cancelled), treatment_plan (Proposed→Accepted→In progress→Completed→Declined); terminology contact→Patient.
- marketing-agency: project (pipeline), campaign (pipeline), invoice (Draft→Sent→Paid→Overdue), deliverable; contact→Client.
- law-firm: case (Intake→Investigation→Filed→Hearing→Settled/Closed), hearing, document_matter?, deadline, contract (Draft→Review→Negotiation→Signed); contact→Client.
- recruiting-agency: candidate (Sourced→Screening→Interviewing→Offer→Placed/Rejected), vacancy (Open→Shortlisting→Interviews→Offer→Filled/Closed), placement; contact→Employer? (contact stays Client=employer; candidate is an object).
- real-estate: property (Listed→Viewings→Offer→Under contract→Sold/Withdrawn), viewing, offer_deal; contact→Client.
- generic: deal (Lead→Qualified→Proposal→Won/Lost), task_item; neutral terminology.

- [ ] **Step 1:** Add failing integrity checks: every template's blueprint passes `safeParseBlueprint`; template keys unique; every dashboard widget references an object in the same blueprint; every icon known; `pickTemplateByKeywords('we are a dental clinic, стоматология')` → `dental-clinic`, gibberish → `generic`.
- [ ] **Step 2:** `npm run test:workspace` → FAIL. Implement templates + registry. → PASS.
- [ ] **Step 3:** Commit `feat(workspace): six industry templates + keyword picker`.

### Task 4: AI workspace generator

**Files:**
- Create: `src/services/workspace/blueprint.generator.ts`
- Modify: `scripts/workspace.check.ts` (customization section)

**Interfaces:**
- Consumes: `getTextProvider()`, `AiProviderError`, `AiJsonSchema` from `@/services/ai`(+`/types`); templates registry.
- Produces: `OnboardingAnswers = { description: string; services?: string; channels?: string; salesProcess?: string; teamSize?: string }`; `GeneratedBlueprint = { blueprint: WorkspaceBlueprint; provider: 'gemini' | 'local'; templateKey: TemplateKey }`; `generateWorkspaceBlueprint(answers, opts?: { templateKey?: TemplateKey }): Promise<GeneratedBlueprint>`; pure `applyCustomization(base: WorkspaceBlueprint, c: BlueprintCustomization): WorkspaceBlueprint` (exported for tests).

Flow: explicit `opts.templateKey` → template as-is (`provider:'local'`, source picker UI). Else provider present → prompt (template list + answers, answer-language-aware) with a **flat customization schema** (`templateKey` enum; `industryLabel`; `subIndustry?`; `businessModel?`; `companySize?`; `contactSingular/contactPlural?`; `conversationSingular/conversationPlural?`; `objectRenames[{key,singular,plural}]`; `extraFields[{objectKey,key,label,type,options?}]ᵐᵃˣ¹⁰`; `extraObjects[BlueprintObject-lite]ᵐᵃˣ³`; `removeObjectKeys[]`; `copilotTitle/copilotStyle/copilotFocus[]`; `automationIdeas[]ᵐᵃˣ⁶`) → `applyCustomization` → `safeParseBlueprint` (invalid extras dropped, never fails the flow) → `provider:'gemini'`. No provider / non-retryable error → `pickTemplateByKeywords` fallback; retryable errors also fall back (interactive path, like `summarizeThread`).

- [ ] **Step 1:** Failing checks: `applyCustomization` renames an object + adds a valid extra field + drops an extra field with bad type + removes an object + never exceeds bounds; result always re-parses. Local path: `generateWorkspaceBlueprint({description:'стоматологическая клиника'})` with `AI_PROVIDER=local` → dental template, `provider:'local'`.
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat(workspace): AI blueprint generator with template floor + local fallback`.

### Task 5: Materializer + schema read-model

**Files:**
- Create: `src/services/workspace/workspace.service.ts`

**Interfaces:**
- `applyBlueprint(organizationId, blueprint, meta: { source: 'TEMPLATE'|'AI'|'MANUAL'; provider?: 'gemini'|'local'; answers?: OnboardingAnswers; actorId?: string }): Promise<void>` — sequential upserts: profile (JSON configs), objects by `(organizationId,key)` (update labels/icon/pipeline/order, `isArchived:false`), fields by `(objectId,key)`; archive objects/fields absent from the blueprint; `recordAudit('workspace.applied')`. Never deletes; never touches records.
- `getWorkspaceSchema(organizationId): Promise<WorkspaceSchemaModel | null>` (null → no profile yet) where `WorkspaceSchemaModel = { profile: { industryKey; industryLabel; subIndustry?; source; provider? }, terminology, copilot, nav: { key; label; icon; href }[] /* object entries only, ordered */, objects: { id; key; singular; plural; icon; color?; description?; pipeline: BlueprintStage[] | null; fields: FieldSpec[] }[], dashboard: BlueprintWidget[], automationIdeas: string[] }` — plain serializable; JSON configs re-validated on read (corrupt → defaults). Wrap in React `cache()`.
- `getObjectByKey(organizationId, objectKey)` — active object + active ordered fields, or null.

- [ ] Implement → `npx tsc --noEmit` clean → Commit `feat(workspace): blueprint materializer + workspace schema read-model`.

### Task 6: Record service + APIs + permissions

**Files:**
- Create: `src/services/workspace/record.service.ts`; routes `src/app/api/workspace/{schema,generate,apply,templates}/route.ts`, `src/app/api/objects/[objectKey]/records/route.ts`, `src/app/api/records/[id]/route.ts`
- Modify: `src/lib/permissions.ts` (+`workspace:manage` ADMIN, `records:read` VIEWER, `records:write` MEMBER), `scripts/permissions.check.ts`, `src/lib/ratelimit.ts` (+`workspaceGenerate: { limit: 10, windowMs: 60_000 }`, `records: { limit: 120, windowMs: 60_000 }`)

**Interfaces:**
- `record.service.ts`: `listRecords(organizationId, objectKey, opts?: { q?: string; stageKey?: string; limit?: number })` → `{ object, records }`; `createRecord(organizationId, objectKey, input: { title: string; stageKey?: string; data?: unknown }, actor: { membershipId: string })`; `updateRecord(organizationId, recordId, patch: { title?; stageKey?; data? })` (partial data validation, merges); `deleteRecord(organizationId, recordId)`; `recordStageCounts(organizationId)` → one `groupBy(['objectId','stageKey'])` for dashboard widgets. All verify org ownership; stageKey must exist in the object's pipeline.
- Routes: GET schema (VIEWER) → `{ schema }`; POST generate (ADMIN, rate-limited) body `{ answers?, templateKey? }` → `{ blueprint, provider, templateKey }` (NOT applied); POST apply (requireCan `workspace:manage`) body `{ blueprint, provider?, source?, answers? }` — **server-side re-parse** via `safeParseBlueprint`; GET templates (VIEWER) → `{ templates: { key; label; objectPlurals: string[] }[] }`; records CRUD (read VIEWER / write MEMBER via `requireCan('records:write')`, rate-limited `records`).

- [ ] Implement service + routes + permissions rows + check updates → `npm run test:permissions` and `test:workspace` PASS, `npx tsc --noEmit` clean → Commit `feat(workspace): record service, workspace + record APIs, RBAC actions`.

### Task 7: Adaptive sidebar

**Files:**
- Create: `src/lib/workspace/use-workspace-schema.ts` (client hook: module-level cache, fetch `/api/workspace/schema`, refetch on `velnox:workspace-updated` + `velnox:org-switched` window events)
- Modify: `src/components/layout/Sidebar.tsx` (object nav entries from schema between Inbox and Contacts; label for `/clients` = `resolveTerm(terminology,'contact').plural`; icons via `iconFor`; static defaults until schema loads), `src/components/org/OrgSwitcher.tsx` (dispatch `velnox:org-switched` after successful switch)

- [ ] Implement; manual check via `npm run dev` happens in Task 11's QA pass. `npx tsc --noEmit` clean → Commit `feat(workspace): schema-driven sidebar navigation`.

### Task 8: Dynamic object pages

**Files:**
- Create: `src/app/(dashboard)/o/[objectKey]/page.tsx` (server: `requireOrgPage` + `getObjectByKey` + `listRecords`; unknown key → `notFound()`), `src/app/(dashboard)/o/[objectKey]/loading.tsx`, `src/components/workspace/ObjectPage.tsx` (client: table view — title + `showInList` fields ≤5 + stage + updated; board view by pipeline stages with "move to stage" select; search box; New/Edit/Delete), `src/components/workspace/RecordModal.tsx` (dynamic form from `FieldSpec[]` via field-type `input` kinds), `src/components/workspace/DynamicField.tsx`

- [ ] Implement (redesign conventions; format values via field-type registry `format`) → `npx tsc --noEmit` → Commit `feat(workspace): dynamic object pages (table/board + record forms)`.

### Task 9: Onboarding AI interview + preview/apply

**Files:**
- Modify: `src/components/org/OnboardingWizard.tsx` — steps `create → business → team`. Business step: description textarea (+ optional services/channels/sales inputs), Generate (POST generate) → preview card (industry label, provider badge "Offline template" when local, object chips w/ icons, KPI/widget labels, copilot title) → Apply (POST apply) → team step; "Choose a template instead" (GET templates → select → generate w/ `templateKey`); "Skip for now" applies nothing.

- [ ] Implement → Commit `feat(workspace): onboarding business interview + workspace preview/apply`.

### Task 10: Dashboard industry strip + assistant persona

**Files:**
- Create: `src/components/workspace/IndustryPulse.tsx` (server component: widgets from schema + `recordStageCounts`, `object-count` and `stage-breakdown` renderers, links to `/o/[key]`)
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (render IndustryPulse inside DashboardBody; terminology for the "Clients at risk" StatCard copy), `src/services/assistant.service.ts` (persona block from profile copilot + terminology into the briefing prompt)

- [ ] Implement → Commit `feat(workspace): industry dashboard strip + copilot persona injection`.

### Task 11: Verification sweep

- [ ] `npm run lint` clean, `npx tsc --noEmit` clean, `npm run build` succeeds, all `test:*` scripts pass.
- [ ] Dev-server QA: onboarding generate/apply (gemini + `AI_PROVIDER=local`), sidebar adapts, records CRUD, board moves, dashboard strip, org switch refetches nav.
- [ ] Fix fallout → Commit `chore(workspace): verification fixes`.

## Self-review notes

- Spec coverage: terminology ✓ (Task 2/7/10) · dynamic sidebar ✓ (7) · dynamic data model ✓ (1/6) · AI generator ✓ (4) · industry dashboards ✓ (10) · copilot ✓ (10) · onboarding interview ✓ (9) · templates ✓ (3). Deferred per architecture doc §5: automations wiring, relation fields, continuous learning, palette/digest terminology, full widget registry.
- Type consistency: `FieldSpec` = the serialized FieldDefinition shape exported from `blueprint.ts` (single source; service + UI import it).
- No placeholders: template content is specified per-template above; all other code is fully specified by interface + existing patterns (`ok/err`, `requireOrg`, self-fetch).
