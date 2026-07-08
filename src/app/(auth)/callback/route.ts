import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { EmailOtpType } from '@supabase/supabase-js'
import { safeNextPath } from '@/lib/constants'

// Server-side handler for Supabase email flows: magic-link / OAuth (PKCE
// `code`), email confirmation and password recovery (`token_hash` + `type`).
//
// Why server-side instead of a client page:
// When signInWithOtp()/resetPasswordForEmail() run in the browser,
// @supabase/ssr stores the PKCE code verifier in document.cookie. When the
// link redirects back here with ?code=..., those cookies arrive in the HTTP
// request. The server reads the verifier from the request cookies and calls
// exchangeCodeForSession() successfully, then sets the session cookies on the
// response before redirecting.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNextPath(searchParams.get('next'))

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )

  // PKCE flow (magic link, OAuth).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  // Token-hash flow (email confirmation, password recovery, email change).
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  // Nothing to exchange — surface it rather than bouncing silently.
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Invalid or expired link. Please try again.')}`)
}
