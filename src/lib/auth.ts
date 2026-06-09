import { cache } from 'react'
import { headers } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { getSupabaseServerClient } from './supabase-server'

/**
 * Returns the current Supabase user for this server request.
 *
 * Fast path: the middleware (src/middleware.ts) already validated the session
 * with getUser() and forwarded the identity via x-user-* request headers. We
 * reconstruct the user from those headers — no network round-trip. This is what
 * makes navigation fast: without it, every dashboard render repeated the
 * middleware's getUser() call (~150–400ms each).
 *
 * Fallback: if the headers are absent (e.g. a route not behind the middleware,
 * or an unauthenticated request), we call getUser() directly.
 *
 * Still wrapped in React's cache() so layout + page + nested components in the
 * same render tree share one result.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const h = await headers()
  const id = h.get('x-user-id')

  if (id) {
    let userMetadata: Record<string, unknown> = {}
    const rawMeta = h.get('x-user-metadata')
    if (rawMeta) {
      try {
        userMetadata = JSON.parse(decodeURIComponent(rawMeta))
      } catch {
        // Malformed header — fall through with empty metadata.
      }
    }
    // Only the fields the dashboard reads (id / email / user_metadata) are
    // forwarded; cast to User since callers don't touch the rest.
    return {
      id,
      email: h.get('x-user-email') ?? undefined,
      user_metadata: userMetadata,
    } as unknown as User
  }

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
