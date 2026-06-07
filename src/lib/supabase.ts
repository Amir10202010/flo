import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client. Stores session in cookies (not localStorage)
// so the server-side client in supabase-server.ts can read the same session.
export function getSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
