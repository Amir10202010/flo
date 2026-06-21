import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Fixed-window rate limiting, backed by Postgres.
 *
 * Why the DB and not an in-memory map: on Vercel every request can land on a
 * different serverless instance (and region), each with its own memory — an
 * in-process counter would let a caller multiply their quota by the instance
 * count. A single shared counter row is the only correct place at this tier
 * without standing up Redis/Upstash. Each check is ONE atomic upsert.
 *
 * Fails OPEN: if the limiter query itself errors we allow the request. A
 * limiter outage must never take down legitimate traffic — the DB being down
 * means the request was going to fail anyway.
 */

export interface RateLimitConfig {
  /** Max requests allowed within the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

/**
 * Per-route limits. Tuned per cost/abuse profile, keyed by a short bucket name.
 * AI/generation routes are the expensive ones (free-tier quota); send routes
 * are the abuse-sensitive ones (Gmail relay). GET/list routes are looser.
 */
export const RATE_LIMITS = {
  assistant:    { limit: 15, windowMs: 60_000 },        // grounded Q&A (LLM call)
  assistantAct: { limit: 30, windowMs: 60_000 },        // confirmed action execution
  composeDraft: { limit: 15, windowMs: 60_000 },        // smart-compose draft (LLM)
  composeSend:  { limit: 20, windowMs: 60 * 60_000 },   // send NEW mail — cap relay abuse
  reply:        { limit: 40, windowMs: 60 * 60_000 },   // send in-thread reply
  draft:        { limit: 30, windowMs: 60_000 },        // interactive reply draft (LLM)
  analyze:      { limit: 30, windowMs: 60_000 },        // on-demand analysis (LLM)
  summarize:    { limit: 30, windowMs: 60_000 },        // catch-me-up (LLM)
  search:       { limit: 45, windowMs: 60_000 },        // hybrid search (LLM + embed)
  sync:         { limit: 12, windowMs: 60_000 },        // manual Gmail sync trigger
  digestSend:   { limit: 5,  windowMs: 60 * 60_000 },   // manual digest preview (sends mail)
  notes:        { limit: 60, windowMs: 60_000 },        // contact-note writes
  mutate:       { limit: 90, windowMs: 60_000 },        // alert/reminder/category/settings writes
} satisfies Record<string, RateLimitConfig>

export type RateLimitBucket = keyof typeof RATE_LIMITS

export interface RateLimitResult {
  ok: boolean
  remaining: number
  limit: number
  /** Milliseconds until the current window resets. */
  resetMs: number
}

/**
 * Atomically increment the counter for `key`, resetting the window in-place
 * when it has expired. Returns whether the caller is still within `limit`.
 */
export async function consumeRateLimit(
  key: string,
  { limit, windowMs }: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now()
  const cutoff = new Date(now - windowMs)
  try {
    // One statement, race-free: INSERT a fresh counter, or on key conflict
    // either reset (window expired) or increment (still inside the window).
    const rows = await prisma.$queryRaw<{ count: number | bigint; windowStart: Date }[]>(Prisma.sql`
      INSERT INTO "RateLimit" ("key", "count", "windowStart", "updatedAt")
      VALUES (${key}, 1, now(), now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN now() ELSE "RateLimit"."windowStart" END,
        "updatedAt" = now()
      RETURNING "count", "windowStart";
    `)
    const row = rows[0]
    const count = row ? Number(row.count) : 1
    const windowStart = row ? new Date(row.windowStart).getTime() : now
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      resetMs: Math.max(0, windowStart + windowMs - now),
    }
  } catch (e) {
    // Fail open — never block real traffic because the limiter hiccuped.
    console.error('[ratelimit] check failed, allowing request:', e)
    return { ok: true, remaining: limit, limit, resetMs: 0 }
  }
}

/**
 * Route-handler guard. Returns a ready-to-return 429 `NextResponse` (with a
 * `Retry-After` header) when the caller is over the limit, or `null` when the
 * request may proceed.
 *
 *   const limited = await rateLimit(user.id, 'assistant')
 *   if (limited) return limited
 */
export async function rateLimit(identity: string, bucket: RateLimitBucket): Promise<NextResponse | null> {
  const result = await consumeRateLimit(`${bucket}:${identity}`, RATE_LIMITS[bucket])
  if (result.ok) return null

  const retryAfter = Math.max(1, Math.ceil(result.resetMs / 1000))
  return NextResponse.json(
    { error: 'Too many requests — please slow down and try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
      },
    },
  )
}
