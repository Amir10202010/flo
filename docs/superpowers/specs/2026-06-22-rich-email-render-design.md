# Rich Email Render — Gmail-style messages in a sandboxed iframe

**Date:** 2026-06-22
**Status:** Approved — ready for implementation

## Problem

Inbox messages render as a style-free, structural-only subset. Two causes:

1. **Ingestion discards HTML.** `gmail.service.ts` `extractBody()` collects both
   the `text/plain` and `text/html` parts but returns plain text (or
   `htmlToText(html)`), storing every message as `contentType: 'TEXT'`.
2. **The renderer is deliberately style-free.** `sanitizeMessageHtml`
   (`src/lib/sanitize-email.ts`) allows a tiny tag set and no attributes except
   `href`, so even real HTML would render without colors/tables/images.

Goal: messages look like they do in Gmail (tables, colors, buttons, images),
rendered safely.

## Decisions (locked)

- **Going-forward only** — new mail stores HTML; already-synced `TEXT` messages
  keep the current inline render. No re-sync/backfill.
- **Block remote images by default** + a "Show images" toggle (Gmail behavior).
  No image proxy.
- **Layout-rich sanitizer** — tables, images, presentation attributes, and a
  CSS-allowlisted inline `style`. No `<style>`/stylesheet support in v1 (inline
  only).

## Architecture

```
Gmail sync ──> extractBody() ──> { content: text, html: string|null }
                                       │
                          Message.content (text, unchanged)
                          Message.contentHtml (raw HTML, new column)

Inbox thread (server component)
  per message:
    contentHtml present ─> sanitizeEmailRich(html) ─> { html (img src→data-src), hasImages }
                              └─> <EmailFrame html hasImages />   (client, sandboxed iframe)
    else ───────────────> sanitizeMessageHtml(content)  (existing inline render)
```

### 1. Storage — new column (isolation)

HTML goes in a **new nullable column `Message.contentHtml`**; `content` stays
plain text. Rationale: `content` is consumed by analysis, embeddings, search,
and `messagePreview` — none should see HTML. A separate column means **zero
ripple** to those pipelines.

```prisma
model Message {
  ...
  content        String
  contentHtml    String?      // raw email HTML when the message had a text/html part
  contentType    ContentType  @default(TEXT)
  ...
}
```

Migration: add `contentHtml`.

### 2. Ingestion — `gmail.service.ts`

- `extractBody(payload)` returns `{ content: string; html: string | null }`
  (it already walks both parts internally):
  - `html` = the `text/html` part if non-empty, else `null`
  - `content` = the `text/plain` part if non-empty, else `htmlToText(html)`, else `''`
- `ParsedMessage` gains `html: string | null`.
- On insert: `content` sliced to 5000 (as today); `contentHtml = html ? html.slice(0, 200_000) : null`;
  `contentType = html ? 'HTML' : 'TEXT'`.
- Outbound sends (reply/compose) keep storing `content` as text — `contentHtml`
  stays null there (no behavior change).

### 3. Sanitizer — `sanitizeEmailRich()` (server-only, in `sanitize-email.ts`)

New export alongside `sanitizeMessageHtml`. Built on `sanitize-html`:

- **Tags** add: `table thead tbody tfoot tr td th caption colgroup col img
  figure figcaption font center small big sub sup dl dt dd` (on top of the
  existing structural/formatting set).
- **Attributes**: presentation attrs (`width height align valign bgcolor color
  face size cellpadding cellspacing border colspan rowspan`) on the relevant
  tags; `style` on most; `src alt title` on `img`; `href` on `a` (as today).
- **`allowedStyles`** — a property allowlist with value regexes: `color`,
  `background`, `background-color`, `font*`, `text-align`, `text-decoration`,
  `padding*`, `margin*`, `border*`, `width`, `max-width`, `height`,
  `line-height`, `vertical-align`, `display` (limited). Anything else (incl.
  `position`, `z-index`) is dropped; `javascript:`/`expression`/`url(...)` never
  pass the value regexes.
- **Images** via `transformTags.img`: move `src` → `data-src` (so nothing loads)
  and keep safe `alt`/dimensions. Track whether any image existed.
- **Drop with contents**: `script style iframe object embed svg math head title
  noscript` (as today). Links keep `target=_blank` + `rel` hardening.
- Input is capped (~200KB) before parsing to bound CPU.
- Returns `{ html: string; hasImages: boolean }`.

The single sanitized HTML carries images as `data-src`. The client restores
`data-src` → `src` on "Show images" — safe because sanitization already ran.

### 4. Render — `EmailFrame.tsx` (client component)

Props: `html: string` (already sanitized), `hasImages: boolean`.

- Renders `<iframe srcDoc={doc}
  sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox">`.
  **No `allow-scripts`** → nothing in the frame executes; `allow-same-origin`
  (safe without scripts) only lets the parent measure height.
- `doc` wraps the body with `<base target="_blank">`, base typography, and a CSP
  `<meta>`: `default-src 'none'; img-src https: data:; style-src 'unsafe-inline';
  font-src https: data:` — defense in depth over the sandbox.
- Auto-height: on `load`, read `contentDocument.body.scrollHeight` and set the
  iframe height; re-measure after toggling images.
- "Show images" button (only when `hasImages`): swaps `data-src`→`src` in the
  doc string and re-renders the iframe (fires `load` again → re-measure).

### 5. Inbox wiring — `inbox/[id]/page.tsx` (server component)

Per message: if `msg.contentHtml` → `sanitizeEmailRich` on the server, render
`<EmailFrame .../>` full-width (no chat bubble chrome for HTML emails, light
container). Else → existing inline `sanitizeMessageHtml(msg.content)` path
unchanged. Ensure the message query selects `contentHtml`.

### 6. CSS — `globals.css`

`.email-frame { width:100%; border:0; background:#fff; border-radius:12px; }`
plus a small wrapper for the optional "Show images" bar. Minimal.

## Testing

`tsx` pure-logic `scripts/email-render.check.ts`, wired as `npm run test:email`:
- strips `<script>`, inline event handlers (`onerror=`), `javascript:` href,
  `position:fixed`/disallowed style props;
- keeps `<table>` structure and allowed inline styles (e.g. `color`,
  `text-align`);
- moves `<img src>` → `data-src` and reports `hasImages: true`; `hasImages:
  false` when there are no images.

Renderer/iframe + inbox wiring are not unit-tested (no DOM test framework);
verified via lint/build and manual smoke.

## Error handling / edge cases

- Oversized/malformed HTML: cap input ~200KB before sanitizing; `sanitize-html`
  tolerates malformed markup.
- `contentHtml` present but sanitizes to empty → fall back to the text render.
- Existing rows (no `contentHtml`) → unchanged inline render.

## Non-goals (v1)

- `<style>`/stylesheet (class-based) CSS — inline `style` only (v1.1).
- Image proxy / tracking-pixel stripping beyond block-by-default.
- Backfill/re-sync of already-stored `TEXT` messages.
- Attachment rendering.

## Verification

- `npx prisma migrate dev` applies; `prisma generate` succeeds.
- `npm run test:email` passes.
- `npm run lint` and `npm run build` pass.
- Manual: a synced HTML email renders styled in the iframe; remote images are
  blocked until "Show images"; links open in a new tab; old text messages and
  the composer are unaffected.
