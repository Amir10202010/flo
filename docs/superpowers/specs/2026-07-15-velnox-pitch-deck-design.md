# Velnox — 6-Slide Investor/Mentor Pitch Deck

**Date:** 2026-07-15
**Status:** Approved design, pending implementation
**Audience:** Mentors / advisors (demo-day register)
**Runtime:** 2 minutes — ~20s per slide

## Goal

A 6-slide deck that reads as an extension of the Velnox product, not a separate
design artifact. Built from the real design system in `src/app/globals.css`, the
real `public/logo.png`, the real `public/demo.mp4`, and real authenticated
screenshots of the running app. No stock imagery, no AI art, no faked UI.

## Deliverable

**One self-contained HTML file:** `deck/index.html`

- Opens in any browser, presents fullscreen.
- Arrow keys / Space / click to advance. `F` fullscreen. `1`–`6` jump to slide.
- 16:9, scales to viewport via a fixed 1600×900 stage + CSS `transform: scale()`
  so every slide screenshots identically at any display size.
- Self-contained except for two local assets it references by relative path:
  `demo.mp4` and screenshot PNGs, which live beside it in `deck/`.
- Each slide is designed to stand alone as an image for X.

## Design system — inherited, not invented

Lifted verbatim from `src/app/globals.css`:

| Token | Value | Use in deck |
|---|---|---|
| `--bg-base` | `#F6F8FE` | Slide background |
| `--bg-surface` | `#FFFFFF` | Cards, screenshot frames |
| `--bg-elevated` | `#EEF1FD` | Diagram rows |
| `--border` | `#DDE1F5` | 1px hairlines — the primary elevation device |
| `--text-primary` | `#0C0E1D` | Headlines, numbers |
| `--text-secondary` | `#4B5282` | Sub-copy |
| `--text-muted` | `#8D93BE` | Labels, captions |
| `--accent` | `#4F5CF4` | Two-tone headline tail, key figures |
| `--btn-primary` | `#15172A` | Slide 6 CTA surface |
| `--hot` | `#DC2B55` | Slide 2 "6 days waiting" flag |
| `--radius-lg` / `--radius-xl` | `12px` / `14px` | Frames, CTA card |

**Type:** Inter (`--font-inter`) throughout. Fraunces (`--font-hero-serif`) for
display lines ONLY — `font-weight: 340`, `font-optical-sizing: none`,
`font-variation-settings: 'opsz' 20, 'SOFT' 70, 'WONK' 0`. This mirrors the
one-exception rule stated in `src/app/layout.tsx`. Fraunces must not appear on
UI-like surfaces.

Fonts load from Google Fonts by link tag (the deck is presented locally with
network access). If offline, Inter/Georgia fall back gracefully.

**Motion:** the site's `cubic-bezier(0.16, 1, 0.3, 1)`, 14px fade-lift, matching
`revealUp`. Slide transitions are a cross-fade + 14px lift, 420ms. Elements
within a slide stagger at 60ms. Respects `prefers-reduced-motion`.

**Elevation:** quiet. 1px borders do the work; shadows are `--shadow-lg` at most.
The single loud moment is the slide-4 video glow, which is the site's own.

## Slides

### 1 — Title
- Real `logo.png` "V" mark + `velnox` wordmark (Inter 600, `-0.035em`, lowercase),
  reproducing the `Brand.tsx` lockup.
- Fraunces display line: **"Never lose a client in your Gmail."**
- Sub: "Velnox reads your Gmail and tells you which client to answer today,
  who's going cold, and what to say — with the reply already drafted."
  (verbatim from `layout.tsx` metadata)
- Background: the real `HeroSkyline` SVG, ported to inline SVG, pinned bottom.
- ONE idea in 3 seconds: what Velnox does.

### 2 — Problem
- Display line, two-tone: **"Gmail sorts by time."** + accent **"Your clients don't."**
- Visual: a **diagram** (explicitly NOT a screenshot, no Gmail chrome, no fake
  avatars) — a chronological stack of muted rows: newsletter, calendar invite,
  promo, receipt… and at position #27 a client thread flagged `--hot` red,
  "6 days waiting."
- The mechanism, shown: recency ≠ importance. Revenue sits below noise.
- ≤12 words of text.

### 3 — Traction
- Numbers only, in Inter, ranked by signal strength.
- Hero: **112 users** · **1 paying** · **$12 MRR**
- Supporting row: 500 visitors · ~6,000 impressions · ~200 engagements
- Footer line: "Live in production. $0 marketing spend."
- Honesty constraint: `$12 revenue` and `$12 MRR` are the SAME $12 — one Pro
  subscriber at the real `$12/mo` price from `src/lib/billing.ts`. The deck shows
  it once, as MRR, with "1 paying" adjacent. It must not imply more.
- No fabricated dashboard. No invented chart.

### 4 — Demo
- `public/demo.mp4` (1920×1080, 30s), in the site's window chrome (`.scene`).
- The site's literal glow:
  `radial-gradient(62% 60% at 50% 44%, rgba(79,92,244,0.75), rgba(96,165,250,0.5) 50%, rgba(124,192,255,0) 76%)`, `blur(38px)`,
  plus the tinted box-shadow trio from `HeroMedia.tsx`.
- **Measured, not assumed:** the pillarbox is **60px per side (3.125%)**, constant
  across all 30s — not the 96px/5% `HeroMedia.tsx` claims. The deck overscans
  `106.67%` / `-3.333%`, cropping the black and nothing else.
- Container is 1180px wide → scene is 737px tall, which fits the 900px stage.
  (At 1200px it overflowed to 913px.)
- Autoplays muted+loop on slide entry, restarts from 0, pauses on leave.
- Known: the recording exposes third-party LinkedIn profiles (faces, names,
  bios). Already public on the landing page; user opted to keep as-is.

### 5 — Founder
- Photo frame wired to `deck/founder.jpg`. If the file is absent, the frame
  renders a typographic "V" monogram placeholder — never a stock face.
  **`public/photos/founder.jpg` is a stock photo of an unrelated person and is
  explicitly excluded.**
- Name: Amirkhan Sagyndyk.
- Five verified credibility facts, ranked strongest-first (a solo-shipped
  production product beats a school credential in this room):
  1. Built Velnox solo — full-stack, in production (verified in git history)
  2. Built a startup platform for dental clinics
  3. 2nd Degree Diploma — Republican Informatics Olympiad (District Stage)
  4. Graduated Yandex Programming + STEP Academy
  5. Student at NIS Astana
- No ticks, no bullets — hairline rules and type hierarchy only. A column of
  check glyphs reads as a feature list, not as credibility.
- **Excluded by design** (user-supplied but below the brief's own "only
  credibility / no filler" bar): 100-anime marathon, Dota 2 Legend rank,
  "dream: build a global tech company."
- Voice is first person throughout the deck ("my own inbox", "my first product").

### 6 — CTA
- The site's `.lp-cta` surface: `#15172A`, `--radius-xl`, white text, full-bleed.
- One ask: **"Send me 10 people who run their business out of Gmail."**
- Sub: freelancers, agency owners, consultants. "I'll onboard every one myself."
- **Domain:** `usevelnox.com`, confirmed by the user. The codebase contradicts
  itself here — `robots.ts`/`sitemap.ts` fall back to `velnox.com`,
  `SUPPORT_EMAIL` is `hello@velnox.com`, `FeatureDemos.tsx` uses `usevelnox.com`
  (×4), `InboxPreview.tsx` uses `velnox.app`, and `LAUNCH_CHECKLIST.md:91` still
  reads "or your real domain". Worth reconciling in the product.
- `usevelnox.com` + email, in the `.lp-cta-btn` style (white pill on near-black).

## Screenshots

Captured from the authenticated local dev server via gstack browse in a headed
Chromium at 1600×900. Real account (`sagindiktar@gmail.com`), real data.

**Shipped:** `deck/shots/dashboard.png` — the `/dashboard` command centre, showing
real counts (138 unanswered / 127 overdue / oldest 12d / 41 of 45 going cold) and
the ranked AI Command Center. Used on slide 3.

**Privacy redaction (baked into the PNG, not a CSS overlay):** real individuals
are blurred in-DOM before capture — "Ava Hall", "Ahmed Maqbool" and their avatar
monograms, plus any non-`sagindiktar` email address. Deliberately NOT blurred:
"Velnox (via Polar)" (the founder's own paying-customer receipt — it's proof),
`sagindiktar@gmail.com` (his own identity), and company senders (Pinterest,
LinkedIn, FocuSee). A visible blur reads as "redacted", not as "faked".

**Rejected surfaces, and why:**
- `/inbox` — right pane is an empty "Select a conversation" state.
- `/inbox/[id]` — the only "Clients"-categorised thread is inbound SEO cold
  outreach miscategorised by the classifier. Showing it advertises a bug.
- `/assistant` — 404. The route no longer exists; AI moved behind "Ask AI".

## Non-goals

- No PDF export (can be added later; video would degrade to a poster frame).
- No speaker notes.
- No fabricated metrics, logos, testimonials, or UI.
- No changes to the product itself. The deck lives in `deck/` and imports nothing
  from `src/`.

## Risks

- **Empty/thin real data** → screenshots may underwhelm. Mitigation: choose the
  surfaces that are genuinely populated; fall back to the demo video carrying
  slide 4 alone.
- **Founder photo absent at present time** → placeholder monogram ships; user
  drops `deck/founder.jpg` to activate.
- **22MB demo.mp4** → fine locally; would need compression before any web host.
