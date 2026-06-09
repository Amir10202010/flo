import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Identity headers forwarded to Server Components so they don't have to call
// supabase.auth.getUser() a SECOND time (see getCurrentUser in @/lib/auth).
const ID_HEADER = 'x-user-id'
const EMAIL_HEADER = 'x-user-email'
const META_HEADER = 'x-user-metadata'

/**
 * Validates + refreshes the Supabase session once per navigation, then forwards
 * the validated identity to the render via request headers. This removes the
 * redundant second getUser() network round-trip that getCurrentUser() used to
 * make in the dashboard layout (~150–400ms saved on every navigation).
 *
 * Security: any client-supplied x-user-* headers are stripped first, and the
 * trusted values are only set AFTER getUser() validates — so they can't be
 * spoofed. API routes are excluded (matcher) and keep their own getAuthUser().
 */
export async function middleware(request: NextRequest) {
  // Strip incoming identity headers so a client can't forge them.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(ID_HEADER)
  requestHeaders.delete(EMAIL_HEADER)
  requestHeaders.delete(META_HEADER)

  // Prefetch requests must stay cheap: they never need to rotate the session
  // cookie, so skip the auth round-trip entirely. The eventual real navigation
  // (or the prefetched render's own fallback) handles validation.
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch' ||
    request.headers.get('sec-purpose')?.includes('prefetch') === true

  if (isPrefetch) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Collect any cookies Supabase wants to rotate so we can re-apply them to the
  // final response (which is rebuilt after we know the user).
  const cookiesToForward: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToForward.push(...cookiesToSet as typeof cookiesToForward)
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    requestHeaders.set(ID_HEADER, user.id)
    if (user.email) requestHeaders.set(EMAIL_HEADER, user.email)
    requestHeaders.set(META_HEADER, encodeURIComponent(JSON.stringify(user.user_metadata ?? {})))
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  cookiesToForward.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}

export const config = {
  matcher: [
    // Exclude static assets, images, favicon, AND api routes.
    // API routes handle their own auth via getAuthUser() in @/lib/api.
    '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
