# Manual Steps

STEP 1: Provision Supabase
Goal: Create a Supabase project and obtain `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
Instructions:
- Go to https://app.supabase.com and create a project
- Get the connection string and API keys
Expected result: Project created; env vars available.
Verification: `DATABASE_URL` connects with `psql`.

STEP 2: Obtain Gemini API key
Goal: Add `GEMINI_API_KEY` to env.

STEP 3: Add required environment variables
Goal: Populate `.env.local` with required variables.

Required env vars:
- DATABASE_URL
- DIRECT_URL (optional)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- GEMINI_API_KEY
- TELEGRAM_API_ID
- TELEGRAM_API_HASH
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI
- GMAIL_USER_EMAIL
- NEXTAUTH_SECRET
- NEXT_PUBLIC_APP_URL

Expected result: App can connect to Supabase and external APIs.
Verification: `supabase` client initializes without error.
