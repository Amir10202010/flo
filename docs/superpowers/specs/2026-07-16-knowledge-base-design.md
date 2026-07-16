# Knowledge Base — the memory of the workspace

**Date:** 2026-07-16
**Status:** Shipped on `feat/knowledge-base` (built on the merged `feat/knowledge-graph`)

## 1. Goal

Turn the v1 knowledge graph (people / companies / topics, shipped 2026-07-14 on
`feat/knowledge-graph`) into a core product surface: **Knowledge** — the memory
of the workspace. Instead of browsing email, the user should immediately see
who knows who, what topics connect people and companies, what was decided,
what meetings discussed what, and where information came from — all extracted
automatically, never organized by hand.

Five connected deliverables, one experience:

1. **/knowledge** — the graph, elevated: living canvas + a rich context panel.
2. **Extraction v2** — one AI pass per conversation extracts topics *and*
   decisions / action items / risks; meetings and notes feed the same graph.
3. **Meetings** — calendar-detected meetings with an AI pre-meeting brief and a
   post-meeting debrief (transcript/notes → summary, decisions, actions →
   graph).
4. **Notes** — plain, fast notes that auto-link to people / companies / topics
   as you save.
5. **Knowledge everywhere** — the assistant grounds answers in the graph and
   shows related entities; search and ⌘K return knowledge objects.

Design bar: Superhuman × Attio × Linear × Apple. Extend the existing design
language (Inter, near-black primary, `--accent` reserved for AI affordances,
radius-lg 12, restrained monochrome chips) — never introduce a second style.

## 2. Current state (what this builds on)

- `GraphEntity` (COMPANY | TOPIC) + `GraphEdge` (WORKS_AT | DISCUSSED) with
  polymorphic string node refs `contact:<id>` / `entity:<id>`; migration
  applied to the live DB; ~61 companies / ~15 topics / 284 edges backfilled.
- `EXTRACT_GRAPH_ENTITIES` job chained from `ANALYZE_CONVERSATION`;
  deterministic company edges (email domain) + AI topics (`extractTopics`).
- `/graph` page: d3-force SVG canvas (zoom/pan/drag, type filters, search,
  neighbor emphasis) + a basic inspector sidebar. `MiniGraph` on /clients.
- App context: solo AI inbox assistant (post-2026-07-10 pivot). Assistant is a
  summonable overlay (`AssistantModal` → `AssistantComposer`), grounded by a
  dashboard briefing; `ContactNote` quick-notes exist; `Reminder` = follow-ups;
  hybrid semantic search over conversations; durable Postgres job queue;
  everything read-path is org-scoped via `requireOrgPage()`.

## 3. Product decisions (the opinionated part)

- **Emails are evidence, not nodes.** Thousands of email nodes = spaghetti.
  Conversations appear in context panels and as edge provenance
  (`lastConversationId`), never on the canvas. Same for facts (decisions /
  action items): they are structured memory shown in panels, not nodes.
- **Node taxonomy v2: PERSON, COMPANY, TOPIC, MEETING, NOTE.** Meetings and
  notes are first-class Prisma models referenced as `meeting:<id>` /
  `note:<id>` node refs — the polymorphic ref pattern already in place.
- **No fabricated people.** AI-mentioned names only become graph links when
  they resolve to an existing Contact (or a meeting attendee with an email).
  Unresolved names live inside facts as text. Contacts remain the only PERSON
  nodes — honesty over node count.
- **Person↔person edges are deterministic, from meeting co-attendance**
  (KNOWS, weight bumps per shared meeting). No AI-guessed relationships
  between people.
- **One AI call per object.** Extraction v2 replaces `extractTopics` with
  `extractKnowledge` (topics + decisions + action items + risks in one
  response) — same free-tier cost, 4× the memory. Meetings and notes each get
  one extraction call on capture/save.
- **Meetings: detection is real, capture is honest.** Google Calendar
  (readonly scope, incremental OAuth) detects meetings + attendees + Meet/Zoom
  links — deterministic, no AI. Transcript capture v1 is paste-or-type
  (works for Meet, Zoom, phone calls, anything); the provider architecture
  (`detectProvider`, per-provider metadata) leaves bot/API ingestion as a
  plug-in point. No fake "recording" UI. Module pill: beta.
- **Notes stay plain text** (title + body, autosave). Auto-linking happens on
  save via the extraction job; linked entities render as chips under the
  editor. No rich-text editor v1 — speed and typography carry the premium
  feel.
- **IA:** sidebar gains `Knowledge` (route `/knowledge`; `/graph` redirects)
  and `Meetings`. Notes live as a tab inside Knowledge (`/knowledge/notes`)
  plus creation from context panels and post-meeting capture. Mobile tab bar
  gains Knowledge; the mobile experience is browse-first (entity list → full
  screen context sheet), not a shrunken canvas.

## 4. Data model (additive migration on the live DB)

```prisma
enum GraphEntityType { COMPANY TOPIC }            // unchanged
enum GraphEdgeKind {
  WORKS_AT   // contact → COMPANY          (deterministic)
  DISCUSSED  // contact|COMPANY → TOPIC    (AI)
  ATTENDED   // contact → MEETING          (deterministic)
  MENTIONS   // note|meeting → contact|entity (AI, note/meeting extraction)
  KNOWS      // contact ↔ contact          (deterministic, meeting co-attendance)
}

model Meeting {
  id / userId / organizationId
  provider        MeetingProvider  // GOOGLE_MEET | ZOOM | OTHER
  calendarEventId String?          // Google Calendar event id (dedupe key)
  title, startsAt, endsAt, joinUrl?
  status          MeetingStatus    // UPCOMING | COMPLETED | CANCELLED
  attendees       Json             // [{ email, name?, self?, contactId? }]
  transcript      String?          // pasted transcript or typed notes
  brief           Json?            // cached AI pre-meeting brief
  debrief         Json?            // AI summary/decisions/actions/topics + provider tag
  capturedAt      DateTime?        // when transcript/notes were ingested
  @@unique([userId, calendarEventId])
  @@index([userId, startsAt])
}

model Note {
  id / userId / organizationId
  title    String   // empty allowed; list falls back to body excerpt
  body     String
  createdAt / updatedAt
  linkedAt DateTime?  // last successful auto-link pass (null = pending)
  @@index([userId, updatedAt])
}

model KnowledgeFact {
  id / userId / organizationId
  kind       FactKind  // DECISION | ACTION_ITEM | RISK
  text       String
  sourceType String    // 'conversation' | 'meeting' | 'note'
  sourceId   String
  aboutNode  String?   // primary node ref ("contact:<id>" | "entity:<id>")
  happenedAt DateTime  // source timestamp (meeting start / message date)
  dedupeKey  String    @unique  // sha1(userId:kind:sourceType:sourceId:normText)
  @@index([userId, aboutNode, happenedAt])
  @@index([userId, sourceType, sourceId])
}

model KnowledgeEmbedding {                        // notes + meetings vectors
  sourceType String; sourceId String; model, dims, vector Bytes, contentHash
  @@unique([sourceType, sourceId])
}

enum JobType { … CALENDAR_SYNC EXTRACT_NOTE_KNOWLEDGE EXTRACT_MEETING_KNOWLEDGE }
```

Migration is **additive only** (new tables, new enum values with no defaults —
the safe pattern already used for `EXTRACT_GRAPH_ENTITIES`), applied via
`migrate diff → hand-made folder → migrate deploy` per the repo recipe.

## 5. Services

- **`graph.service.ts` (extended)** — node-ref helpers gain `meeting:`/`note:`;
  `upsertEdge` accepts the new kinds; `getKnowledgeGraph` returns MEETING/NOTE
  nodes; new `getNodeContext(orgCtx, ref)` powers the context panel: profile,
  neighbors (grouped by type), related conversations (from edge provenance +
  contact ownership), meetings (ATTENDED/MENTIONS), notes (MENTIONS), facts
  (aboutNode), suggested follow-ups (open reminders + awaiting-reply state).
  Sequential queries only (small pool rule).
- **`knowledge.extract.ts` (new)** — shared post-extraction writer: given
  `{topics, decisions, actionItems, risks, mentionedContacts, companies}` +
  a source (conversation / meeting / note), upserts entities, edges and facts
  idempotently (unique keys + weight increments, fact dedupeKey). Pure helpers
  (`factDedupeKey`, `resolveMentions` name→contact matching) are unit-tested.
- **`ai/index.ts`** — `extractKnowledge` (supersedes `extractTopics`;
  conversation flavor keeps the reuse-existing-topics contract), plus
  `extractNoteKnowledge` and `extractMeetingKnowledge` prompt flavors and
  `generateMeetingBrief` (brief paragraph + talking points from workspace
  context). All follow the `fallbackOnRetryable` contract.
- **`meeting.service.ts` + `calendar.service.ts` (new)** — calendar sync
  (Google Calendar `events.list`, ±14d window, dedupe by `calendarEventId`,
  attendee→contact matching, provider detection from conferenceData/URLs);
  brief assembly (one workspace read + AI paragraph, cached in `brief`);
  debrief ingestion (transcript → `extractMeetingKnowledge` → facts + edges +
  KNOWS co-attendance + summary stored in `debrief`); reminders created only
  via explicit per-action-item confirmation in the UI (propose → confirm).
- **`note.knowledge.service.ts` (new)** — note CRUD + debounced auto-link job
  enqueue on save; extraction writes MENTIONS edges + facts; note embedding.
- **`search.service.ts`** — response gains `knowledge` hits: entities +
  meetings + notes matched by keyword, blended with semantic cosine over
  `KnowledgeEmbedding` (graceful degradation identical to conversations).
- **`assistant.service.ts`** — briefing gains a KNOWLEDGE section built by
  matching question terms against entity/contact names (graph neighbors,
  recent facts, recent meetings); response gains `related` knowledge cards
  (validated against a whitelist like sources). Local fallback includes a
  deterministic knowledge lookup so offline mode still surfaces memory.
- **Jobs** — `CALENDAR_SYNC` (enqueued with GMAIL_SYNC + hourly cron),
  `EXTRACT_NOTE_KNOWLEDGE`, `EXTRACT_MEETING_KNOWLEDGE`; existing
  `EXTRACT_GRAPH_ENTITIES` handler now calls `extractKnowledge` and writes
  facts too. Backfill script extended (`backfill:graph` gains facts).

## 6. UI

- **`/knowledge`** — header (page-title + beta pill + view toggle Graph/Notes)
  over a full-height canvas + right context panel (360px, slides in on
  selection; overview stats + "recently learned" feed when nothing selected).
  Canvas keeps d3-force; polish pass: MEETING/NOTE node styles, hover
  neighborhood emphasis (already), spring view transitions (animated
  zoom-to-fit / focus via rAF lerp), node enter scale-in, React.memo node
  layer + tick throttling for large graphs, weight-ranked trim guard above
  ~600 visible nodes ("showing the strongest N — search to find the rest").
- **Context panel** (`KnowledgePanel`) — component reused by desktop panel and
  mobile full-screen sheet: identity header (ContactAvatar / type tile),
  quick stats row, Facts (decisions/actions with source links), Conversations,
  Meetings, Notes, Connections (chips by type), footer actions ("Open thread",
  "New note about this", "Focus in graph"). Data via `GET
  /api/knowledge/node?ref=…` with a skeleton while loading.
- **`/meetings`** — Upcoming + Past list (time-grouped rows: title, time,
  attendee avatars with matched-contact rings, provider glyph, "Brief"
  affordance). Empty states explain calendar connect (incremental OAuth CTA
  when scope missing). `/meetings/[id]`: before → AI Meeting Brief (attendee
  cards w/ relationship stats, company context, recent threads, open
  follow-ups, previous meetings, AI brief paragraph); after → Debrief
  (capture card → summary, decisions, action items each with "Remind me"
  confirm, topics linked, "added to knowledge" list, suggested follow-up email
  deep-linking into compose with prefill).
- **`/knowledge/notes` + `/knowledge/notes/[id]`** — list (updated-desc, title
  + excerpt + linked-entity chips) and editor (autosave ~800ms after idle,
  "Saved · linking…" status line, linked chips appear when the job lands —
  polled lightly while pending). "New note" from context panel pre-fills
  "About: <entity>" so the linker connects it immediately.
- **Assistant** — modal widens to a two-pane layout on ≥880px when knowledge
  is present: thread left, knowledge rail right (entity cards + related
  meetings/notes for the current exchange, each deep-linking to
  /knowledge?focus=…). On narrow screens the rail renders as chips under the
  answer. Honest labels when degraded (existing pattern).
- **⌘K palette** — new "Knowledge" group (entities, meetings, notes) above
  conversation results, fed by the extended search response.
- **Mobile** — /knowledge <768px: search + segmented type list (Person /
  Company / Topic / Meeting / Note rows), tap → full-screen KnowledgePanel
  sheet; canvas hidden. /meetings rows collapse to a single column. Tab bar:
  Home · Inbox · Contacts · Knowledge.

## 7. Testing & verification

`npm run test:knowledge` (new tsx script) covers: fact dedupe key, mention
resolution (name→contact), meeting provider detection from URLs/conferenceData,
attendee co-attendance edge derivation, extraction-writer idempotency
(re-ingest bumps weights, no dupes), search knowledge-hit ranking. Existing
`test:graph` stays green. Manual verification: backfill against real data,
`npm run build`, lint, and headless QA of the new routes.

## 8. Out of scope (explicit)

- Meeting bots / live transcription APIs (architecture leaves the seam:
  `Meeting.provider` + capture path; Meet REST transcripts are
  Workspace-gated, Zoom needs its own OAuth — both are future providers).
- Microsoft Teams / Outlook calendar.
- Rich-text notes, note sharing.
- pgvector migration (in-process cosine still wins at this scale).
- Person nodes for non-contacts.
