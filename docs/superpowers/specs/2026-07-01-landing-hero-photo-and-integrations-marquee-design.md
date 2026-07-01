# Landing: hero photo texture + animated integrations marquee

**Date:** 2026-07-01
**Branch:** redesign/premium-saas
**Scope:** two additive touches to the marketing landing page (`src/app/page.tsx`) — a subtle photographic texture behind the hero, and an animated ticker of email/channel integrations that replaces the current static integrations line.

## Goal

Make the landing feel richer and more alive without reintroducing the "AI-template slop" the 2026-06-30 premium redesign removed. Two elements:

1. **Hero photo texture** — a warm workspace photo faded into the existing light hero as depth, not decoration.
2. **Integrations marquee** — a continuously scrolling row of service logos (email + messaging), framed honestly (Gmail is live; the rest are on the roadmap).

Everything else on the page (copy, buttons, colour system, section order) stays as-is and follows the redesign conventions (Inter, near-black primary buttons, thin borders, calm reveals).

## Decisions (locked with the user)

- Marquee meaning = **integrations** (services Velnox connects to), NOT fake "trusted by" customer logos.
- Hero character = **light, kept as-is**; photo is a **subtle desaturated texture**, dark text stays readable.
- Logos = **colored brand marks + name label**.
- Service set = **8**: Gmail, Outlook, Yahoo Mail, Apple iCloud Mail, Proton Mail, Telegram, WhatsApp, Instagram.

## 1. Hero photo texture

**Asset:** `public/photos/workspace.jpg` (team at laptops, warm light).

**Approach:** a new absolutely-positioned layer `.hero-photo` inside the hero `<section>`, rendered as the **first child** so it sits beneath the existing `z-index:0` ambience layers (`.hero-ambient`, `.hero-grid-faint`, `.hero-spotlight`) and well below the content wrapper (`z-index:1`).

CSS (in `globals.css`, next to the other hero-ambience rules):

- `position:absolute; inset:0; z-index:0; pointer-events:none;`
- `background: url(/photos/workspace.jpg) center/cover no-repeat;`
- `filter: grayscale(0.35) saturate(0.85);` — desaturate so it reads as texture, not a stock photo.
- `opacity: ~0.12`.
- `mask-image` (and `-webkit-mask-image`): a horizontal + vertical gradient that **hides the photo on the left** (behind the headline) and **lets it show on the right**, behind the mockup, then fades to nothing at all edges. E.g. `linear-gradient(90deg, transparent 0%, transparent 42%, #000 78%, transparent 100%)` combined via mask with a soft top/bottom fade.
- Hidden or reduced under `@media (max-width: 900px)` (where the hero collapses to one column and the mockup is hidden) so it never sits behind the headline on mobile.

**Readability guard:** the headline/subhead column occupies the left ~52%; the mask keeps that region photo-free, so contrast is unchanged. No text sits over a visible part of the image.

## 2. Integrations marquee

**Replaces** the current static integrations `<section>` in `page.tsx` (the centered Gmail line + "Telegram, WhatsApp & Instagram coming soon"). Same visual slot: full-bleed band with top+bottom border on `--bg-surface`.

**New component:** `src/components/marketing/IntegrationsMarquee.tsx` (client component).

Structure:
- A small honest caption line above the track: **"Works with Gmail today — more channels on the way."** (`--text-secondary`, centered, ~14px).
- A `.marquee` viewport with `overflow:hidden` and an edge `mask-image` (linear-gradient transparent→opaque→transparent) so the row **fades into the margins** instead of hard-clipping.
- A `.marquee-track` flex row containing the service list rendered **twice back-to-back** (for a seamless loop), animated by a CSS `@keyframes marqueeScroll { to { transform: translateX(-50%); } }`, `animation: marqueeScroll 40s linear infinite;`.
- Each item = `.marquee-item`: colored brand `<img>` (~22px) + name in `--text-secondary` (~14.5px, 500).

Behaviour:
- **Pause on hover:** `.marquee:hover .marquee-track { animation-play-state: paused; }`.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` → drop the animation; render the set once, centered and wrapping (`flex-wrap`), no duplicate. The component can also render the single (non-duplicated) set when reduced motion is preferred to avoid a doubled static list.
- Marquee CSS lives in `globals.css` under a new "Integrations marquee" block (keeps the styling approach: utility classes for anything hover/animated, since inline can't express `:hover`/keyframes).

**Service data** (in the component):

| name | icon file | status |
|------|-----------|--------|
| Gmail | `/icons/gmail.svg` (exists) | live |
| Outlook | `/icons/outlook.svg` (add) | soon |
| Yahoo Mail | `/icons/yahoo.svg` (add) | soon |
| iCloud Mail | `/icons/icloud.svg` (add) | soon |
| Proton Mail | `/icons/proton.svg` (add) | soon |
| Telegram | `/icons/telegram.svg` (exists) | soon |
| WhatsApp | `/icons/whatsapp.svg` (exists) | soon |
| Instagram | `/icons/instagram.svg` (exists) | soon |

Honesty is carried by the **caption line**, not per-item badges (per-item "soon" tags are unreadable in a moving row and clutter it). This satisfies the module-honesty policy: we don't claim any integration but Gmail is available.

**New SVG assets** to add under `public/icons/`, matching the existing simple-icons format (single `<path>`, brand `fill`, `viewBox="0 0 24 24"`): `outlook.svg`, `yahoo.svg`, `icloud.svg`, `proton.svg`. Source: simple-icons (same origin as the existing four).

## Files touched

- `src/app/page.tsx` — add `.hero-photo` layer as first child of the hero `<section>`; replace the static integrations `<section>` with `<IntegrationsMarquee />`; import the new component.
- `src/app/globals.css` — add `.hero-photo` rule (+ its mobile guard) near the hero-ambience block; add an "Integrations marquee" block (`.marquee`, `.marquee-track`, `.marquee-item`, `@keyframes marqueeScroll`, hover-pause, reduced-motion).
- `src/components/marketing/IntegrationsMarquee.tsx` — new client component.
- `public/icons/outlook.svg`, `yahoo.svg`, `icloud.svg`, `proton.svg` — new brand logos.

## Non-goals / out of scope

- No changes to hero copy, CTAs, mockup, or any section below the integrations band.
- No customer/"trusted by" logos (deliberately avoided — no real customers pre-launch).
- No new dependencies; marquee is pure CSS (no framer-motion) for a cheap, smooth infinite loop.

## Verification

- `npm run lint` + `npm run build` (or `tsc`) stay green.
- Visual check: hero text fully readable; photo reads as faint texture behind the mockup only; marquee scrolls smoothly, fades at edges, pauses on hover; with reduced motion it's a calm static row; mobile (<900px) hides the hero photo and the marquee still reads.
