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
```

No test suite is configured yet.

## Environment Variables

Populate `.env.local` before running the app:

```
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
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
```

## Architecture

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Prisma 5 · Supabase Postgres · Zustand · Tailwind CSS 4 · Deployed on Vercel.

**App Router layout:**
- `src/app/(auth)/` — login, signup, OAuth callback pages (unauthenticated shell); OAuth exchange is a Route Handler at `(auth)/callback/route.ts`, not a page
- `src/app/(dashboard)/` — inbox, integrations, settings behind the `DashboardLayout` with `Sidebar`
- `src/app/api/` — REST API route handlers (conversations CRUD, integrations, Gmail OAuth + sync)
- `src/app/page.tsx` — landing/marketing page

**Data layer:**
- `src/lib/prisma.ts` — singleton Prisma client (server-side only)
- `src/lib/supabase.ts` — browser Supabase client (uses `NEXT_PUBLIC_*` keys)
- `src/lib/supabase-server.ts` — server Supabase client built via `@supabase/ssr` + Next.js `cookies()`; used by all Route Handlers and Server Components
- `src/lib/auth.ts` — `getCurrentUser()` cached with React `cache()` to avoid duplicate round-trips per render tree; `src/lib/api.ts` — `getAuthUser()` / `ok()` / `err()` helpers for Route Handlers
- Prisma schema: `User → Integration → Conversation → Message` and `ConversationAnalysis` (1:1 with Conversation). Key unique constraints: `Integration(userId, type)`, `Conversation(integrationId, externalId)`, `Message(conversationId, externalId)`

**Core services** (`src/services/`):
- `gemini.service.ts` — calls Gemini API to produce `AnalysisResult` (currently a placeholder returning mock data; must be implemented before AI features work)
- `conversation.analyzer.ts` — orchestrates analysis: fetches conversation + messages from DB → `gemini.service` → upserts `ConversationAnalysis` → `priority.engine` → updates `Conversation.priority`
- `priority.engine.ts` — pure function; scores 0–100 and maps to `HOT | ATTENTION | COLD | SPAM` based on recency, inbound-awaiting-reply status, and AI risk level
- `gmail.service.ts` — `syncGmailForUser()` fetches up to 50 inbox threads via Google API, upserts `Contact` / `Conversation` / `Message` rows, and auto-refreshes OAuth tokens via the `tokens` event

**Not yet wired up:** Gmail is the only functional ingestion channel. `TELEGRAM_API_ID/HASH` env vars and Telegram references in the UI/marketing/`types` are placeholders with no backing service. `gemini.service.ts` returns mock data — implement it before AI analysis produces real results.

**Client state:** `src/stores/inbox.store.ts` — Zustand store tracking the selected conversation ID in the inbox split-view.

**Shared types:** `src/types/index.ts` — canonical TypeScript interfaces (`ConversationWithDetails`, `AnalysisResult`, `PriorityScoreResult`, `SyncResult`, etc.) used across services and components.

**Components:** `src/components/ui/` — primitive UI components (Button, Input, Avatar, PriorityBadge); `src/components/layout/` — Sidebar, Navbar, Footer; `src/components/auth/` — AuthForm; `src/components/marketing/` — landing page sections.

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/conversations` | List conversations (filter: `status`, `priority`, `channel`, `limit`) |
| GET/PATCH/DELETE | `/api/conversations/[id]` | Single conversation |
| POST | `/api/conversations/[id]/analyze` | Trigger AI analysis |
| POST | `/api/conversations/[id]/reply` | Send a Gmail reply in-thread (ownership-checked) |
| POST | `/api/integrations/gmail/sync` | Enqueue a background Gmail sync job (returns `{ jobId }`, 202) |
| GET | `/api/jobs/[id]` | Poll background job status/result (owner-scoped) |
| GET/POST | `/api/jobs/process` | Drain the job queue; called by Vercel Cron (secret-protected) |
| POST | `/api/webhooks/gmail` | Gmail push receiver (Pub/Sub); enqueues incremental sync (token-protected) |
| GET/POST | `/api/cron/gmail` | Hourly maintenance: safety sync + renew expiring watches (secret-protected) |
| GET/DELETE | `/api/integrations` | List or deactivate integrations |
| GET | `/api/auth/gmail` | Start Gmail OAuth flow |
| GET | `/api/auth/gmail/callback` | Gmail OAuth callback |

## Key Decisions

- **Monolith Next.js** (ADR-001): single repo, server route handlers instead of a separate API service; chosen for single-developer speed.
- **Prisma over raw SQL:** migrations tracked in `prisma/migrations/`; always run `prisma generate` after schema edits.
- **Two Supabase clients:** `supabase.ts` (browser) for client-side auth flows; `supabase-server.ts` (server, cookie-based) for Route Handlers and Server Components. Never use the browser client server-side.
- **Auth callback is a Route Handler** (`(auth)/callback/route.ts`): exchanges the PKCE code for a session server-side so the session cookie is set before the redirect to `/inbox`.
- **Background jobs** (`src/services/jobs/`): a durable Postgres `Job` queue decouples slow/expensive work (Gmail sync, Gemini analysis) from the request path. Jobs are claimed atomically via `SELECT … FOR UPDATE SKIP LOCKED` (`queue.ts`), executed by `handlers.ts`, and driven by `runner.ts`. Two interchangeable processors: the standalone `src/worker.ts` (`npm run worker`, for always-on hosts) and the cron-driven `/api/jobs/process` (Vercel Cron, secret-protected). Gmail sync enqueues an `ANALYZE_CONVERSATION` job per conversation with new inbound messages (**auto-analyze**).
- **Gmail sync is incremental** (`gmail.service.ts`): uses Gmail `historyId` (stored in `Integration.metadata.lastHistoryId`) for delta sync, with a bounded full-sync fallback when history expires; threads are fetched with bounded concurrency. OAuth tokens are encrypted at rest (`src/lib/crypto.ts`) and the connect flow is CSRF-protected with a `state` cookie.
- **Real-time ingestion via Gmail push** (Phase 3): on connect, `startGmailWatch` registers a `users.watch` on INBOX → Google Pub/Sub → push to `/api/webhooks/gmail`, which decodes `{ emailAddress, historyId }`, finds the integration by `metadata.email`, and enqueues an incremental `GMAIL_SYNC`. Watches expire ≤7 days and are renewed by the hourly `/api/cron/gmail`, which also enqueues a safety sync as a backstop. Requires a GCP Pub/Sub topic granting publish to `gmail-api-push@system.gserviceaccount.com` and a push subscription to the webhook URL with `?token=GMAIL_PUBSUB_VERIFICATION_TOKEN`. If `GMAIL_PUBSUB_TOPIC` is unset, the app falls back to cron polling only.
