# Velnox — Launch Checklist

Everything code can't do on its own, to get from "deployed" to "first paying
customer." Work top to bottom; the two tracks that gate revenue are **Polar**
(take payment) and **Google OAuth** (let a customer connect Gmail).

Placeholders shipped in the code that a human must replace:
- `SUPPORT_EMAIL` in `src/lib/constants.ts` → currently `hello@velnox.com`
- `[JURISDICTION — see LAUNCH_CHECKLIST.md]` in `src/app/(marketing)/terms/page.tsx`
- AI data-tier wording in `src/app/(marketing)/privacy/page.tsx` (see AI data-tier below)

---

## 1. Polar — accept payment (sandbox → production)

Pricing is defined in `src/lib/billing.ts`: **Pro $12/mo · $120/yr**,
**Team $40/mo · $400/yr**, **Business $120/mo · $1200/yr** (annual = 2 months
free). Free and Enterprise are not checkout products.

### 1a. Sandbox (verify the full flow first)
1. Create an organization on **sandbox.polar.sh**.
2. Create **6 products** — each plan × each period, priced exactly as above:
   - Pro Monthly ($12), Pro Annual ($120)
   - Team Monthly ($40), Team Annual ($400)
   - Business Monthly ($120), Business Annual ($1200)
3. For each product: **⋮ → Copy Product ID**. Map them to env:
   - `POLAR_PRODUCT_PRO_MONTHLY`, `POLAR_PRODUCT_PRO_ANNUAL`
   - `POLAR_PRODUCT_TEAM_MONTHLY`, `POLAR_PRODUCT_TEAM_ANNUAL`
   - `POLAR_PRODUCT_BUSINESS_MONTHLY`, `POLAR_PRODUCT_BUSINESS_ANNUAL`
4. Create an **Organization Access Token** → `POLAR_ACCESS_TOKEN`. Scopes:
   `products:read`, `checkouts:write`, `customer_portal:write`, `subscriptions:read`.
5. Create a **Webhook** pointing at `https://<your-app>/api/webhooks/polar`,
   format **Raw**. Copy the **signing secret** → `POLAR_WEBHOOK_SECRET`.
   Subscribe these events:
   `subscription.created`, `subscription.updated`, `subscription.active`,
   `subscription.canceled`, `subscription.revoked`, `order.created`,
   `customer.state_changed`.
6. Set `POLAR_SERVER=sandbox`.
7. **Test purchase:** card `4242 4242 4242 4242`, any future expiry, any CVC.
   Confirm the `Subscription` row updates in the DB and the webhook **delivery
   log shows 2xx**. Then test cancel via the customer portal.

### 1b. Production
1. Separate organization on **polar.sh** (production is a different org/domain).
2. Recreate the **6 products** — these get **new Product IDs**; update the
   `POLAR_PRODUCT_*` env in Vercel with the production IDs.
3. New **production access token** → `POLAR_ACCESS_TOKEN`.
4. Set `POLAR_SERVER=production`.
5. New **production webhook** to `/api/webhooks/polar` (Raw) → new
   `POLAR_WEBHOOK_SECRET`.
6. Do one **real card test purchase + refund** end to end.

### 1c. Payment link (take money before the in-app button is fully proven)
- In Polar → the Pro product → **Share** → create a shareable checkout link.
- You can hand this to your first customer directly while the in-app "Get Pro"
  path is being verified.

### Common Polar mistakes
- **Token/server mismatch** → `401`. A sandbox token with `POLAR_SERVER=production`
  (or vice-versa) fails.
- **`POLAR_SERVER` defaults to production** if unset — set it explicitly.
- **Wrong webhook secret** or verifying against a parsed body instead of the
  **raw** request body → `403` / signature failure.
- **Sandbox product IDs left in the production env** → checkout can't find the product.

---

## 2. Google OAuth — let customers connect Gmail

Right now the OAuth app is in **Testing** mode, so anyone not on the test-user
list hits **"Access blocked: Velnox is currently being tested."** This is the
#1 blocker to onboarding a real customer.

### 2a. Immediately (unblocks the next customer)
- Google Cloud Console → **APIs & Services → OAuth consent screen → Test users**
  → add the customer's Gmail address (limit: 100 test users).
- Record a ~40-second Loom showing the customer how to pass the unverified
  screen: **Advanced → "Go to Velnox (unsafe)"** → grant access.

### 2b. In the background (the real fix — Track #1, takes weeks)
- Submit the app for **OAuth verification** (Publish to Production). Because we
  use the **restricted** scopes `gmail.readonly` and `gmail.send`, this requires:
  - **Brand verification** (domain ownership, homepage, privacy policy URL).
  - A **CASA security assessment** by a Google-approved third party.
- Expect multiple weeks. Start now; it runs in parallel with everything else.

---

## 3. Domain / mailbox / legal entity

- **Mailbox:** set up `hello@velnox.com` (or your real domain) and point MX.
  Then update `SUPPORT_EMAIL` in `src/lib/constants.ts` — it feeds the footer,
  contact page, and the privacy/terms contact lines.
- **Legal entity:** register the company, then:
  - Replace `[JURISDICTION — see LAUNCH_CHECKLIST.md]` in
    `src/app/(marketing)/terms/page.tsx` with the real governing-law jurisdiction.
  - Put the registered company name in the footer / terms as needed.

---

## 4. AI data-tier (before scaling)

Velnox currently runs on the **free Gemini API tier (Google AI Studio)**, whose
terms allow Google to use submitted content to improve its products/models. The
privacy policy (`src/app/(marketing)/privacy/page.tsx`, "AI processing of email
content") now states this truthfully. **Before scaling**, migrate AI to a
no-training paid tier (**Vertex AI** or the paid Gemini API), then update that
privacy section to reflect the stronger data terms. (Search the codebase for the
`TODO: migrate AI to a no-training paid tier` marker.)

---

## 5. PostHog (product analytics)

- Create a PostHog project (US or EU cloud).
- Set `NEXT_PUBLIC_POSTHOG_KEY` (and `NEXT_PUBLIC_POSTHOG_HOST`, default
  `https://us.i.posthog.com`) in Vercel production env.
- Without a key, the app runs normally and simply sends no events. Events already
  instrumented: `pricing_viewed`, `plan_cta_clicked`, `checkout_started`,
  `signup_submitted`, `gmail_connect_clicked`.

---

## 6. Vercel production environment variables

Set all of these in the Vercel project (Production scope). See `.env.example`
for the full template with formats.

**New / launch-critical**
- `POLAR_ACCESS_TOKEN` (production token)
- `POLAR_SERVER=production`
- `POLAR_WEBHOOK_SECRET` (production webhook secret)
- `POLAR_PRODUCT_PRO_MONTHLY`, `POLAR_PRODUCT_PRO_ANNUAL`
- `POLAR_PRODUCT_TEAM_MONTHLY`, `POLAR_PRODUCT_TEAM_ANNUAL`
- `POLAR_PRODUCT_BUSINESS_MONTHLY`, `POLAR_PRODUCT_BUSINESS_ANNUAL`
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`

**Existing required (already needed to run)**
- `DATABASE_URL`, `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (+ optional `GEMINI_MODEL`, `AI_PROVIDER`, `AI_EMBEDDING_MODEL`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `GMAIL_USER_EMAIL` (must equal the connected mailbox, not your login email)
- `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `TOKEN_ENCRYPTION_KEY`
- `CRON_SECRET`, `WORKER_SECRET`
- `GMAIL_PUBSUB_TOPIC`, `GMAIL_PUBSUB_VERIFICATION_TOKEN` (optional — Gmail push)

> `NEXT_PUBLIC_APP_URL` also feeds `robots.txt`, `sitemap.xml`, OpenGraph
> `metadataBase`, and the checkout/callback redirects — set it to the real
> production URL.

---

## 7. Manual QA before announcing

Walk the whole path on production:

- [ ] Sign up → receive confirmation email → confirm → land in the app
- [ ] Log in, log out (from the **sidebar** and from Settings)
- [ ] Forgot password → receive email → reset → sign in with the new password
- [ ] Connect Gmail (with an allowlisted test user) → threads import
- [ ] Open a thread → generate an AI draft → send the reply
- [ ] Assign a thread, change its status, add an internal note
- [ ] Invite a second user; confirm their role/permissions
- [ ] Click **Get Pro** while logged out → lands on **/signup?next=…** → after
      signup, resumes checkout → pay → plan upgrades → a Pro-gated feature unlocks
- [ ] Cancel via the Polar **Customer Portal** → status reflects in the app
- [ ] Hit a bad URL → branded **404**; trigger an error → branded error screen
- [ ] Landing + pricing look right on **mobile**
- [ ] `/robots.txt` and `/sitemap.xml` load; a shared link shows the OG image
