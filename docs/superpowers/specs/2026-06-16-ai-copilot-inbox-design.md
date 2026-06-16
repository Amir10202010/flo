# AI Copilot Layer for the Inbox — Design

**Date:** 2026-06-16
**Status:** Approved for planning
**Author:** Claude (with Amirkhan)

## Summary

Strengthen the product's AI surface across three pain points the user called out
— weak search/filter/sort, and the complete absence of an AI-drafted reply that
the user reviews before sending. We add a cohesive **AI Copilot layer** over the
inbox in six modules, all sharing one draft-generation core. Everything plugs
into the existing provider-agnostic AI layer (`src/services/ai/`), the durable
job queue, and the established "module honesty" + graceful-degradation rules.

## Goals

1. **AI reply drafts** — generate a complete, ready-to-send reply into the
   composer that the user edits and sends on confirm (never auto-send). Tone
   selector (Warm / Concise / Formal / Match-my-style) + one-line steer hint +
   regenerate.
2. **Auto-drafts** — for urgent (HOT/ATTENTION) threads awaiting a reply,
   pre-generate the draft in the background so it is waiting when the thread opens.
3. **Catch-me-up** — on-demand structured summary of long threads.
4. **One-click action** — surface the AI `nextAction` in list rows with a button
   that opens the thread and drafts a reply immediately.
5. **Smart Compose** — describe the gist of a brand-new email; AI writes
   subject + body for review and send.
6. **Search & filter overhaul** — server-side filtering/sorting across ALL mail
   (not just the loaded 100) and materially better hybrid ranking.

## Non-goals

- Telegram support (still placeholder; drafts/replies stay Gmail-only, matching
  the current `/reply` route).
- A paid AI provider. We stay on the free Gemini tier behind the existing
  interfaces; the local heuristic remains the honest fallback.
- A full email client compose experience (CC/BCC, attachments, rich text). Smart
  Compose is plain-text, single recipient, reusing `sendGmailMessage`.
- pgvector / external vector DB — in-process cosine still wins at current scale.

## Architecture principles (inherited, must hold)

- **Provider-agnostic AI**: all new model calls go through `AiTextProvider` in
  `src/services/ai/` via new high-level functions; no component or service
  touches a vendor SDK.
- **Graceful degradation**: every AI feature works (honestly labelled) when no
  key is present. Auto-drafts are the one exception — they are skipped when the
  provider is `local` (we don't pre-bake templates), but interactive drafts fall
  back to a labelled template.
- **Small connection pool**: NO `Promise.all` fan-out of Prisma queries in
  request paths. New request-path queries run sequentially (≤1 connection).
- **Module honesty**: any AI output carries provider provenance; `local` results
  are labelled "offline".
- **Job queue for slow/expensive/background work**: auto-draft generation is a
  job type, never inline in a request.

---

## Data model changes (3 migrations)

### M-A: `ConversationDraft` (new model)

One pending AI draft per conversation (1:1 — regenerated on new inbound, so we
only ever keep the latest).

```prisma
model ConversationDraft {
  id               String   @id @default(cuid())
  conversationId   String   @unique
  userId           String
  body             String
  tone             String   @default("WARM")    // WARM | CONCISE | FORMAL | MATCH
  provider         String   @default("gemini")  // gemini | local
  model            String?
  /// The inbound message this draft answers — used to detect staleness.
  basedOnMessageId String?
  status           String   @default("READY")   // READY | DISMISSED | SENT | STALE
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  conversation     Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([userId, status])
}
```

Add to `Conversation`: `draft ConversationDraft?`.

### M-B: `JobType += GENERATE_DRAFT`

Append `GENERATE_DRAFT` to the `JobType` enum.

### M-C: `Conversation.awaitingReply` (denormalized boolean)

```prisma
awaitingReply Boolean @default(false)
```

Plus an `@@index([userId, awaitingReply])` for server-side filtering. Backfill in
the migration SQL using a correlated subquery on the latest message direction:

```sql
UPDATE "Conversation" c SET "awaitingReply" = (
  SELECT m.direction = 'INBOUND'
  FROM "Message" m WHERE m."conversationId" = c.id
  ORDER BY m."sentAt" DESC LIMIT 1
);
```

Maintained going forward in `gmail.service.ts` (after sync upserts messages) and
set to `false` on a successful outbound reply.

> After any schema edit: `npx prisma migrate dev` + `npx prisma generate`.

---

## Module 1 — AI reply drafts (core)

### AI layer: `generateReplyDraft` in `src/services/ai/index.ts`

```ts
export type DraftTone = 'WARM' | 'CONCISE' | 'FORMAL' | 'MATCH'

export interface DraftPayload {
  channel: string
  contactName: string
  messages: { direction: 'INBOUND' | 'OUTBOUND'; content: string; sentAt: Date | string }[]
  analysisSummary?: string
  nextAction?: string
  tone: DraftTone
  steer?: string            // one-line user instruction
  styleSamples?: string[]   // recent OUTBOUND bodies (MATCH tone only)
  mode?: 'reply' | 'compose'
}

export interface DraftOutcome { body: string; subject?: string; provider: 'gemini' | 'local' }

export async function generateReplyDraft(
  payload: DraftPayload,
  opts?: { fallbackOnRetryable?: boolean },
): Promise<DraftOutcome>
```

- Schema: `{ body: string, subject?: string }` (subject only used in compose mode).
- Prompt rules: reply in the **same language as the thread**; obey tone; weave in
  `steer` if present; for `MATCH`, imitate the voice/length of `styleSamples`;
  output ready-to-send text with **no placeholders** like `[Your name]`; natural
  sign-off; plain text (no markdown/HTML).
- Retryable (429/transient) errors rethrow so callers (jobs) can back off; a
  `fallbackOnRetryable` flag (final job attempt / interactive path) produces the
  local template instead.
- Local fallback (`local.provider.ts`): a short, polite, language-detected
  acknowledgement template tagged `provider:'local'`.

### Service: `src/services/draft.service.ts`

- `buildReplyContext(userId, conversationId)` → ownership-checked load of
  conversation + messages (asc) + analysis + contact. Sequential queries only.
- `collectStyleSamples(userId)` → up to 5 recent OUTBOUND message bodies across
  the user's conversations (best-effort strip of quoted text/signatures), cached
  briefly in-process. Only fetched for `MATCH` tone.
- `generateReplyDraftForConversation(userId, conversationId, { tone, steer })` →
  assembles `DraftPayload`, calls `generateReplyDraft`, returns
  `{ body, provider }`. Shared by the interactive API and the background job.

### API: `POST /api/conversations/[id]/draft`

- Body (zod): `{ tone?: DraftTone (default WARM), steer?: string ≤ 500 }`.
- Ownership check + Gmail-only (mirrors `/reply`).
- Returns `{ body, provider }`. Interactive path passes `fallbackOnRetryable:true`
  so the user always gets *something* even on a quota blip.

### UI: rework `src/components/Composer.tsx`

- Props gain `initialDraft?: { body: string; provider: string } | null` and
  `autoDraft?: boolean` (from `?draft=1`).
- Layout: textarea (unchanged auto-grow) + an action bar:
  - `✨ Draft` (or `↻ Regenerate` once a draft exists)
  - Tone dropdown: Warm / Concise / Formal / Match my style
  - Collapsible steer input ("what to say…")
  - `Send` (unchanged behavior → existing `/reply`)
- States: `idle → drafting (spinner) → drafted (editable) → sending`.
- When `initialDraft` present: pre-fill on mount, show "✨ AI draft ready — review
  & send", and mark it consumed (status `DISMISSED` via
  `DELETE /api/conversations/[id]/draft`) so the list "ready" badge clears; the
  text stays in the box for the user to edit/send.
- When `autoDraft` and no stored draft: auto-trigger one draft on mount.
- Honesty: `provider:'local'` → "offline template" label.
- Errors: inline (existing `composer-error` pattern). Never blocks manual typing.

### Error handling / edge cases

- Empty thread or no inbound message → Draft button disabled with tooltip.
- Generation failure → inline error, textarea remains usable.
- Sending unchanged; draft text is just the composer value at send time.

---

## Module 2 — Auto-drafts (background)

### Job: `GENERATE_DRAFT`

- Handler (`jobs/handlers.ts`): load context; if the thread is no longer awaiting
  (latest message OUTBOUND) → no-op. Else generate (gemini only — skip when
  provider is local), `upsert` `ConversationDraft` with `status:'READY'`,
  `basedOnMessageId` = latest inbound message id. `fallbackOnRetryable` on final
  attempt is **false** (we'd rather have no auto-draft than a template one).
- Dedupe helper `enqueueGenerateDraft(userId, conversationId)` in `jobs/queue.ts`
  collapses onto an existing PENDING job for the same conversation.

### Enqueue hook

In the `ANALYZE_CONVERSATION` handler (where fresh `priority` + direction are
known): if `priority.level ∈ {HOT, ATTENTION}` **and** the conversation is
awaiting reply **and** the text provider is available → `enqueueGenerateDraft`.

### Invalidation

- New inbound (next sync → analyze) regenerates (upsert overwrites; `basedOnMessageId` updates).
- Successful `/reply` (`sendGmailReply`) → mark the conversation's draft
  `status:'SENT'`.
- User dismiss in the composer → `status:'DISMISSED'` via
  `DELETE /api/conversations/[id]/draft` (or a small PATCH).

### Cron backfill (optional, bounded)

`/api/cron/gmail` enqueues `GENERATE_DRAFT` for up to N awaiting HOT/ATTENTION
threads lacking a READY draft — a backstop so existing urgent mail gets drafts
without waiting for new activity.

### Surface

- `ConversationDraft` existence (status READY) → `hasDraft` flag on the list
  summary → "✨ draft ready" badge in `ConversationList` rows.
- Thread page passes the READY draft body to `Composer` as `initialDraft`.

---

## Module 3 — Catch-me-up (thread summary)

- AI fn `summarizeThread(payload) → { tldr: string; keyPoints: string[]; openItems: string[] }`.
- API `POST /api/conversations/[id]/summarize`. Result cached in
  `ConversationAnalysis.analysisData.threadSummary = { hash, tldr, keyPoints, openItems, at }`,
  keyed by a message-count/content hash; recomputed when the thread changes.
- UI: a "Catch me up" button in the thread header, shown only when the thread is
  long (> ~6 messages). Expands a card (TL;DR + key points + open items). Honesty
  pill as elsewhere. Degrades: no provider → button hidden (the existing
  `analysis.summary` insight box already covers short threads).

---

## Module 4 — One-click action

- Extend `ConversationSummary` (`ConversationList.tsx`) with
  `nextAction?: string | null` and `hasDraft?: boolean`.
- `InboxListContent` (and the new server filter endpoint) include
  `analysis.nextAction` and whether a READY `ConversationDraft` exists.
- Row UI: for awaiting threads, show a compact `✨ Reply` quick-action (and, space
  permitting, a truncated `nextAction`). Click → navigate to
  `/inbox/[id]?draft=1` → composer auto-drafts on open (Module 1).
- Scope: inbox list rows + thread. (Dashboard CommandCenter reuse is a noted
  optional follow-up, not in this spec.)

---

## Module 5 — Smart Compose (new email)

- AI fn reuses `generateReplyDraft` with `mode:'compose'` (returns subject+body)
  given an `instruction` (as `steer`) and optional recipient context.
- `POST /api/compose/draft` `{ instruction, tone?, to? }` → `{ subject, body, provider }`.
- `POST /api/compose/send` `{ to (email), subject, body }` → validates email,
  sends via existing `sendGmailMessage(userId, …)`, returns the new message id.
- UI: a "Compose" entry in the inbox header + Command Palette opens a modal:
  recipient + instruction → Draft → editable subject/body → Send. Plain text.
- Degradation: no provider → the instruction box still lets you write manually;
  Draft button produces a labelled template.

---

## Module 6 — Search & filter/sort overhaul

### Ranking redesign (`src/services/search.service.ts`)

Problem today: candidates are capped at top-400 **by priorityScore before
semantic scoring**, so a semantically-relevant thread outside the priority top
never surfaces; embedding coverage is often low (backfill 30/run) so search
silently degrades to keyword-only; blend weights/penalties are coarse.

New flow:

1. **Filtered universe**: select up to `SEMANTIC_SCAN_LIMIT` (~3000) conversation
   ids matching the active filters, ordered by `lastMessageAt desc` (recency, not
   priority — so recall isn't priority-biased). One bounded query.
2. **Semantic**: load embeddings for that universe, cosine-score against the
   query embedding, take top `SEMANTIC_TOP` (~120) ids.
3. **Keyword candidates**: from the same universe, the rows are scored by keyword
   over contact/subject/summary/message (existing field weights).
4. **Union & hydrate**: union(keyword>0 ids, semantic-top ids), bounded; hydrate
   metadata; blend.
5. **Blend** (tunable constants): both → `0.55*sem + 0.45*kw`; keyword-only →
   `kw`; semantic-only ≥ cutoff (~0.40) → `sem*0.9`. Soften partial-coverage
   penalty (sqrt of coverage, not linear). Keep recency + priority boosts.
6. **Coverage**: raise `BACKFILL_LIMIT`; enqueue backfill when coverage is low
   (existing mechanism, more aggressive); clearer `meta.degraded` messaging.

All queries sequential (pool constraint). Semantic remains an enhancement that
never throws the search.

### Server-side filters/sort

Extend `GET /api/conversations` to accept and validate:
`status`, `priority` (at-least via existing `PRIORITY_AT_LEAST`), `category`,
`channel`, `risk` (at-least), `sentiment`, `awaiting` (uses the new
`Conversation.awaitingReply` column), `sort ∈ {priority, recent, oldest}`,
optional `daysBack`, `limit`. Returns the `ConversationSummary` shape used by the
list (incl. `awaitingReply`, `nextAction`, `hasDraft`, `timeLabel`).

`InboxList` behavior:
- No filter/sort/search active → keep the server-streamed `groups` (fast first
  paint, accordion by mailbox — unchanged).
- Any filter or non-default sort active → fetch from `/api/conversations`
  (debounced, abortable — same pattern already used for `/api/search`) and render
  a **flat** ranked list (reusing the existing search-results rendering path).
- Search (`q`) continues to hit `/api/search`; filters combine with it.

This makes filters/sorting authoritative over the whole mailbox instead of the
loaded 100.

---

## Honesty & degradation summary

| Feature | No AI key behavior |
|---|---|
| Reply draft (interactive) | Labelled "offline template" |
| Auto-drafts | Skipped (not pre-baked) |
| Catch-me-up | Button hidden |
| One-click action | Shows `nextAction` if a prior analysis exists; draft falls back to template |
| Smart Compose | Manual compose still works; Draft = template |
| Search | Keyword-only (existing behavior), clearly badged "Basic"/"Match" |

## Risks & mitigations

- **Free-tier quota**: drafts add Gemini calls. Auto-drafts are gated to
  HOT/ATTENTION awaiting threads, deduped, and skipped without a key. 429s map to
  retryable errors so the queue paces itself (existing behavior).
- **Prisma pool (P2024)**: all new request-path queries sequential; the search
  redesign explicitly avoids `Promise.all`.
- **Draft quality / placeholders**: prompt forbids placeholders and instructs a
  ready-to-send result; user always reviews before send (never auto-send).
- **Style sampling privacy**: style samples are the user's own sent mail only,
  used transiently in the prompt, never stored.

## Phasing (each phase builds, lints, and is independently usable)

- **Phase 1 — Reply drafts (M1)**: AI fn + `draft.service` + `/draft` API +
  Composer rework. The headline feature.
- **Phase 2 — Search & filters (M6)**: ranking redesign + `awaitingReply`
  migration/maintenance + server-side `/api/conversations` filters + `InboxList`
  wiring.
- **Phase 3 — Auto-drafts (M2)**: `ConversationDraft` + `GENERATE_DRAFT` job +
  enqueue hook + invalidation + list badge + composer pre-fill.
- **Phase 4 — Catch-me-up + One-click (M3, M4)**: summary fn/API/UI + list-row
  action + deep-link auto-draft.
- **Phase 5 — Smart Compose (M5)**: compose draft/send APIs + modal + palette entry.

## Verification

No automated test suite is configured. Per phase:
- `npm run lint` and `npm run build` must pass.
- Manual verification in `npm run dev`: draft generation + tone + steer +
  regenerate + send; filter/sort across mailbox; auto-draft appears on an urgent
  awaiting thread; catch-me-up on a long thread; one-click action deep-link;
  smart compose end-to-end.
- Optional: lightweight unit tests for the pure search-blend/ranking helpers if
  cheaply extractable.

## Open questions (resolved)

- Interaction model → smart draft + tone + steer (chosen).
- Feature set → all four extras (chosen).
- Search depth → full server-side overhaul (chosen).
- Build cadence → everything, phased to completion (chosen).
- Provider → Gemini configured and working (confirmed).
