# Knowledge Graph (People / Companies / Topics)

**Date:** 2026-07-13
**Status:** Approved — implementing
**Branch:** TBD (create a feature branch before implementation)

## 1. Goal & positioning

Add technical depth for an investor pitch/demo happening in the next few days.
Mentor feedback: the project needs a **knowledge graph** (Superhuman-style) and
Attio-style relationship intelligence across communication data. Full scope
(graph + Google Meet/Zoom ingestion) is too large for the timeline — this spec
covers **the graph only**, built from real, already-connected Gmail data.
Meeting-source ingestion is explicitly deferred (see §6).

Demo priority (per stakeholder input): the graph itself is the star. It must
run on the user's real Gmail data — no seeded/mock dataset — because the pitch
context still needs it to keep working correctly afterward.

## 2. Current state

- `Contact` (person entities), `Conversation`, and an adaptive-CRM layer
  (`ObjectDefinition` / `CrmRecord` / `RecordConversationLink`, from the
  2026-07-02 adaptive-workspace work) already exist and form a partial graph —
  but there are no edges *between* entities (person↔company, person↔topic),
  and no graph visualization anywhere in the UI.
- `src/services/jobs/handlers.ts` already chains `GMAIL_SYNC` →
  `ANALYZE_CONVERSATION` → `EMBED_CONVERSATION` (+ conditionally
  `GENERATE_DRAFT`) per changed conversation. This is the pattern the new
  extraction step plugs into.
- `src/services/ai/` provides `AiTextProvider`/`AiEmbeddingProvider` with a
  Gemini implementation (free tier) and a local heuristic fallback — reused
  as-is, no new AI infra.
- `src/components/charts/` — existing charts are dependency-free hand-rolled
  SVG (`path.ts` math + framer-motion). This spec is the first deliberate
  exception (see §5).

## 3. Data model

Two new models. `Person` nodes are **existing `Contact` rows** — not
duplicated.

```prisma
enum GraphEntityType {
  COMPANY
  TOPIC
}

model GraphEntity {
  id             String          @id @default(cuid())
  userId         String
  organizationId String?
  type           GraphEntityType
  name           String
  /// Dedupe key: lowercased email domain for COMPANY, lowercased normalized
  /// phrase for TOPIC.
  canonicalKey   String
  weight         Int             @default(1)
  createdAt      DateTime        @default(now())
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type, canonicalKey])
  @@index([organizationId])
}

enum GraphEdgeKind {
  WORKS_AT   // contact -> COMPANY entity
  DISCUSSED  // contact|COMPANY entity -> TOPIC entity
}

model GraphEdge {
  id                  String        @id @default(cuid())
  userId              String
  organizationId      String?
  /// Polymorphic node refs, format "contact:<id>" | "entity:<id>". No FK
  /// constraint — id spaces don't collide (both cuid); resolved in the
  /// service layer. Chosen over a normalized GraphNode table to fit the
  /// timeline; revisit if the graph survives past the demo.
  fromNode            String
  toNode              String
  kind                GraphEdgeKind
  lastConversationId  String?
  weight              Int           @default(1)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  user                User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, fromNode, toNode, kind])
  @@index([organizationId])
  @@index([userId, fromNode])
  @@index([userId, toNode])
}
```

`weight` increments on repeat evidence (renders as edge/node thickness in the
UI). `lastConversationId` is enough evidence trail for the demo — no separate
evidence-join table.

## 4. Extraction pipeline

New job type `EXTRACT_GRAPH_ENTITIES`, chained after analysis in
`handlers.ts`:

```ts
case 'ANALYZE_CONVERSATION': {
  ...
  await enqueueEmbedConversation(conversationId)
  await enqueueExtractGraphEntities(conversationId)   // new
  ...
}

case 'EXTRACT_GRAPH_ENTITIES': {
  const conversationId = String(payload.conversationId ?? '')
  if (!conversationId) throw new Error('EXTRACT_GRAPH_ENTITIES job missing conversationId')
  return await extractGraphEntities(conversationId)
}
```

New `src/services/graph.service.ts`, hybrid extraction:

- **Deterministic (no AI, always runs):** `upsertCompanyEdge(contact)` parses
  the contact's email domain, skips a public-provider skip-list (gmail.com,
  outlook.com, yahoo.com, hotmail.com, icloud.com, ...), upserts
  `GraphEntity{type:COMPANY, canonicalKey:domain}` and
  `GraphEdge{kind:WORKS_AT}` (`contact:<id>` → `entity:<companyId>`),
  bumping `weight` on repeat.
- **AI (best-effort):** `extractTopicsForConversation(conversationId)` calls a
  new `extractTopics` entry point in `src/services/ai/index.ts` (same
  provider-selection + `fallbackOnRetryable` contract as `summarizeThread`/
  `parseSearchQuery`). Prompt includes the conversation subject + recent
  messages **plus the user's existing top ~30 topics by weight**, instructing
  the model to reuse a matching existing topic rather than mint a near-duplicate
  wording. Returns 1–3 `{ name, canonicalKey }` topics. For each: upsert
  `GraphEntity{type:TOPIC}`, edge `contact:<id>` → `entity:<topicId>`
  (`DISCUSSED`), and if the contact already has a `WORKS_AT` company, also
  `entity:<companyId>` → `entity:<topicId>` (`DISCUSSED`).
- No AI key / `getTextProvider()` null → job runs the deterministic half only
  and returns `{ skipped: 'no-ai-provider' }`, matching the existing pattern
  for AI-gated jobs in this codebase.

One-off backfill script `npm run backfill:graph` (tsx script, same style as
`test:classifier`/`test:agentic`) runs `extractGraphEntities` over already-
synced conversations, so the graph isn't empty for existing users before their
next Gmail sync.

## 5. UI

**`/graph` — full explorer (new page, new sidebar entry):**
- Server Component; new read-model `getKnowledgeGraph(userId)` in
  `graph.service.ts` does one batched fetch (nodes + edges), following the
  `dashboard.service.ts` convention — plain serialized props, no client-side
  Prisma.
- Client-rendered force-directed graph. Deliberate exception to the
  dependency-free chart convention: adds **`d3-force`** (physics only, ~20kB)
  rendered through our own SVG + framer-motion, matching the visual language
  of the rest of `charts/`. Hand-rolling force-layout physics isn't worth the
  risk on this timeline.
- Interactions: click a node → highlight neighbors + sidebar listing linked
  conversations (deep-links to `/inbox/[id]`); search by node name; filter by
  type (Person/Company/Topic).
- `ModulePill` = `beta` (per the module-honesty policy already in this repo),
  with a tooltip clarifying company edges are deterministic (email domain) and
  topic edges are AI-inferred — so it doesn't read as fabricated data on demo.

**Mini-graph on `/clients`:**
- Static radial preview per contact card (contact centered, up to ~6 one-hop
  neighbors) — no physics simulation, same SVG approach as other `charts/`
  components, cheap to render in a list.
- Click-through / "Open in graph →" navigates to `/graph?focus=<nodeId>`.

## 6. Explicitly out of scope (this spec)

- **Google Meet / Zoom as a data source.** Comparable in scope to the
  existing Gmail channel (OAuth verification, transcript ingestion) — a
  separate future project. Mention as roadmap in the pitch; not built now.
- **Normalized `GraphNode` table.** Deferred; string node refs (`contact:<id>`
  / `entity:<id>`) are the pragmatic choice for the timeline. Revisit if the
  graph survives past the demo.
- **Person↔Person edges** (e.g., co-occurrence in threads). Not part of the
  "people + companies + topics" MVP; add later if time allows.
- **Cross-conversation topic merge job.** The existing-topics-in-prompt
  approach reduces near-duplicate topics without a dedicated merge/reconcile
  job. Accepted as good-enough for the demo, not perfect.

## 7. Testing

No formal test framework in this project (per `CLAUDE.md`) — pure logic is
checked via `tsx` scripts, following `test:classifier`/`test:agentic`. New
`npm run test:graph` covers:
- Domain → company `canonicalKey` parsing, including the public-provider
  skip-list.
- Topic name → `canonicalKey` normalization.
- Upsert idempotency: re-running extraction on the same conversation bumps
  `weight` rather than creating duplicate entities/edges.

## 8. Rollout

1. Schema migration (`GraphEntity`, `GraphEdge`) — see
   `docs/superpowers/specs/*` and `CLAUDE.md` for the gitignored-migrations
   workflow (`migrate diff` → hand-made folder → `migrate deploy` in each
   worktree).
2. `graph.service.ts` (deterministic company extraction + AI topic
   extraction) + `extractTopics` in `src/services/ai/index.ts`.
3. Job wiring: `EXTRACT_GRAPH_ENTITIES` type, queue helper, `handlers.ts` case,
   chained from `ANALYZE_CONVERSATION`.
4. `backfill:graph` script.
5. `/graph` page + sidebar entry + `getKnowledgeGraph` read-model + `d3-force`
   dependency.
6. Mini-graph widget on `/clients`.
7. `test:graph` pure-logic script.