# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Next.js dev server
npm run build     # Production build
npm run lint      # ESLint check
npm run worker    # Run the standalone sync/ingestion worker (drains the job queue)
npx prisma migrate dev   # Apply schema migrations
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma studio        # Browse the database
```n

No test suite is configured yet.

## Environment Variables

Populate `.env.local` before running the app:

```
DATABASE_URL   # Supabase TRANSACTION POOLER url (port 6543): ?pgbouncer=true&connection_limit=5&pool_timeout=20
DIRECT_URL     # direct connection (port 5432) — used by prisma migrate only
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY        # free-tier AI Studio key powers ALL AI features (analysis, search, embeddings); without it the app degrades to the local heuristic provider
GEMINI_MODEL          # optional: override the Gemini model (default gemini-2.5-flash); e.g. gemini-2.5-flash-lite. NB: 2.0-family models lost their free tier (429 quota limit 0)
AI_PROVIDER           # optional: auto (default) | gemini | local — provider selection for the AI layer (src/services/ai)
AI_EMBEDDING_MODEL    # optional: override the embedding model (default gemini-embedding-001)
TELEGRAM_API_ID
TELEGRAM_API_HASH
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
GMAIL_USER_EMAIL
NEXTAUTH_SECRET
NEXT_PUBLIC_APP_URL
TOKEN_ENCRYPTION_KEY   # required in prod: encrypts OAuth tokens at rest (AES-256-GCM)
CRON_SECRET            # Vercel Cron bearer token that authorizes /api/jobs/process and /api/cron/gmail
WORKER_SECRET          # alt shared secret for triggering cron/drain endpoints via x-worker-secret
GMAIL_PUBSUB_TOPIC                # full Pub/Sub topic for Gmail push: projects/<proj>/topics/<topic>
GMAIL_PUBSUB_VERIFICATION_TOKEN   # shared token checked on the push webhook (?token=...)
NEXT_PUBLIC_CHECKOUT_URL          # optional: Stripe Payment Link / LemonSqueezy / Paddle checkout URL. Wires the "Get Velnox Pro" (pricing) and "Upgrade to Pro" (settings) buttons. Falls back to /signup and /pricing if unset.
```

## Architecture

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Prisma 5 · Supabase Postgres · Zustand · Tailwind CSS 4 · Deployed on Vercel.

**App Router layout:**
- `src/app/(auth)/` — login, signup, OAuth callback pages (unauthenticated shell); OAuth exchange is a Route Handler at `(auth)/callback/route.ts`, not a page
- `src/app/(dashboard)/` — the platform shell (`DashboardLayout` + sectioned `Sidebar` + global `CommandPalette`). Pages: `dashboard` (executive home — post-login landing), `inbox` (+ `inbox/[id]`), `clients`, `insights`, `risk`, `analytics`, `assistant` (beta shell), `integrations`, `settings`. Every data page has a matching `loading.tsx` skeleton
- `src/app/api/` — REST API route handlers (conversations CRUD, integrations, Gmail OAuth + sync)
- `src/app/page.tsx` — landing/marketing page

**Data layer:**
- `src/lib/prisma.ts` — singleton Prisma client (server-side only)
- `src/lib/supabase.ts` — browser Supabase client (uses `NEXT_PUBLIC_*` keys)
- `src/lib/supabase-server.ts` — server Supabase client built via `@supabase/ssr` + Next.js `cookies()`; used by all Route Handlers and Server Components
- `src/lib/auth.ts` — `getCurrentUser()` cached with React `cache()` to avoid duplicate round-trips per render tree; `src/lib/api.ts` — `getAuthUser()` / `ok()` / `err()` helpers for Route Handlers
- Prisma schema: `User → Integration → Conversation → Message`, `ConversationAnalysis` (1:1 with Conversation), `ConversationEmbedding` (1:1 — packed Float32 vector for semantic search), `ConversationDraft` (1:1 — the latest review-before-send AI reply draft, `status READY|DISMISSED|SENT|STALE`), `RiskAlert` (persistent alerts, unique `dedupeKey`), `EmailDigest` (weekly-send idempotency guard, unique `(userId, periodKey)`). `Conversation.awaitingReply` is a denormalized boolean (latest message is INBOUND) maintained on sync + reply, indexed for server-side filtering. Key unique constraints: `Integration(userId, type)`, `Conversation(integrationId, externalId)`, `Message(conversationId, externalId)`
- **Migrations are gitignored** (`/prisma/migrations` in `.gitignore`) — `schema.prisma` is the committed source of truth; apply locally with `prisma migrate dev` (the DB is the live record). (Heads-up: this contradicts the "migrations tracked" note under Key Decisions — reconcile when convenient.)

**AI provider layer** (`src/services/ai/`) — business logic never touches a vendor SDK directly:
- `types.ts` — `AiTextProvider` (structured JSON generation) + `AiEmbeddingProvider` (L2-normalized vectors) interfaces, `AiProviderError` with retryable classification
- `gemini.provider.ts` — the FREE default (AI Studio free tier): generation via `@google/generative-ai` responseSchema, embeddings via the REST batch endpoint (`gemini-embedding-001`, 768 dims). 429s → retryable errors so the job queue's backoff does rate-limit pacing
- `local.provider.ts` — deterministic heuristic fallback (en+ru keyword rules); keeps analysis working with NO API key, results tagged `provider:'local'` and labelled "Quick scan · offline mode" in the thread view
- `index.ts` — selection (`AI_PROVIDER=auto|gemini|local`) + high-level entry points: `analyzeConversationContent` (Gemini → local fallback on non-retryable errors), `generateReplyDraft` (reply/compose drafts with tone WARM|CONCISE|FORMAL|MATCH + steer hint), `summarizeThread` ("catch me up" → `{ tldr, keyPoints, openItems }`), `parseSearchQuery` (NL → structured filters, TTL-cached), `embedTexts`. Draft/summary/analysis share the `fallbackOnRetryable` contract (rethrow retryable so jobs back off; local fallback otherwise). Swapping in a paid provider = one new file implementing the interfaces

**Core services** (`src/services/`):
- `conversation.analyzer.ts` — orchestrates analysis: fetches conversation + messages from DB → `ai/` provider layer → upserts `ConversationAnalysis` (with `analysisData.provider` tag) → `priority.engine` → updates `Conversation.priority`
- `priority.engine.ts` — pure function; scores 0–100 and maps to `HOT | ATTENTION | COLD | SPAM` based on recency, inbound-awaiting-reply status, and AI risk level
- `search.service.ts` — hybrid AI search: AI query understanding (keywords + implied filters) → **SQL keyword candidates** (whole-table match across contact/subject/messages/summary) **unioned with** semantic cosine over a recency-bounded embedding universe (replaces the old top-400-by-priority cap, so relevant older/low-priority threads surface) → blended ranking. Pure scoring math lives in `search.ranking.ts` (`keywordScore`, `blendScore`, `applyBoosts`, `SEARCH_TUNING`, at-least filter maps) — extracted + testable. `buildWhere` is shared with `/api/conversations`. Degrades gracefully (no key → keyword-only, missing vectors → bounded backfill) and reports `meta.mode`/`meta.degraded`
- `draft.service.ts` — reply-draft orchestration: assembles thread + analysis + (for MATCH tone) the user's own recent sent-message style samples → `ai.generateReplyDraft`. `generateReplyDraftForConversation` backs the interactive `/draft` endpoint; `upsertAutoDraft` backs the `GENERATE_DRAFT` job (skips when not awaiting / no AI key / local fallback). `getReadyDraft` / `dismissDraft` / `markDraftSent` manage the `ConversationDraft` lifecycle. Drafts are ALWAYS review-before-send — never auto-sent
- `embedding.service.ts` — one vector per conversation (subject + contact + recent messages + AI summary) stored as Bytes; `contentHash` makes re-embedding idempotent. In-process cosine beats pgvector ops overhead at current scale; storage can be swapped later without touching the search API
- `alert.engine.ts` — pure rules over workspace data that consume the AI analysis output (risk/sentiment/reasons): ai-critical-risk, ai-high-risk, overdue-reply (24h/72h SLA), negative-sentiment, gone-quiet. Every candidate has an explainable reason + suggested action
- `alert.service.ts` — alert lifecycle: idempotent `scanRiskAlerts` upserts by `dedupeKey`, auto-resolves cleared conditions (`resolvedBy:'auto'`), reopens returning ones (user-resolved rows get a 7-day cooldown); `listRiskAlerts` / `setAlertStatus` back the API/UI
- `digest.service.ts` — weekly digest: builds real metrics (volumes, WoW deltas, avg reply time, alert engine output, top AI actions) → table-based HTML + plain-text email → sends via the user's own Gmail. Owner identity is `GMAIL_USER_EMAIL` (only that mailbox builds/receives digests). `EmailDigest` row is claimed BEFORE sending — duplicates are impossible across retries
- `gmail.service.ts` — `syncGmailForUser()` (incremental thread sync; maintains `Conversation.awaitingReply`), `sendGmailReply` (in-thread; clears `awaitingReply` + `markDraftSent`), `sendGmailMessage` (standalone multipart/alternative — used by the digest AND smart compose), token auto-refresh via the `tokens` event
- `metrics.helpers.ts` — `loadWorkspace(userId)` (one batched Prisma fetch: integration + conversations w/ analysis + 35d of message events + sync jobs) plus pure derivations (daily volume, reply pairs, engagement score, per-contact activity). Shared by the read-model services below AND the alert/digest services
- `dashboard.service.ts` — read-models for `/dashboard` (`getDashboardData`: exec stats, inbox-health score, command-center queue, risk clients, relationship health, activity timeline, smart insights), `/risk` (`getRiskOverview`) and `/insights` (`getInsightsFeed`). All relative-time strings are pre-formatted server-side to avoid hydration mismatches
- `analytics.service.ts` — `getAnalyticsData` for `/analytics`: response-time trend, volume series, priority/risk/sentiment distributions, inbound heatmap, top contacts
- `clients.service.ts` — `getClientDirectory` for `/clients`: one row per contact with engagement, max risk, latest sentiment, awaiting-reply flag

**Not yet wired up:** Gmail is the only functional ingestion channel. `TELEGRAM_API_ID/HASH` env vars and Telegram references in the UI/marketing/`types` are placeholders with no backing service. Risk-alert EMAIL notifications are still upcoming (alerts themselves are live in-app on `/risk`).

**Client state:** `src/stores/inbox.store.ts` — selected conversation in the inbox split-view; `src/stores/ui.store.ts` — command-palette open state (sidebar button + global Ctrl/⌘+K) AND the Smart Compose modal open state (`composeOpen`, opened from the inbox header + palette).

**Shared types:** `src/types/index.ts` — canonical TypeScript interfaces (`ConversationWithDetails`, `AnalysisResult`, `PriorityScoreResult`, `SyncResult`, etc.) used across services and components.

**Components:** `src/components/ui/` — primitive UI components (Button, Input, Avatar, PriorityBadge); `src/components/layout/` — Sidebar, Navbar, Footer; `src/components/auth/` — AuthForm; `src/components/marketing/` — landing page sections; `src/components/dashboard/` — platform widgets (StatCard, HealthRing, CommandCenter, RiskMonitor, RelationshipHealth, ActivityTimeline, SmartInsights, ClientsTable, WidgetShell, ModulePill, etc.); `src/components/charts/` — dependency-free SVG charts (AreaChart, Donut, HBars, WeekBars, Heatmap, `path.ts` math) animated with framer-motion; `src/components/CommandPalette.tsx` — global Ctrl/⌘+K palette (pages, actions incl. "Sync Gmail now" + "Compose new email", conversation search). Inbox AI surface: `Composer.tsx` (reply box with `✨ AI draft` + tone/steer/regenerate, pre-fills auto-drafts), `ThreadSummary.tsx` ("Catch me up" card on long threads), `ComposeModal.tsx` (Smart Compose: instruction → email), `ConversationList.tsx` (draft-ready badge + one-click `✨ Reply`).

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/conversations` | List + server-side filter/sort across all mail (`status`, `priority`, `channel`, `category`, `risk`, `sentiment`, `awaiting`, `daysBack`, `sort=priority\|recent\|oldest`, `limit`) |
| GET/PATCH/DELETE | `/api/conversations/[id]` | Single conversation |
| POST | `/api/conversations/[id]/analyze` | Trigger AI analysis |
| POST | `/api/conversations/[id]/reply` | Send a Gmail reply in-thread (ownership-checked) |
| POST/DELETE | `/api/conversations/[id]/draft` | Generate an AI reply draft (`{tone?, steer?}`) for review / dismiss the pending auto-draft |
| POST | `/api/conversations/[id]/summarize` | "Catch me up" thread summary (cached in `analysisData`) |
| GET | `/api/search` | Hybrid AI search (`q` may be natural language; filters: `status`, `priority`, `channel`, `risk`, `sentiment`, `awaiting`, `limit`) |
| POST | `/api/compose/draft` | Smart Compose: instruction → `{subject, body}` draft |
| POST | `/api/compose/send` | Send a brand-new email via the connected Gmail (`{to, subject?, body}`) |
| GET | `/api/alerts` | List risk alerts (`status=OPEN\|ACKNOWLEDGED\|RESOLVED\|all`; default OPEN+ACK) |
| PATCH | `/api/alerts/[id]` | Alert status transition (`{action: acknowledge\|resolve\|reopen}`) |
| POST | `/api/digest/send` | Send a digest preview now to `GMAIL_USER_EMAIL` (doesn't consume the Monday schedule) |
| POST | `/api/integrations/gmail/sync` | Enqueue a background Gmail sync job (returns `{ jobId }`, 202) |
| GET | `/api/jobs/[id]` | Poll background job status/result (owner-scoped) |
| GET/POST | `/api/jobs/process` | Drain the job queue; called by Vercel Cron (secret-protected) |
| POST | `/api/webhooks/gmail` | Gmail push receiver (Pub/Sub); enqueues incremental sync (token-protected) |
| GET/POST | `/api/cron/gmail` | Daily maintenance: safety sync, watch renewal, alert scan, embedding backfill, Monday digest enqueue (secret-protected) |
| GET/DELETE | `/api/integrations` | List or deactivate integrations |
| GET | `/api/auth/gmail` | Start Gmail OAuth flow |
| GET | `/api/auth/gmail/callback` | Gmail OAuth callback |

## Key Decisions

- **Monolith Next.js** (ADR-001): single repo, server route handlers instead of a separate API service; chosen for single-developer speed.
- **Prisma over raw SQL:** migrations tracked in `prisma/migrations/`; always run `prisma generate` after schema edits.
- **Two Supabase clients:** `supabase.ts` (browser) for client-side auth flows; `supabase-server.ts` (server, cookie-based) for Route Handlers and Server Components. Never use the browser client server-side.
- **Auth callback is a Route Handler** (`(auth)/callback/route.ts`): exchanges the PKCE code for a session server-side so the session cookie is set before the redirect to `/dashboard` (the post-login landing since the platform-dashboard rework; `(auth)/layout.tsx` and `AuthForm` redirect there too).
- **Dashboard pages query Prisma directly** (no `/api/dashboard/*` endpoints): `/dashboard`, `/analytics`, `/clients`, `/insights` and `/risk` are Server Components calling the read-model services, so widgets receive plain serialized props. The dashboard layout itself stays DB-query-free to keep navigation fast (see `getCurrentUser` header fast-path). Relative-time strings are formatted in the services — never call `Date.now()` formatting inside client components.
- **Small connection pool ⇒ sequential Prisma queries:** the runtime pool goes through Supabase's transaction pooler with a small `connection_limit`. Do NOT fan out Prisma queries with `Promise.all` in request paths — extra queries sit in Prisma's pool queue and time out under concurrent renders (P2024). `loadWorkspace()` runs its four queries sequentially (≤1 connection per request) and fetches messages by `conversationId IN (...)` to hit `@@index([conversationId, sentAt])`. `/dashboard` streams its data section via `<Suspense>` (static header paints first), degrades to `MetricsUnavailable` on DB errors, and `(dashboard)/error.tsx` is the boundary for every other dashboard page.
- **Module honesty policy:** every dashboard module carries a `ModulePill` status — `live` (real data), `beta`/`soon` (visually real but explicitly labelled, e.g. the AI Assistant shell). Don't ship unlabelled mock data into the dashboard. Heuristic (no-API-key) analyses are labelled "Quick scan · offline mode" in the thread view via `analysisData.provider`.
- **Free-tier AI by design:** all AI features run on the Gemini AI Studio free tier (generation + embeddings) behind the `src/services/ai/` provider interfaces, with a zero-cost local heuristic fallback. Paid providers (OpenAI/Anthropic/…) plug in later by implementing `AiTextProvider`/`AiEmbeddingProvider` in one file and setting `AI_PROVIDER` — business logic stays untouched.
- **Review-before-send drafts:** AI reply/compose drafts are NEVER auto-sent. `/draft` (interactive, `fallbackOnRetryable:true` so a quota blip still yields a labelled draft) fills the composer; auto-drafts (`GENERATE_DRAFT`) are gated to urgent awaiting threads + an AI key (no offline templates pre-baked), surfaced as a "draft ready" badge and pre-filled on open, then dismissed/marked-sent on the lifecycle. `local`-provider drafts/summaries are labelled "offline template/summary" in the UI (same honesty rule as analyses).
- **Background jobs** (`src/services/jobs/`): a durable Postgres `Job` queue decouples slow/expensive work from the request path. Jobs are claimed atomically via `SELECT … FOR UPDATE SKIP LOCKED` (FIFO on `runAfter, createdAt`), executed by `handlers.ts`, driven by `runner.ts`. Two interchangeable processors: the standalone `src/worker.ts` (`npm run worker`) and the cron-driven `/api/jobs/process`. Job types: `GMAIL_SYNC` → enqueues `ANALYZE_CONVERSATION` (auto-analyze) + `EMBED_CONVERSATION` per changed thread + one deduped `SCAN_RISK_ALERTS`; `ANALYZE_CONVERSATION` re-enqueues `EMBED_CONVERSATION` (summary changes the embedding text); `SEND_WEEKLY_DIGEST` is enqueued by the cron on Mondays (UTC), idempotent via the `EmailDigest` claim; `GENERATE_DRAFT` is enqueued from `ANALYZE_CONVERSATION` for HOT/ATTENTION awaiting threads (and a bounded cron backfill) → `upsertAutoDraft` stores a READY `ConversationDraft`.
- **Weekly digest identity = `GMAIL_USER_EMAIL`:** the digest is only built for the integration whose mailbox matches it, sent from that mailbox via the existing OAuth (`gmail.send` scope — no SMTP/extra env), to that same address. Manual sends (`POST /api/digest/send`, the `/insights` button) are previews and never consume the weekly slot.
- **Gmail sync is incremental** (`gmail.service.ts`): uses Gmail `historyId` (stored in `Integration.metadata.lastHistoryId`) for delta sync, with a bounded full-sync fallback when history expires; threads are fetched with bounded concurrency. OAuth tokens are encrypted at rest (`src/lib/crypto.ts`) and the connect flow is CSRF-protected with a `state` cookie.
- **Real-time ingestion via Gmail push** (Phase 3): on connect, `startGmailWatch` registers a `users.watch` on INBOX → Google Pub/Sub → push to `/api/webhooks/gmail`, which decodes `{ emailAddress, historyId }`, finds the integration by `metadata.email`, and enqueues an incremental `GMAIL_SYNC`. Watches expire ≤7 days and are renewed by the hourly `/api/cron/gmail`, which also enqueues a safety sync as a backstop. Requires a GCP Pub/Sub topic granting publish to `gmail-api-push@system.gserviceaccount.com` and a push subscription to the webhook URL with `?token=GMAIL_PUBSUB_VERIFICATION_TOKEN`. If `GMAIL_PUBSUB_TOPIC` is unset, the app falls back to cron polling only.
