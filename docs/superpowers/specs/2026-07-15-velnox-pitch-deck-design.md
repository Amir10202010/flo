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
- `public/demo.mp4`, near-full-bleed in the site's window chrome (`.scene`).
- The site's literal glow:
  `radial-gradient(62% 60% at 50% 44%, rgba(79,92,244,0.75), rgba(96,165,250,0.5) 50%, rgba(124,192,255,0) 76%)`, `blur(38px)`,
  plus the tinted box-shadow trio from `HeroMedia.tsx`.
- The `111.12%` / `-5.56%` overscan that crops the burned-in 96px pillarbox.
- Autoplays muted+loop on slide entry; pauses when the slide is left.
- One headline. Video is ~85% of the slide.

### 5 — Founder
- Photo frame wired to `deck/founder.jpg`. If the file is absent, the frame
  renders a typographic "V" monogram placeholder — never a stock face.
  **`public/photos/founder.jpg` is a stock photo of an unrelated person and is
  explicitly excluded.**
- Name: Amirkhan Sagyndyk.
- Five verified credibility facts, typographically ranked:
  1. Student at NIS Astana
  2. 2nd Degree Diploma — Republican Informatics Olympiad (District Stage)
  3. Built a startup platform for dental clinics
  4. Graduated Yandex Programming + STEP Academy
  5. Built Velnox solo — full-stack, in production (verified in git history)
- **Excluded by design** (user-supplied but below the brief's own "only
  credibility / no filler" bar): 100-anime marathon, Dota 2 Legend rank,
  "dream: build a global tech company."

### 6 — CTA
- The site's `.lp-cta` surface: `#15172A`, `--radius-xl`, white text, full-bleed.
- One ask: **"Send me 10 people drowning in their Gmail."**
- Sub: freelancers, agency owners, consultants — anyone who runs their business
  out of a personal inbox.
- `velnox.app` + contact, in the `.lp-cta-btn` style (white pill on near-black).

## Screenshots

Captured from the authenticated local dev server via gstack browse in a headed
Chromium, at `1600×900`, `--scale 2` (retina). Real account, real data.
Any customer-identifying data visible in captures must be reviewed before the
deck is shared publicly.

Candidate surfaces: `/dashboard` (command center), `/inbox` (ranked list +
draft-ready badge), `/assistant`. Final selection depends on what the real
account actually contains — a screenshot of an empty state proves nothing and
will not be used.

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
