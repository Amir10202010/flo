# Request-Access Gate — Testing-mode invite flow

**Date:** 2026-06-22
**Status:** Approved — ready for implementation

## Problem

The Gmail OAuth app is in Google **Testing** mode with restricted scopes
(`gmail.readonly`, `gmail.send`). Only emails on the Console "Test users" list
can complete the OAuth grant. A non-approved user who clicks **Connect** hits a
Google dead-end ("Access blocked: app is currently being tested") and is **not**
redirected back to the app — so a reactive "show a form on `?error=`" approach
cannot work.

We need a **proactive** invite gate: the user submits the Gmail they want to
connect, the owner gets notified, the owner manually adds that email to the
Console Test users, and tells the user. No browser automation of the Google
Console (fragile + ToS-risky) and no auto-approval.

## Goal

On `/integrations`, when Gmail is not connected, offer **Request access** as the
primary action. Submitting records the request and emails the owner
(`GMAIL_USER_EMAIL`) so they can add the user as a test user. A secondary
**"Already approved? Connect Gmail"** link preserves the existing OAuth path for
users the owner has already added.

## Non-goals (explicitly out of scope)

- Auto-adding users to Google Test users (the rejected browser-bot idea).
- SMS integration — the owner's phone number is shown to the user as plain text.
- Admin UI to list/approve requests (owner uses Prisma Studio + Google Console).
- Privacy Policy / Terms of Service pages (separate task; required later for
  Google verification).
- **Rich Gmail-style email rendering** in the inbox — a separate spec/feature
  that follows this one.

## Data flow

```
/integrations (Gmail not connected)
   ├─ [Request access]  → RequestAccessForm → POST /api/access-request
   │                         ├─ rate-limit (per user)
   │                         ├─ validate + normalize { email, note }
   │                         ├─ upsert AccessRequest (dedupe by email)
   │                         ├─ best-effort: email owner (GMAIL_USER_EMAIL)
   │                         └─ success state: "we'll email your account / or 8 700 160 1000"
   └─ [Already approved? Connect Gmail] → /api/auth/gmail (unchanged)
```

## Data model (one migration)

```prisma
model AccessRequest {
  id          String              @id @default(cuid())
  email       String              @unique   // requested Gmail, lowercased
  note        String?                        // optional message, capped at 500 chars
  status      AccessRequestStatus @default(PENDING)
  requestedBy String?                        // Supabase user id of the submitter
  notifiedAt  DateTime?                      // owner-email sent stamp (notify-once)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
}

enum AccessRequestStatus { PENDING APPROVED }
```

- `notifiedAt` is the notify-once guard: the owner email fires exactly once per
  pending request. No re-notify loop (YAGNI).
- `status APPROVED` is an optional record-keeping flag the owner can flip in
  Prisma Studio once they've added the email in the Console. Nothing in the app
  reads it yet.

## Components

### Pure logic — `src/lib/access-request.ts` (unit-tested)

- `validateAccessRequest(input: { email?: unknown; note?: unknown }): { ok: true; email: string; note: string | null } | { ok: false; error: string }`
  - trims + lowercases email, validates with a conservative email regex,
    rejects empty/oversized; trims note, nulls when empty, rejects > 500 chars.
- `shouldNotifyOwner(existing: { notifiedAt: Date | null } | null): boolean`
  - `true` when there is no existing row, or the existing row was never notified
    (`notifiedAt == null`).

### Orchestration — `src/services/access-request.service.ts`

- `submitAccessRequest({ email, note, requestedBy }): Promise<{ ok: true; duplicate: boolean }>`
  - read existing row by email → `upsert` (create or refresh note/requestedBy)
  - `duplicate = Boolean(existing)`
  - if `shouldNotifyOwner(existing)` → `notifyOwnerOfAccessRequest(record)`
    (best-effort: caught, never throws into the request path); on success stamp
    `notifiedAt`.
- `notifyOwnerOfAccessRequest(record): Promise<boolean>`
  - resolve owner email via `digestOwnerEmail()`; return `false` if unset.
  - find the owner's active GMAIL integration: the first active `GMAIL`
    integration whose `integrationEmail(i) === ownerEmail` (mirrors
    `notification.service`). Return `false` if none.
  - build a plain text + minimal HTML email and `sendGmailMessage(integration,
    { to: ownerEmail, subject, html, text })`. Subject:
    `New Velnox access request: <email>`. Body includes email, note, submitter
    id, timestamp, and a one-click link to
    `https://console.cloud.google.com/auth/audience?project=flo-ai-498805`.

### API — `src/app/api/access-request/route.ts`

`POST` only:
1. `getAuthUser()` → 401 if unauthenticated (page is behind `(dashboard)`).
2. `rateLimit(user.id, 'accessRequest')` → 429 if over.
3. parse JSON, `validateAccessRequest` → 400 with the error on failure.
4. `submitAccessRequest({ email, note, requestedBy: user.id })`.
5. `ok({ ok: true, duplicate })`.

Add `accessRequest: { limit: 5, windowMs: 60_000 }` to `RATE_LIMITS` in
`src/lib/ratelimit.ts`.

### UI — `src/app/(dashboard)/integrations/`

- New client component `RequestAccessForm.tsx`: Gmail input + optional note +
  submit; POSTs to `/api/access-request`; inline validation error; success state
  with the copy: *"Thanks — we'll email your account once you're approved. Need
  it faster? Message us at 8 700 160 1000."*
- `IntegrationsClient.tsx` (Gmail card, not-connected branch):
  - invite banner: *"Velnox is invite-only while we finish Google verification."*
  - primary action **Request access** (toggles the form), secondary small link
    **Already approved? Connect Gmail** → `/api/auth/gmail`.
  - keep the existing connected / syncing / disconnect states untouched.

## Error handling / edge cases

- Invalid email → 400 + inline form error.
- Owner integration missing or token expired → email send fails; the request is
  still recorded; log a warning; the user still sees success (owner can see the
  row in the DB).
- Duplicate (email already requested) → success, `duplicate: true`, no second
  email (`notifiedAt` guard).
- `sendGmailMessage` throws → caught in the service, submit still succeeds.

## Testing

`tsx` pure-logic script `scripts/access-request.check.ts`, wired as
`npm run test:access`, asserting:
- `validateAccessRequest`: valid email lowercased/trimmed; note trimmed/nulled;
  rejects bad email, empty email, note > 500.
- `shouldNotifyOwner`: `null` → true; `{ notifiedAt: null }` → true;
  `{ notifiedAt: Date }` → false.

Route + UI are not unit-tested (no framework in repo); verified via lint/build
and manual smoke.

## Verification

- `npx prisma migrate dev` applies cleanly; `prisma generate` succeeds.
- `npm run test:access` passes.
- `npm run lint` and `npm run build` pass.
- Manual: `/integrations` (no Gmail) shows the invite gate; submitting a request
  records a row and (with a connected owner mailbox) emails `GMAIL_USER_EMAIL`.
```
