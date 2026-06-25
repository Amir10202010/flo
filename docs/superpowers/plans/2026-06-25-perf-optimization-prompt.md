# Prompt — Velnox performance optimization

Paste this into a fresh Claude Code session (in the repo) when you're ready to tackle speed.

---

You are optimizing the performance of Velnox (Next.js 16 App Router · React 19 · Prisma 5 · Supabase Postgres · deployed on Vercel). The app feels slow on every page. Use `superpowers:systematic-debugging` discipline: **measure first, change second, prove the win with before/after numbers.** Do not guess-optimize.

## Observed symptoms (starting evidence)
- Pages and API routes take several seconds in `npm run dev`. Example: `GET /api/billing/checkout` logged `7.3s` application-code; first hit to a route adds a `next.js: Xs` compile cost.
- Occasional transient `PrismaClientKnownRequestError P1001: Can't reach database server at aws-1-ap-northeast-1.pooler.supabase.com:6543` that self-recovers on retry.
- Supabase DB is in region **ap-northeast-1 (Tokyo)**; the developer and deploy may be far from it. The runtime uses the Supabase **transaction pooler** (port 6543, `pgbouncer=true`, small `connection_limit`).

## Method (do these in order)
1. **Measure in production mode, not dev.** `next dev`/Turbopack recompiles routes on first hit and massively inflates timings — it is NOT representative. Build and run prod locally (`npm run build && npm run start`) or measure the real Vercel deployment. Record server response time (p50/p95) per key route: `/dashboard`, `/inbox`, `/clients`, `/analytics`, `/api/conversations`, `/api/billing/checkout`.
2. **Attribute the cost per slow route.** For each, determine whether the time is dominated by (a) DB round-trip latency, (b) the *number* of sequential queries, (c) data volume / serialization, (d) cold start, or (e) client render. Use `prisma:query` logs (count queries per request) and add temporary `Server-Timing` / `console.time` spans around DB calls vs. render.
3. **Test the locality hypothesis first** — it is the most likely single biggest factor. Cross-region DB access pays the full network RTT on *every* query. Confirm where Vercel runs the functions vs. where Supabase lives (Tokyo). If they're not co-located, that alone can turn a 5-query page into multiple seconds.

## Likely fix areas (validate each against measurements before applying)
- **Co-locate compute with the DB.** Pin Vercel function/region to the Supabase region (e.g. `nrt1` Tokyo) via `vercel.json` `regions` or route config — or move the Supabase project to a region near the users/deploy. Re-measure: this should drop per-query latency dramatically.
- **Cut sequential round-trips per request.** Audit `getOrgContext` (`src/lib/org.ts`, 1–2 queries), `getCurrentUser` (`src/lib/auth.ts`), and the dashboard read-models (`src/services/dashboard.service.ts`, `metrics.helpers.ts`). Combine where possible (single query with `include`/`select`, or a cached lookup). **Constraint:** the runtime pool is tiny — do NOT introduce `Promise.all` fan-out in request paths (see CLAUDE.md "Small connection pool ⇒ sequential Prisma queries"). The goal is *fewer* round trips, not parallel ones.
- **Cache hot, rarely-changing lookups.** Org membership / plan are read on most requests. `getOrgContext` is already React-`cache()`d per render; consider a short-TTL cache for the membership/plan lookup across requests if measurements show it's hot.
- **Connection resilience (the P1001).** Confirm the pooler params (`?pgbouncer=true&connection_limit=…&pool_timeout=…`). Note: a **free-tier Supabase project pauses after inactivity** and cold-starts on the next query — that produces exactly this transient P1001 + first-hit slowness. Check whether the project is free-tier/paused; if so, that explains both symptoms. Consider a tiny retry/backoff around transient P1001 in the Prisma layer only if it persists after locality is fixed.
- **Client weight.** Check heavy client bundles (framer-motion usage, large client components). Move static content to Server Components; lazy-load non-critical client widgets.
- **Indexes.** For any query that `EXPLAIN ANALYZE` shows as slow, add/verify the matching Prisma `@@index`. Most hot paths already have indexes (see `schema.prisma`) — only add where a measurement proves a gap.

## Constraints
- Keep the small-pool rule: no request-path `Promise.all` Prisma fan-out.
- Don't change behavior or break existing tests (`npm run test:billing`, `test:polar`, `test:agentic`, `test:classifier`, etc.) and `npx tsc --noEmit` must stay clean.
- Make one change at a time; re-measure after each.

## Deliverable
A short report: baseline numbers (prod), the dominant cause per route, the changes made, and after numbers proving the improvement. Plus any infra recommendation that needs the user (e.g., region move) called out explicitly.
