import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from './supabase-server'
import type { User } from '@supabase/supabase-js'

/** Return a 200 JSON response. */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

/** Return an error JSON response with { error: string }. */
export function err(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * 402 response signalling the caller's plan lacks a feature. The `code` lets the
 * client intercept it (vs. a generic error) and show the Upgrade-to-Pro modal.
 */
export function upgradeRequired(message: string): NextResponse {
  return NextResponse.json({ error: message, code: 'upgrade_required' }, { status: 402 })
}

type AuthResult =
  | { user: User; error: null }
  | { user: null; error: NextResponse }

/**
 * Validates the session cookie and returns the Supabase user.
 * On failure returns a pre-built 401 NextResponse.
 *
 * Usage:
 *   const { user, error } = await getAuthUser()
 *   if (!user) return error
 */
export async function getAuthUser(): Promise<AuthResult> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: err('Unauthorized', 401) }
  return { user, error: null }
}
