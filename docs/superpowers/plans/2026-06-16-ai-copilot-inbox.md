# AI Copilot Layer for the Inbox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, chosen by user) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI Copilot layer to the inbox — review-before-send reply drafts (tone + steer + regenerate), background auto-drafts for urgent threads, catch-me-up summaries, one-click actions, smart compose, and a server-side search/filter/sort overhaul.

**Architecture:** All model calls go through the existing provider-agnostic AI layer (`src/services/ai/`). Slow/background work (auto-drafts) uses the durable Postgres job queue. New request-path queries stay sequential (small Prisma pool). Every AI feature degrades honestly without a key.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Prisma 5 · Supabase Postgres · Gemini (free tier) · Zustand · Tailwind 4.

**Testing reality:** No test runner is configured in this repo (per CLAUDE.md). Per-task verification = `npm run lint` + `npm run build` + the stated manual check. Business logic is kept in pure, side-effect-free functions so tests can be added later. This is a deliberate adaptation to the project, not skipped rigor.

**Spec:** `docs/superpowers/specs/2026-06-16-ai-copilot-inbox-design.md` — consult it for full design rationale; this plan is the execution checklist.

---

## File Structure

**Phase 1 — Reply drafts**
- Modify `src/services/ai/types.ts` — add `DraftTone`, `DraftPayload`, `DraftOutcome` types (or co-locate in index).
- Modify `src/services/ai/index.ts` — `generateReplyDraft()` + draft JSON schema + prompt builder.
- Modify `src/services/ai/local.provider.ts` — `localReplyDraft()` template fallback.
- Create `src/services/draft.service.ts` — context assembly + `generateReplyDraftForConversation()` + `collectStyleSamples()`.
- Create `src/app/api/conversations/[id]/draft/route.ts` — `POST` (generate) + `DELETE` (dismiss; used in Phase 3).
- Modify `src/components/Composer.tsx` — tone/steer/draft/regenerate UI + states.
- Modify `src/types/index.ts` — shared draft types if needed by the client.

**Phase 2 — Search & filters**
- Modify `prisma/schema.prisma` — `Conversation.awaitingReply Boolean` + index. (migration M-C)
- Modify `src/services/gmail.service.ts` — maintain `awaitingReply` on sync + on reply.
- Create `src/services/search.ranking.ts` — pure blend/score helpers (extracted, testable).
- Modify `src/services/search.service.ts` — new candidate/semantic/union flow using ranking helpers.
- Modify `src/app/api/conversations/route.ts` — server-side filters (risk/sentiment/awaiting/sort/daysBack) returning summary shape.
- Modify `src/components/InboxList.tsx` — fetch from `/api/conversations` when filters/sort active.
- Modify `src/components/InboxFilters.tsx` — add risk/sentiment rows + sort options.
- Modify `src/components/ConversationList.tsx` — summary type gains `nextAction?`, `hasDraft?`.

**Phase 3 — Auto-drafts**
- Modify `prisma/schema.prisma` — `ConversationDraft` model + `JobType GENERATE_DRAFT`. (migrations M-A, M-B)
- Modify `src/services/jobs/queue.ts` — `enqueueGenerateDraft()` dedupe helper.
- Modify `src/services/jobs/handlers.ts` — `GENERATE_DRAFT` case + enqueue hook in `ANALYZE_CONVERSATION`.
- Modify `src/services/draft.service.ts` — `upsertAutoDraft()`, `dismissDraft()`, `markDraftSent()`.
- Modify `src/services/gmail.service.ts` — `markDraftSent` after `sendGmailReply`.
- Modify `src/app/api/conversations/[id]/draft/route.ts` — wire `DELETE` → dismiss.
- Modify `src/components/InboxListContent.tsx` — include `hasDraft` + `nextAction` in summaries.
- Modify `src/app/(dashboard)/inbox/[id]/page.tsx` — pass READY draft to `Composer`.
- Modify `src/app/api/cron/gmail/route.ts` — bounded auto-draft backfill.

**Phase 4 — Catch-me-up + one-click**
- Modify `src/services/ai/index.ts` — `summarizeThread()` + schema.
- Create `src/app/api/conversations/[id]/summarize/route.ts` — POST, cached in analysisData.
- Create `src/components/ThreadSummary.tsx` — collapsible "Catch me up" card.
- Modify `src/app/(dashboard)/inbox/[id]/page.tsx` — render `ThreadSummary` for long threads.
- Modify `src/components/ConversationList.tsx` — `✨ Reply` quick-action + nextAction line.

**Phase 5 — Smart Compose**
- Create `src/app/api/compose/draft/route.ts` — POST `{ instruction, tone, to? }`.
- Create `src/app/api/compose/send/route.ts` — POST `{ to, subject, body }` → `sendGmailMessage`.
- Create `src/components/ComposeModal.tsx` — recipient + instruction → draft → send.
- Modify `src/components/InboxList.tsx` (header) + `src/components/CommandPalette.tsx` — "Compose" entry.

---

## Phase 1 — Reply drafts (the headline feature)

### Task 1.1: Draft types + AI schema/prompt

**Files:**
- Modify: `src/services/ai/index.ts`

- [ ] **Step 1: Add types and schema near the analysis section**

```ts
export type DraftTone = 'WARM' | 'CONCISE' | 'FORMAL' | 'MATCH'

export interface DraftPayload {
  channel: string
  contactName: string
  messages: { direction: 'INBOUND' | 'OUTBOUND'; content: string; sentAt: Date | string }[]
  analysisSummary?: string
  nextAction?: string
  tone: DraftTone
  steer?: string
  styleSamples?: string[]
  mode?: 'reply' | 'compose'
}

export interface DraftOutcome { body: string; subject?: string; provider: 'gemini' | 'local' }

const DRAFT_SCHEMA: AiJsonSchema = {
  type: 'object',
  properties: {
    subject: { type: 'string', description: 'Email subject. Only for a brand-new email (compose mode); omit for replies.' },
    body: { type: 'string', description: 'The complete, ready-to-send message body in the same language as the conversation. No placeholders.' },
  },
  required: ['body'],
}

const TONE_GUIDE: Record<DraftTone, string> = {
  WARM: 'Warm, friendly and personable, while remaining professional.',
  CONCISE: 'Short and to the point. A few sentences at most. No filler.',
  FORMAL: 'Formal and polished business tone.',
  MATCH: "Imitate the user's own writing voice from the provided style samples (length, greeting, sign-off, formality).",
}
```

- [ ] **Step 2: Add the prompt builder**

```ts
function buildDraftPrompt(p: DraftPayload): string {
  const thread = p.messages.map((m) => {
    const role = m.direction === 'INBOUND' ? `THEM (${p.contactName})` : 'ME'
    const body = m.content.length > 800 ? m.content.slice(0, 800) + '…' : m.content
    return `${role}: ${body}`
  }).join('\n\n')

  const styleBlock = p.tone === 'MATCH' && p.styleSamples?.length
    ? `\n\nMY PAST REPLIES (imitate this voice):\n${p.styleSamples.map((s) => `- ${s.slice(0, 400)}`).join('\n')}`
    : ''

  const intro = p.mode === 'compose'
    ? `Write a brand-new ${p.channel} email to "${p.contactName || 'the recipient'}".`
    : `Write the next reply from ME in this ${p.channel} conversation with "${p.contactName}".`

  return `You are drafting on behalf of a service-business manager. ${intro}
Tone: ${TONE_GUIDE[p.tone]}
Write in the SAME LANGUAGE as the conversation/instruction. Output a complete, ready-to-send message — no placeholders like [Your name], no markdown, plain text only. End with a natural sign-off.
${p.analysisSummary ? `\nContext: ${p.analysisSummary}` : ''}${p.nextAction ? `\nIntended next step: ${p.nextAction}` : ''}${p.steer ? `\nThe user specifically wants to say: "${p.steer}"` : ''}
${p.mode === 'compose' ? '' : `\nCONVERSATION:\n${thread}`}${styleBlock}

Return JSON matching the schema.`
}
```

- [ ] **Step 3: Add `generateReplyDraft()`**

```ts
export async function generateReplyDraft(
  payload: DraftPayload,
  opts: { fallbackOnRetryable?: boolean } = {},
): Promise<DraftOutcome> {
  const provider = getTextProvider()
  if (provider) {
    try {
      const raw = await provider.generateJson<{ body?: unknown; subject?: unknown }>({
        prompt: buildDraftPrompt(payload),
        schema: DRAFT_SCHEMA,
        maxOutputTokens: 1024,
      })
      const body = String(raw.body ?? '').trim()
      if (!body) throw new AiProviderError('Empty draft body', 'bad_response')
      const subject = typeof raw.subject === 'string' && raw.subject.trim() ? raw.subject.trim() : undefined
      return { body, subject, provider: 'gemini' }
    } catch (err) {
      if (err instanceof AiProviderError && err.retryable && !opts.fallbackOnRetryable) throw err
      console.warn(`[ai] draft generation failed (${String(err)}); using local template`)
    }
  }
  return { ...localReplyDraft(payload), provider: 'local' }
}
```

- [ ] **Step 4: Verify** — `npm run lint` (file compiles, no unused). Expected: no new errors. (Build deferred until `localReplyDraft` exists in Task 1.2.)

### Task 1.2: Local template fallback

**Files:**
- Modify: `src/services/ai/local.provider.ts`

- [ ] **Step 1: Add `localReplyDraft`** — detect language by Cyrillic presence; return a short polite acknowledgement that references the contact name; no AI.

```ts
import type { DraftPayload } from './index'

export function localReplyDraft(p: Pick<DraftPayload, 'contactName' | 'messages'>): { body: string } {
  const text = p.messages.map((m) => m.content).join(' ')
  const ru = /[Ѐ-ӿ]/.test(text)
  const name = p.contactName?.split(' ')[0] || (ru ? 'здравствуйте' : 'there')
  const body = ru
    ? `Здравствуйте, ${name}!\n\nСпасибо за сообщение. Я ознакомился и вернусь к вам с подробным ответом в ближайшее время.\n\nС уважением`
    : `Hi ${name},\n\nThanks for your message. I've reviewed it and will get back to you shortly with a detailed reply.\n\nBest regards`
  return { body }
}
```

> Note: importing a type from `./index` into `local.provider.ts` can create a cycle if `index` imports `local.provider` at module load for values. It already imports `localAnalyzeConversation` as a value. Keep `localReplyDraft` a value import in index; the `DraftPayload` type import here is type-only (`import type`) so it is erased — no runtime cycle.

- [ ] **Step 2: Export from index** — add `localReplyDraft` to the import in `src/services/ai/index.ts`:
  `import { localAnalyzeConversation, localReplyDraft } from './local.provider'`

- [ ] **Step 3: Verify** — `npm run lint && npm run build`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/ai/
git commit -m "feat(ai): add generateReplyDraft with tone + steer and local fallback"
```

### Task 1.3: Draft service

**Files:**
- Create: `src/services/draft.service.ts`

- [ ] **Step 1: Implement context assembly + generation** (sequential queries only)

```ts
import { prisma } from '@/lib/prisma'
import { htmlToText } from '@/lib/html' // if absent, use messagePreview with large length
import { generateReplyDraft, type DraftTone, type DraftOutcome } from './ai'

const STYLE_SAMPLE_CACHE = new Map<string, { samples: string[]; at: number }>()
const STYLE_TTL = 10 * 60_000

export async function collectStyleSamples(userId: string): Promise<string[]> {
  const hit = STYLE_SAMPLE_CACHE.get(userId)
  if (hit && Date.now() - hit.at < STYLE_TTL) return hit.samples
  const msgs = await prisma.message.findMany({
    where: { direction: 'OUTBOUND', conversation: { userId } },
    orderBy: { sentAt: 'desc' },
    take: 5,
    select: { content: true },
  })
  const samples = msgs.map((m) => textOf(m.content)).filter((t) => t.length > 20).slice(0, 5)
  STYLE_SAMPLE_CACHE.set(userId, { samples, at: Date.now() })
  return samples
}

function textOf(content: string): string {
  // strip tags + quoted reply chains, collapse whitespace
  return content.replace(/<[^>]+>/g, ' ').replace(/^>.*$/gm, '').replace(/\s+/g, ' ').trim()
}

export async function generateReplyDraftForConversation(
  userId: string,
  conversationId: string,
  opts: { tone?: DraftTone; steer?: string; fallbackOnRetryable?: boolean } = {},
): Promise<DraftOutcome> {
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      contact: { select: { name: true } },
      analysis: { select: { summary: true, nextAction: true } },
      messages: { orderBy: { sentAt: 'asc' }, select: { direction: true, content: true, sentAt: true } },
    },
  })
  if (!conv) throw new Error('Conversation not found')
  const tone = opts.tone ?? 'WARM'
  const styleSamples = tone === 'MATCH' ? await collectStyleSamples(userId) : undefined
  return generateReplyDraft({
    channel: conv.channel,
    contactName: conv.contact.name,
    messages: conv.messages.map((m) => ({ direction: m.direction, content: textOf(m.content), sentAt: m.sentAt })),
    analysisSummary: conv.analysis?.summary,
    nextAction: conv.analysis?.nextAction ?? undefined,
    tone,
    steer: opts.steer,
    styleSamples,
    mode: 'reply',
  }, { fallbackOnRetryable: opts.fallbackOnRetryable })
}
```

> Before writing, check `src/lib/html.ts` for an existing text extractor; reuse it instead of the local `textOf` if one exists (DRY).

- [ ] **Step 2: Verify** — `npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 3: Commit** — `git add src/services/draft.service.ts && git commit -m "feat(draft): conversation draft service with style sampling"`

### Task 1.4: Draft API route

**Files:**
- Create: `src/app/api/conversations/[id]/draft/route.ts`

- [ ] **Step 1: Implement POST** (mirror `/reply` ownership + Gmail-only checks)

```ts
import { z } from 'zod'
import { getAuthUser, ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { generateReplyDraftForConversation } from '@/services/draft.service'

const Body = z.object({
  tone: z.enum(['WARM', 'CONCISE', 'FORMAL', 'MATCH']).optional(),
  steer: z.string().trim().max(500).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthUser()
  if (!user) return error
  const { id } = await params
  const conv = await prisma.conversation.findUnique({ where: { id }, select: { userId: true, channel: true } })
  if (!conv || conv.userId !== user.id) return err('Not found', 404)
  if (conv.channel !== 'GMAIL') return err('Drafts are only supported for Gmail', 400)
  let parsed: z.infer<typeof Body>
  try { parsed = Body.parse(await req.json().catch(() => ({}))) }
  catch (e) { return err(e instanceof z.ZodError ? e.issues[0]?.message ?? 'Invalid body' : 'Invalid body', 400) }
  try {
    const draft = await generateReplyDraftForConversation(user.id, id, { tone: parsed.tone, steer: parsed.steer, fallbackOnRetryable: true })
    return ok(draft)
  } catch (e) {
    console.error(`[draft] conversation ${id}:`, e)
    return err(e instanceof Error ? e.message : 'Failed to draft', 500)
  }
}
```

- [ ] **Step 2: Verify** — `npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 3: Manual** — `npm run dev`, then in DevTools: `fetch('/api/conversations/<id>/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"tone":"WARM"}'}).then(r=>r.json()).then(console.log)`. Expected: `{ body: "...", provider: "gemini" }`.
- [ ] **Step 4: Commit** — `git commit -am "feat(api): POST /conversations/[id]/draft"`

### Task 1.5: Composer rework

**Files:**
- Modify: `src/components/Composer.tsx`

- [ ] **Step 1: Add props + state** — `initialDraft?: { body: string; provider: string } | null`, `autoDraft?: boolean`. Add `tone` state (default `WARM`), `steer` state, `drafting` state, `aiProvider` state (for the honesty label), `showSteer` toggle.
- [ ] **Step 2: Add `draft()` action** — POST to `/api/conversations/${conversationId}/draft` with `{ tone, steer }`; on success set `body` to result, set `aiProvider`, autoGrow. Reuse the existing `error` channel.
- [ ] **Step 3: On mount effect** — if `initialDraft`, set body + provider + fire-and-forget `DELETE /api/conversations/${id}/draft` to clear the badge. Else if `autoDraft`, call `draft()` once.
- [ ] **Step 4: Render the action bar** — tone `<select>` (Тёплый/Кратко/Формально/Как я), `✨ Draft`/`↻ Regenerate` button (label depends on whether body exists & came from AI), a toggle for the steer `<input>`, plus the existing Send button. When `aiProvider==='local'` show a small "offline template" label. Keep Enter-to-send.
- [ ] **Step 5: Add CSS** — extend the existing `composer` styles in the global stylesheet (find where `.composer` is defined) with `.composer-tools`, `.composer-tone`, `.composer-steer`, `.composer-ai-label`. Match existing tokens/`var(--*)`.
- [ ] **Step 6: Verify** — `npm run lint && npm run build`, then manual in `npm run dev`: open a Gmail thread → Draft → text appears → change tone → Regenerate → add steer → Regenerate → edit → Send. Expected: all work; Send posts to `/reply` unchanged.
- [ ] **Step 7: Commit** — `git commit -am "feat(inbox): AI draft composer with tone, steer, regenerate"`

---

## Phase 2 — Search & filters

### Task 2.1: `awaitingReply` column (migration M-C)

**Files:** Modify `prisma/schema.prisma`; new migration.

- [ ] **Step 1** Add to `Conversation`: `awaitingReply Boolean @default(false)` and `@@index([userId, awaitingReply])`.
- [ ] **Step 2** `npx prisma migrate dev --name conversation_awaiting_reply`.
- [ ] **Step 3** Edit the generated migration SQL to append the backfill (correlated subquery from the spec M-C).
- [ ] **Step 4** `npx prisma generate`. Verify `npm run build`.
- [ ] **Step 5** Commit — `git commit -am "feat(db): denormalize Conversation.awaitingReply + backfill"`

### Task 2.2: Maintain `awaitingReply`

**Files:** Modify `src/services/gmail.service.ts` (and `src/services/draft.service.ts` if reply lives there).

- [ ] **Step 1** After a sync upserts a thread's messages, set `awaitingReply = (latestDirection === 'INBOUND')` for each changed conversation (in the existing update of `lastMessageAt`/priority).
- [ ] **Step 2** In `sendGmailReply`, after the outbound message is stored, set `awaitingReply = false`.
- [ ] **Step 3** Verify `npm run lint && npm run build`. Manual: reply to a thread → its `awaitingReply` flips false (check Prisma Studio).
- [ ] **Step 4** Commit — `git commit -am "feat(gmail): maintain awaitingReply on sync and reply"`

### Task 2.3: Pure ranking helpers

**Files:** Create `src/services/search.ranking.ts`; modify `src/services/search.service.ts`.

- [ ] **Step 1** Extract pure functions into `search.ranking.ts`: `tokenize`, field-weight scoring, `blendScore({ keyword, semantic })`, `applyBoosts(score, { ageMs, priority })`, with the retuned constants (blend 0.55/0.45, cutoff 0.40, sqrt coverage penalty). Export `SEARCH_TUNING` constants.
- [ ] **Step 2** Add a `// @ts-check`-style ad-hoc verification note: run `npx tsx -e "import('./src/services/search.ranking.ts').then(...)"` with a couple of hand cases (keyword-only, semantic-only, both) to sanity-check monotonicity. (No persistent runner.)
- [ ] **Step 3** Verify `npm run lint && npm run build`. Commit — `git commit -am "refactor(search): extract pure ranking helpers, retune weights"`

### Task 2.4: Search candidate/semantic/union redesign

**Files:** Modify `src/services/search.service.ts`.

- [ ] **Step 1** Replace the single capped candidate query with: (a) a bounded filtered-universe id query ordered by `lastMessageAt desc` (`SEMANTIC_SCAN_LIMIT`); (b) load embeddings for that universe; (c) cosine-score; take `SEMANTIC_TOP`; (d) keyword-score the universe rows; (e) union(keyword>0, semantic-top) bounded; (f) hydrate metadata for the union; (g) blend via ranking helpers. All sequential.
- [ ] **Step 2** Keep graceful degradation + `meta.degraded`. Use `awaitingReply` column for the awaiting filter (fallback to latest-message direction if null).
- [ ] **Step 3** Verify `npm run lint && npm run build`. Manual: search a term that appears in an older/low-priority thread → it now surfaces; check `meta.mode==='hybrid'` once embeddings exist.
- [ ] **Step 4** Commit — `git commit -am "feat(search): universe-wide semantic recall + union ranking"`

### Task 2.5: Server-side filters on `/api/conversations`

**Files:** Modify `src/app/api/conversations/route.ts`; `src/types/index.ts` if a summary type is needed.

- [ ] **Step 1** Accept + validate `risk`, `sentiment`, `awaiting` (`true`), `sort` (`priority|recent|oldest`), `daysBack`; apply at-least semantics for `priority`/`risk` (reuse maps); filter `risk`/`sentiment` via `analysis` relation; `awaiting` via the column; order per `sort`.
- [ ] **Step 2** Return the summary shape the inbox list needs (incl. `awaitingReply`, `timeLabel`, `lastMessage`; `nextAction`/`hasDraft` added in Phase 3/4 — leave optional now).
- [ ] **Step 3** Verify `npm run lint && npm run build`. Manual: `GET /api/conversations?risk=HIGH&sort=recent` returns correct rows.
- [ ] **Step 4** Commit — `git commit -am "feat(api): server-side conversation filters and sort"`

### Task 2.6: Inbox list wiring + richer filters UI

**Files:** Modify `src/components/InboxList.tsx`, `src/components/InboxFilters.tsx`.

- [ ] **Step 1** In `InboxFilters`, add Risk and Sentiment single-select rows and a Sort segment (Priority/Newest/Oldest). Lift the new state into `InboxList`.
- [ ] **Step 2** In `InboxList`, when any server-relevant filter or non-default sort is active (and no `q`), fetch `/api/conversations?<params>` (debounced, abortable — mirror the `/api/search` effect) and render the flat result list path. No filter → keep the streamed accordion groups.
- [ ] **Step 3** Persist new params in the URL alongside `q/f/c/sort`.
- [ ] **Step 4** Verify `npm run lint && npm run build`. Manual: set Risk=High → list reflects whole mailbox, not just loaded 100; clear → groups return.
- [ ] **Step 5** Commit — `git commit -am "feat(inbox): server-driven filters/sort across all mail"`

---

## Phase 3 — Auto-drafts

### Task 3.1: Schema (migrations M-A, M-B)

**Files:** Modify `prisma/schema.prisma`.

- [ ] **Step 1** Add `ConversationDraft` model (per spec) + `draft ConversationDraft?` on `Conversation`; append `GENERATE_DRAFT` to `JobType`.
- [ ] **Step 2** `npx prisma migrate dev --name conversation_draft_and_generate_job` + `npx prisma generate`.
- [ ] **Step 3** Verify `npm run build`. Commit — `git commit -am "feat(db): ConversationDraft model + GENERATE_DRAFT job type"`

### Task 3.2: Draft persistence helpers

**Files:** Modify `src/services/draft.service.ts`.

- [ ] **Step 1** Add `upsertAutoDraft(userId, conversationId)`: skip if latest message is OUTBOUND or no AI provider; generate (no retryable fallback); upsert `ConversationDraft` (status READY, basedOnMessageId, provider/model). Add `dismissDraft(conversationId)` (status DISMISSED) and `markDraftSent(conversationId)` (status SENT).
- [ ] **Step 2** Verify `npm run lint && npm run build`. Commit — `git commit -am "feat(draft): auto-draft persistence (upsert/dismiss/sent)"`

### Task 3.3: Job wiring

**Files:** Modify `src/services/jobs/queue.ts`, `src/services/jobs/handlers.ts`.

- [ ] **Step 1** Add `enqueueGenerateDraft(userId, conversationId)` deduped on PENDING+conversationId (mirror `enqueueEmbedConversation`).
- [ ] **Step 2** Add `GENERATE_DRAFT` case → `upsertAutoDraft`. In `ANALYZE_CONVERSATION` case, after analysis, if `priority.level` is HOT/ATTENTION and conversation awaiting + provider available → `enqueueGenerateDraft`.
- [ ] **Step 3** Verify `npm run lint && npm run build`. Manual: run `npm run worker` after a sync; a HOT awaiting thread gets a `ConversationDraft` row (Prisma Studio).
- [ ] **Step 4** Commit — `git commit -am "feat(jobs): GENERATE_DRAFT job + enqueue on urgent awaiting threads"`

### Task 3.4: Surface auto-drafts + invalidation

**Files:** Modify `InboxListContent.tsx`, `ConversationList.tsx`, `inbox/[id]/page.tsx`, `draft/route.ts`, `gmail.service.ts`, `cron/gmail/route.ts`.

- [ ] **Step 1** `InboxListContent`: include `hasDraft` (READY draft exists) in summaries; `ConversationList`: render a "✨ draft" badge.
- [ ] **Step 2** `inbox/[id]/page.tsx`: load the READY draft and pass `initialDraft` to `Composer`.
- [ ] **Step 3** `draft/route.ts`: implement `DELETE` → `dismissDraft`. `gmail.service.ts`: call `markDraftSent` in `sendGmailReply`.
- [ ] **Step 4** `cron/gmail`: bounded `enqueueGenerateDraft` backfill for awaiting HOT/ATTENTION threads lacking a READY draft.
- [ ] **Step 5** Verify `npm run lint && npm run build`. Manual: urgent thread shows badge; opening pre-fills composer; sending clears it.
- [ ] **Step 6** Commit — `git commit -am "feat(inbox): surface auto-drafts with badge, prefill, invalidation"`

---

## Phase 4 — Catch-me-up + one-click

### Task 4.1: Summary AI fn + API

**Files:** Modify `src/services/ai/index.ts`; create `src/app/api/conversations/[id]/summarize/route.ts`.

- [ ] **Step 1** `summarizeThread(payload) → { tldr, keyPoints[], openItems[] }` with schema + prompt (same-language, concise bullets).
- [ ] **Step 2** API POST: ownership-checked; compute message-hash; if `analysisData.threadSummary.hash` matches → return cached; else generate, persist into `ConversationAnalysis.analysisData.threadSummary`, return.
- [ ] **Step 3** Verify `npm run lint && npm run build`. Commit — `git commit -am "feat(ai): summarizeThread + cached summarize API"`

### Task 4.2: Catch-me-up UI

**Files:** Create `src/components/ThreadSummary.tsx`; modify `inbox/[id]/page.tsx`.

- [ ] **Step 1** Client component: "Catch me up" button → POST summarize → render TL;DR + key points + open items; honesty pill; loading/error states.
- [ ] **Step 2** Render it in the thread header only when `messages.length > 6`.
- [ ] **Step 3** Verify build + manual on a long thread. Commit — `git commit -am "feat(inbox): catch-me-up thread summary"`

### Task 4.3: One-click action

**Files:** Modify `src/components/ConversationList.tsx`, `src/components/Composer.tsx` (autoDraft via search param), `inbox/[id]/page.tsx`.

- [ ] **Step 1** Row: for awaiting threads with `nextAction`, show a truncated next-action line + `✨ Reply` button linking to `/inbox/[id]?draft=1`.
- [ ] **Step 2** Thread page reads `?draft=1` (searchParams) → pass `autoDraft` to `Composer` (only when no stored draft).
- [ ] **Step 3** Verify build + manual: click `✨ Reply` from the list → thread opens → composer auto-drafts. Commit — `git commit -am "feat(inbox): one-click action with auto-draft deep link"`

---

## Phase 5 — Smart Compose

### Task 5.1: Compose APIs

**Files:** Create `src/app/api/compose/draft/route.ts`, `src/app/api/compose/send/route.ts`.

- [ ] **Step 1** `compose/draft` POST `{ instruction (≤1000), tone?, to? }` → `generateReplyDraft({ mode:'compose', tone, steer: instruction, contactName: to ?? '', messages: [] }, { fallbackOnRetryable:true })` → `{ subject, body, provider }`.
- [ ] **Step 2** `compose/send` POST `{ to (email), subject (≤300), body (≤25000) }` → validate, call `sendGmailMessage(user.id, { to, subject, body })` (confirm its signature first), return message id.
- [ ] **Step 3** Verify build + manual via fetch. Commit — `git commit -am "feat(api): smart compose draft + send"`

### Task 5.2: Compose modal + entry points

**Files:** Create `src/components/ComposeModal.tsx`; modify `InboxList.tsx` header + `CommandPalette.tsx`.

- [ ] **Step 1** Modal: recipient + instruction → Draft (fills subject+body, editable) → Send → close + toast/refresh.
- [ ] **Step 2** Add a "Compose" button in the inbox list header and a "Compose new email" action in the command palette (open the modal via a small Zustand flag or local state lifted to the inbox).
- [ ] **Step 3** Verify build + manual end-to-end send to yourself. Commit — `git commit -am "feat(inbox): smart compose modal + command palette entry"`

---

## Final verification

- [ ] `npm run lint` clean across the branch.
- [ ] `npm run build` succeeds.
- [ ] Manual smoke of every module per the spec's Verification section.
- [ ] Update `CLAUDE.md` (Architecture/API Routes/Key Decisions) to document the new draft service, endpoints, `GENERATE_DRAFT` job, `ConversationDraft`/`awaitingReply` schema, and search redesign.
- [ ] Final commit — `git commit -am "docs: document AI Copilot layer in CLAUDE.md"`

---

## Self-Review

**Spec coverage:** M1 → P1; M6 → P2; M2 → P3; M3+M4 → P4; M5 → P5; all three migrations covered (M-C in 2.1, M-A/M-B in 3.1). Honesty/degradation handled per-task (local fallback, provider gating). ✔

**Placeholder scan:** Code-bearing steps include real code or precise, unambiguous edit instructions referencing exact files/symbols. UI tasks (Composer, modal) describe concrete props/state/handlers rather than full JSX — acceptable for inline self-execution; the trickiest logic (AI fn, service, search) has full code. ✔

**Type consistency:** `DraftTone`/`DraftPayload`/`DraftOutcome` defined in 1.1, consumed identically in 1.3/1.4/3.2/5.1. `generateReplyDraftForConversation`, `upsertAutoDraft`, `dismissDraft`, `markDraftSent`, `enqueueGenerateDraft` named consistently across tasks. `awaitingReply` used the same way in 2.1/2.2/2.5/3.3. ✔

**Known follow-up to confirm during execution:** exact `sendGmailMessage` signature (Task 5.1) and presence of an HTML→text helper in `src/lib/html.ts` (Task 1.3) — both flagged inline.
