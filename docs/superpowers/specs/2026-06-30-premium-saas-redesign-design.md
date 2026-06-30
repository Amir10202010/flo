# Premium SaaS Redesign — De-slop & Design-System Unification

**Date:** 2026-06-30
**Status:** Approved (full autonomy granted to implement; choose better solutions where found)
**Branch:** `redesign/premium-saas`

## Goal

Remove every trace of "AI-template / AI-generated" design and make Velnox feel like
a production SaaS built by an experienced product team. Reference points: Stripe,
Linear, Vercel, Notion, GitHub, Raycast. **Not** Dribbble concepts / startup
templates / overdesigned dashboards.

Priorities, in order: **Clarity → Simplicity → Consistency → Native UX →
Accessibility → Readability.** Prefer *removing* UI over adding. Every visual
change must improve usability; no aesthetics-for-aesthetics.

## Locked decisions

1. **Scope:** full redesign across all surfaces in one pass (delivered
   foundation-first for safety).
2. **Typography:** **Inter**, all-sans. Retire Instrument Serif and the
   `--font-display` serif system entirely (incl. the mobile serif→sans swap).
3. **Buttons/accent:** primary CTA becomes **near-black** (white text). Indigo
   (`--accent #4F5CF4`) demoted to links, active nav, focus rings, selected rows,
   and genuine AI affordances — never the default button fill.
4. **Radius:** tighten globally. Token scale `xs 4 / sm 6 / base 8 / lg 10 / xl 14`
   (was 4/8/12/18/28). Hardcoded 16–20px card/modal radii reduced to 10–12px.
   Pills stay 100px only for genuine status chips.

## Design-system foundation (token changes)

| Token | Before | After |
|---|---|---|
| `--font-sans` | DM Sans | Inter |
| `--font-serif` / `--font-display` | Instrument Serif | repointed to Inter, then references removed |
| `--radius-sm` | 8px | 6px |
| `--radius` | 12px | 8px |
| `--radius-lg` | 18px | 10px |
| `--radius-xl` | 28px | 14px |
| `--btn-primary` (new) | — | `#15172A` / hover `#23263F` |
| `.btn-primary` | indigo gradient + glow + inset + shine | flat near-black, subtle shadow |
| Shadows | "real and visible" | softened; lean on 1px borders |
| Icons | mixed 14/15/16/20/22 | 16 (inline/nav), 18 (headers) |

Type scale (Inter): hero 52–56/600/-0.02em · h1 24–26/600/-0.02em · h2 18–20/600 ·
body 14–15/400/1.6 · meta 12–13/500. Wordmark "velnox" = Inter 600, tracking -0.03em.

## AI-slop kill-list (global)

Remove components + their CSS once unused:
`Kicker`/`.kicker`/`.kicker-dot`, `.flourish`, `.bento`/`BentoCard`/`.spotlight`,
`.stats-band`, `.float-card`, `.glow`, `.tcard.t-feature` gradient,
`.grain`, `.glass-card`, `.spotlight-card`, `.grad-edge`, `.btn-shine`,
`.hero-badge` (pulsing dot + gradient-shine text), `.ink-grad` (animated gradient
text), `.hero-canvas-wrap`/`.hero-tilt`/`.core-bloom`, scroll-drawn `.timeline`/`.tl-node`,
`.photo-band`, `.aurora-bg`, `.mesh`/`.mesh-*`, `.dot-grid`, `.marquee`, `Magnetic`.
Remove decorative dots (`priority-dot`, `inbox-group-dot`, `rail-risk-dot`,
`iff-row-dot` etc.) where color+label already carry meaning. Remove fake "NEW"
indicators (`nav-pill`, `client-card-new`) unless genuinely new to the user.

## Navigation fix (brief #4)

`Brand` gets an `href` prop (default `/`). Sidebar + dashboard mobile topbar pass
`href="/dashboard"` so the in-app logo keeps the user inside the app. Marketing
navbar keeps `/`.

## Per-surface

- **Landing:** clear hero (what it is / who for / why / 2 CTAs / one clean product
  shot) → plain 3-step how-it-works → feature rows (not bento) → pricing → FAQ →
  CTA → footer. Calm fade-ins only; no magnetic/spotlight/scroll-draw.
- **Dashboard:** more whitespace, consistent spacing/alignment, fewer competing
  cards, no bright red unless real error, honest `ModulePill`s kept but quieter.
- **Inbox/thread:** unify radii/spacing/icon sizes, remove redundant dots, calm AI
  affordances. (Do not disturb in-progress EmailFrame/ThreadLayout email-scaling work.)
- **Auth:** clean centered card, no mesh/dots, inline validation, password
  show/hide, clearer errors, smooth password↔magic-link transition.
- **Settings:** conventional groups — Account · Security · Notifications · Team ·
  Billing · Danger Zone — via existing `SettingsTabs`.
- **Onboarding/discoverability:** one obvious "Connect your inbox" primary action
  post-signup; teaching empty states; minimal spotlight tour.

## Out of scope (YAGNI)

No new features, no dark mode, no new deps beyond the Inter font, no backend or
data-model changes. Pure UI/UX + code cleanup.

## Verification

`npm run build` and `npm run lint` pass. Manual spot-check of landing, dashboard,
inbox, auth, settings: no serif rendered, near-black primary buttons, tighter
radii, no decorative dots/animated gradients, in-app logo stays in app.
