# Onboarding Tour — Design

**Date:** 2026-06-17
**Status:** Approved

## Problem

A first-time user lands on `/dashboard` after login with no guidance about what
the workspace sections (`/inbox`, `/clients`, `/insights`, `/risk`, `/analytics`,
`/assistant`) do or where to find them. We want a lightweight guided tour that
auto-runs once on first visit, highlights each sidebar section in place, and
explains it in a sentence.

## Decisions (from brainstorming)

- **Trigger:** a per-browser `localStorage` flag. No backend / schema changes.
- **Format:** a **spotlight tour** over the sidebar nav items (we stay on
  `/dashboard` — we do not navigate between routes).
- **Replay:** a "Replay product tour" button in Settings **and** a "Take a tour"
  command in the ⌘K palette.
- **Mechanism:** custom, dependency-free (no driver.js / react-joyride). Matches
  the repo ethos (custom SVG charts, everything hand-rolled). Animations via the
  already-present framer-motion.

## Flow

1. First load of `/dashboard` → the `OnboardingTour` client island reads
   `localStorage['velnox:onboarding:v1']`. If the flag is absent **and** the
   viewport is wide enough that the sidebar is visible (≥ 900px), it auto-starts
   the tour.
2. The tour walks steps in order, spotlighting the matching sidebar element. A
   bubble renders next to the highlighted element with: title, one-line
   description, progress ("Step X of N"), and **Back / Next / Skip** controls.
   The final step shows **Done** instead of Next.
3. On **finish or skip**, write the `localStorage` flag → never auto-shows again.
4. Replay (Settings button / ⌘K command) calls `startTour()`, which opens the
   tour regardless of the flag. Finishing/skipping a replay re-writes the flag
   (idempotent).

## Steps

`welcome` (centered) + the six requested sections + a bonus search tip:

| # | Target (`data-tour`) | Title | Body (draft copy) |
|---|----------------------|-------|-------------------|
| 0 | — (centered) | Welcome to Velnox | A 30-second tour — here's where everything lives. |
| 1 | `inbox`     | Inbox        | Every email, AI-prioritized, with reply drafts and Smart Compose. |
| 2 | `clients`   | Clients      | One card per contact: engagement, risk, who's awaiting a reply. |
| 3 | `insights`  | Insights     | A feed of AI observations and suggested next steps. |
| 4 | `risk`      | Risk Monitor | Clients at risk: overdue replies, negative sentiment, gone quiet. |
| 5 | `analytics` | Analytics    | Response-time, volume, and distribution trends. |
| 6 | `assistant` | AI Assistant | Beta workspace copilot. |
| 7 | `search`    | Search anything | ⌘K / Ctrl+K — jump anywhere and AI-search your mail. |

## Components / Changes

- **`src/components/onboarding/tour-steps.ts`** (NEW) — step definitions:
  `{ target: string | null, title: string, body: string }[]`. Single source of
  truth for copy and order.
- **`src/components/onboarding/OnboardingTour.tsx`** (NEW) — client island:
  - Auto-start on mount: gated to `pathname === '/dashboard'`, flag absent, and
    `window.innerWidth >= 900`.
  - Renders nothing unless `tourOpen`.
  - Spotlight: a transparent box positioned over the target element's bounding
    rect with `box-shadow: 0 0 0 9999px rgba(...)` to dim everything else +
    rounded corners + small padding. Recomputes the rect on step change and on
    `resize`; `scrollIntoView({ block: 'nearest' })` for targets below the fold.
  - Bubble: positioned to the right of the target (sidebar is on the left). The
    `welcome` step and any step whose target can't be found render a centered
    bubble with no cutout (also the mobile / narrow-viewport fallback on replay).
  - Controls: Back / Next / Skip / Done, progress text, Esc = skip.
  - On finish/skip: write the flag, call `setTourOpen(false)`.
- **`src/stores/ui.store.ts`** (EDIT) — add `tourOpen`, `setTourOpen(open)`,
  `startTour()` (sets `tourOpen = true`). Same cross-component UI store that
  already holds palette + compose state.
- **`src/components/layout/Sidebar.tsx`** (EDIT) — add `data-tour="<key>"` to each
  NavItem (mapped from href) and to the Search button (`data-tour="search"`).
- **`src/app/(dashboard)/layout.tsx`** (EDIT) — mount `<OnboardingTour />` next to
  `<CommandPalette />` / `<ComposeModal />`.
- **`src/components/CommandPalette.tsx`** (EDIT) — add a "Take a tour" action that
  closes the palette and calls `startTour()`.
- **`src/components/onboarding/ReplayTourButton.tsx`** (NEW) — tiny client button
  for the Settings page (server component) that calls `startTour()`.
- **`src/app/(dashboard)/settings/page.tsx`** (EDIT) — render the replay button in
  a "Getting started" / workspace section.
- **Styling:** inline styles + framer-motion, consistent with CommandPalette /
  dashboard widgets. `globals.css` is **not** touched (Turbopack won't hot-reload
  it locally; avoid the churn).

## Edge cases

- **Narrow viewport / mobile:** sidebar collapses to an icon rail or hides. Auto
  start is disabled below 900px. A manual replay still works — steps whose target
  isn't found (or the welcome step) render the centered bubble without a cutout.
- **Flag versioning:** key is `velnox:onboarding:v1`. Revamping the tour → bump to
  `:v2` so it re-shows for everyone.
- **Flag written on both Skip and Done** — either counts as "seen".
- **Target not in DOM** (e.g. route without the sidebar): fall back to centered
  bubble so the tour never points at nothing.

## Testing

No test runner is configured in this repo. Verify manually:
- Fresh browser (or cleared `localStorage`) → `/dashboard` auto-runs the tour.
- Next/Back/Skip/Done, progress counter, Esc.
- Reload → tour does not re-show.
- Settings "Replay product tour" and ⌘K "Take a tour" re-run it.
- Narrow viewport → no auto-start; replay shows centered bubbles.
Run `npm run lint` + `npm run build` before completion.
