import { cache } from 'react'
import { getSupabaseServerClient } from './supabase-server'

/**
 * Returns the current Supabase user for this server request.
 *
 * Wrapped in React's cache() so multiple server components in the same
 * render tree (layout + page + nested components) share a single round-trip.
 * Without this, every component calling getUser() independently adds ~300ms.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
