import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side handler for the Supabase magic-link callback.
//
// Why server-side instead of a client page:
// When signInWithOtp() runs in the browser, @supabase/ssr stores the PKCE
// code verifier in document.cookie. When the magic link redirects back to
// /callback?code=..., those cookies arrive in the HTTP request. The server
// can read the verifier from the request cookies and call
// exchangeCodeForSession() successfully.
//
// The previous client-side approach failed because a new JavaScript context
// (new page load / email WebView) couldn't reliably read the verifier from
// storage — especially when the link was opened via an email client or on a
// different browser context on the same device.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Hard redirect — the session cookies are now set in the response,
      // and /inbox will receive them on the fresh server request.
      return NextResponse.redirect(`${origin}/inbox`)
    }
  }

  // No code param, or exchange failed — send back to login.
  return NextResponse.redirect(`${origin}/login`)
}
