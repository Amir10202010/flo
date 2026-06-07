# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Next.js dev server
npm run build     # Production build
npm run lint      # ESLint check
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

**Client state:** `src/stores/inbox.store.ts` — Zustand store tracking the selected conversation ID in the inbox split-view.

**Shared types:** `src/types/index.ts` — canonical TypeScript interfaces (`ConversationWithDetails`, `AnalysisResult`, `PriorityScoreResult`, `SyncResult`, etc.) used across services and components.

**Components:** `src/components/ui/` — primitive UI components (Button, Input, Avatar, PriorityBadge); `src/components/layout/` — Sidebar, Navbar, Footer; `src/components/auth/` — AuthForm; `src/components/marketing/` — landing page sections.

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/conversations` | List conversations (filter: `status`, `priority`, `channel`, `limit`) |
| GET/PATCH/DELETE | `/api/conversations/[id]` | Single conversation |
| POST | `/api/conversations/[id]/analyze` | Trigger AI analysis |
| GET/DELETE | `/api/integrations` | List or deactivate integrations |
| POST | `/api/integrations/gmail/sync` | Sync Gmail inbox |
| GET | `/api/auth/gmail` | Start Gmail OAuth flow |
| GET | `/api/auth/gmail/callback` | Gmail OAuth callback |

## Key Decisions

- **Monolith Next.js** (ADR-001): single repo, server route handlers instead of a separate API service; chosen for single-developer speed.
- **Prisma over raw SQL:** migrations tracked in `prisma/migrations/`; always run `prisma generate` after schema edits.
- **Two Supabase clients:** `supabase.ts` (browser) for client-side auth flows; `supabase-server.ts` (server, cookie-based) for Route Handlers and Server Components. Never use the browser client server-side.
- **Auth callback is a Route Handler** (`(auth)/callback/route.ts`): exchanges the PKCE code for a session server-side so the session cookie is set before the redirect to `/inbox`.
- The Gemini integration is a **placeholder stub** — `gemini.service.ts` must be implemented with real API calls before AI features work.
