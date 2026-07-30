<div align="center">

# Velnox

**Stop losing clients in your inbox.**

Velnox reads your Gmail and tells you which client to answer today, who's going cold,
and what to say — with the reply already drafted.

[Live app](https://flo-one-theta.vercel.app) · [Architecture notes](CLAUDE.md) · [Knowledge Base design](docs/superpowers/specs/2026-07-16-knowledge-base-design.md)

![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-087ea4?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2d3748?logo=prisma&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e?logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/AI-Gemini%20free%20tier-4285f4?logo=googlegemini&logoColor=white)

</div>

---

## The problem

Freelancers and small agencies rarely lose a client because the work was bad. They lose them
because a thread got buried under newsletters, nobody replied for nine days, and by then the
client had quietly moved on.

Every CRM's answer is "migrate your whole workflow into our tool." Velnox's answer is: **stay in
the mailbox you already use.** Velnox connects to Gmail read-only-plus-send, and becomes the
triage-and-memory layer on top of it — no new inbox, no data entry, no migration.

## What it does

| | |
|---|---|
| **Triage that explains itself** | Every thread is scored 0–100 and bucketed `HOT / ATTENTION / COLD / SPAM` from recency, who owes whom a reply, and the AI's risk read — with the reason shown, never a bare number. |
| **Risk alerts** | Rule engine over the AI output: critical/high risk, overdue reply (24h/72h SLA), negative sentiment, gone quiet. Deduped, snoozable, auto-resolved when the condition clears, and emailed to you at most once per alert. |
| **Drafts you approve** | `✨ AI draft` writes the reply in your own voice (tone: warm / concise / formal / match-my-style, plus a steer hint). Urgent threads get a draft prepared in the background. **Nothing is ever auto-sent.** |
| **Search that understands intent** | "who did I ghost last week" works: the query is parsed into filters, then keyword SQL is unioned with semantic cosine over conversation embeddings and blended into one ranking. |
| **A knowledge base that builds itself** | People, companies and topics become a graph from your mail, calendar and notes. Deterministic edges (works-at, attended-with) are drawn solid; AI-inferred ones dashed and labelled as suggestions — you always know which is which. |
| **Meeting briefs and debriefs** | Before: a brief from real relationship history. After: paste the transcript → summary, decisions, action items, each one click away from becoming a reminder. |
| **A grounded assistant** | Ask about your workspace and get an answer with citations, restricted to threads it actually surfaced. It may *propose* one action — queue drafts, triage an alert, set a reminder — which only runs after you confirm. |
| **Weekly digest** | Real metrics (volume, week-over-week deltas, average reply time, top AI actions) mailed from your own mailbox every Monday. |

## How it's built

Single Next.js App Router monolith — server route handlers instead of a separate API service,
chosen for one-developer speed.

```
src/app/(dashboard)/    the platform shell — dashboard, inbox, clients, knowledge,
                        meetings, insights, risk, analytics, assistant, settings
src/app/api/            REST route handlers (see the table in CLAUDE.md)
src/services/           all business logic
  ai/                   provider interfaces — Gemini + a local heuristic fallback
  jobs/                 durable Postgres job queue (FOR UPDATE SKIP LOCKED)
  *.service.ts          read-models: dashboard, analytics, clients, search, knowledge…
  *.engine.ts           pure scoring/rules — priority, alerts (unit-testable)
prisma/schema.prisma    the committed source of truth for the schema
```

A few decisions worth calling out:

- **The AI layer is an interface, not an SDK call.** Business logic never imports a vendor SDK.
  Everything runs on the Gemini AI Studio **free tier** behind `AiTextProvider` /
  `AiEmbeddingProvider`, and there's a deterministic keyword fallback so the app still works with
  **no API key at all** — those results are labelled "Quick scan · offline mode" in the UI rather
  than passed off as real analysis. Swapping in a paid provider is one new file.
- **Slow work never blocks a request.** Sync, analysis, embeddings, drafts, alert scans and emails
  are rows in a Postgres `Job` table, claimed atomically and drained by either a standalone worker
  or a Vercel Cron endpoint. Rate-limit errors come back classified as retryable, so the queue's
  backoff *is* the pacing strategy.
- **The model stays outside the trust boundary.** It proposes; deterministic, user-scoped code
  executes — and only after an explicit confirm. Every action is bounded and reversible, and none
  of them can send mail.
- **Real-time in, incremental always.** Gmail `users.watch` → Pub/Sub → webhook → incremental
  `historyId` delta sync, with a bounded full-sync fallback when history expires and a cron safety
  net if push is not configured.
- **Honest modules.** Every dashboard widget carries a `live` / `beta` / `soon` pill. No unlabelled
  mock data ships to a page that looks real.

## Getting started

**Prerequisites:** Node 20+, a Supabase Postgres database, a Google Cloud OAuth client with the
Gmail + Calendar read scopes, and (optionally) a free Gemini AI Studio key.

```bash
git clone https://github.com/Amir10202010/flo.git
cd flo
npm install
cp .env.example .env.local   # then fill it in — every variable is documented there
npx prisma migrate dev       # apply the schema
npm run dev                  # http://localhost:3000
```

In a second terminal, drain the background queue:

```bash
npm run worker
```

Without `GEMINI_API_KEY` the app still runs — analysis, search and summaries fall back to the local
heuristic provider and say so in the UI.

## Tests

No framework; the pure logic is covered by `tsx` check scripts, each runnable on its own:

```bash
npm run test:knowledge   # fact dedupe, mention resolution, KNOWS pairs, recall + search scoring
npm run test:agentic     # notification throttle/render, assistant action parse + validate
npm run test:classifier  # email category classifier
npm run test:billing     # plan limits and feature gates
```

## Status

Early access. Gmail is the only live ingestion channel — the Telegram references in the UI are
placeholders with no backing service yet, and meeting capture is paste-a-transcript (per-provider
bot capture is a future seam behind `Meeting.provider`). Billing runs through Polar.sh with the
database as the source of truth.

---

Built by [Amirkhan Sagindikov](https://github.com/Amir10202010).
Public for portfolio and review purposes — not an open-source license; all rights reserved.
