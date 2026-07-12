# Cluely-style landing hero + demo-card sections — design

Date: 2026-07-12 · Branch: `claude/landing-hero-redesign-691f4f` (based on `focus/solo-inbox`)

## Goal

Rework the marketing landing (`src/app/page.tsx`) into a Cluely-style page for the
solo ICP (one person — marketer / consultant / one-person agency — living in Gmail
with many client threads and no prioritization). Fewer words, one big serif
headline over a full-bleed washed-out city-skyline background, one CTA, a big
product window below the hero (placeholder for a future demo video), and two
"one headline + two small demo cards" sections replacing the old feature grid
and proof section.

## Constraints

- Solo positioning only — no team / shared-inbox / CRM wording anywhere.
- Design system stays: Inter for body/UI, near-black `btn-primary`, radius 12,
  no decorative dots. The ONLY new display element is a serif font for the hero
  headline (Instrument Serif via `next/font/google`, hero-scoped class).
- Background is an original inline SVG skyline (no stock photo, no licensing):
  washed light-gray silhouettes on the near-white page background, bottom-anchored,
  fog gradient so text stays readable and the section blends into the page.
- Module honesty: demos only show real product behavior (ranking, review-before-send
  drafts, going-cold flags, reminders/digest). No fabricated metrics.

## Page structure (after)

1. **Hero** — centered column over the skyline SVG:
   - H1 (Instrument Serif, ~clamp(46px → 82px)): "Stop losing clients in your inbox."
   - One sub-line (Inter, secondary): "Velnox reads your Gmail and tells you who to
     answer today, who's going cold, and what to say — with the reply already drafted."
   - One CTA: `Start free →` (btn-primary). Nothing else.
   - Removed: right-side HeroMockup, ghost CTA, AES trust line, cursor spotlight,
     3D tilt, hero-ambient/hero-grid-faint.
2. **Product window** — existing `ProductDemo` full-container-width, pulled up to
   overlap the skyline bottom (negative margin), Cluely-video-slot style. Will be
   swapped for a demo video later; keep `id="demo"`.
3. **Section A** (replaces "Everything you need to stay on top of it" feature grid):
   headline "How Velnox works your morning" (last word muted, Cluely-style,
   left-aligned) + 2 demo cards:
   - Card 1 (accent-tinted): *Ranked, not chronological* — mini inbox list where the
     client thread animates above newsletters.
   - Card 2 (light): *The reply is already written* — mini composer types a draft,
     review-before-send chip.
4. **Section B** (replaces "Never lose a client to a missed reply" proof section):
   centered headline "Never lose a client to a missed reply" + 2 demo cards:
   - Card 3: *Going-cold radar* — a client relationship dims, follow-up flag appears.
   - Card 4: *Nothing falls through* — reminder + weekly digest mini-demo.
5. **Unchanged:** FAQ, final CTA block, footer (already solo copy on this base).

## Components

- `src/components/marketing/HeroSkyline.tsx` — inline SVG, layered silhouettes,
  `preserveAspectRatio` bottom-anchored, decorative (`aria-hidden`).
- `src/components/marketing/SoloDemos.tsx` — the 4 looping mini-demos
  (framer-motion, in-view timelines modeled on FeatureDemos' `useTimeline`,
  reduced-motion safe).
- `src/app/page.tsx` — restructure per above; drop dead FEATURES/POINTS arrays and
  hero motion-value code.
- `src/app/layout.tsx` — add Instrument Serif next/font variable.
- `src/app/globals.css` — `.hero-*` cleanup + `.demo-duo` / `.demo-card` styles;
  verify no other page uses removed classes before deleting.

## Verification

`npm run lint`, `npm run build`, then browser QA of the landing at desktop +
mobile widths (hero readability over the SVG, card animations, reduced motion).
