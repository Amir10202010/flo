# Wide email "scale to fit" in the inbox thread

**Date:** 2026-06-29
**Status:** approved (brainstorm)

## Problem

Wide, fixed-layout marketing emails (e.g. LinkedIn) are cut off horizontally in the
inbox thread view. The viewer sees only the left slice, and the layout breaks
(text wraps one character per line) because `table{max-width:100%}` squeezes a
fixed-width table narrower than its intrinsic width. The user wants the whole
email visible at once.

## Decision

Render wide emails at their natural width (so the layout never breaks), then scale
the whole frame down proportionally to fit the column — like Gmail mobile. Emails
that already fit are untouched. Trade-off accepted: very wide emails get smaller
text (a tap-to-zoom affordance can come later, out of scope now).

Rejected: horizontal-pan (still requires sideways scrolling — not "fully visible")
and forced reflow (impossible for fixed-layout emails; this is what currently
breaks them).

## Implementation

`src/components/EmailFrame.tsx` (measurement already exists from the scroll fix):

- Measure `natW` = content's natural width (`documentElement.scrollWidth` / body),
  `colW` = wrap `clientWidth`, `contentH` = `scrollHeight`.
- When `natW > colW`: `s = colW / natW`. Render the iframe at `width: natW`,
  `height: contentH`, `transform: scale(s)`, `transform-origin: top left`; set the
  parent `.email-frame-wrap` height to `contentH * s` so the thread flows with no
  blank gap under the scaled email.
- When it fits: no transform, `width: 100%`, `height: contentH` (current behavior).
- Keep measuring height via `scrollHeight` + `ResizeObserver` so late-decoding
  images recompute `natW`/`contentH`/`s`.

`src/app/globals.css`:

- Remove `table{max-width:100%}` (the cause of the per-character crush; tables now
  lay out at intrinsic width and the scale brings them into view).
- `.email-frame-wrap` back to `overflow: hidden` (horizontal pan no longer needed;
  it clips the un-transformed overflow of the scaled iframe).
- Keep `img{max-width:100%}`.

## Invariants preserved

- Vertical thread scroll keeps working (`.msg-card { flex-shrink: 0 }` stays).
- The iframe root stays `overflow: visible`, so it never becomes a scroll
  container that traps wheel/touch. `transform` does not change overflow.

## Verification

Live, logged in: the LinkedIn email (mobile + desktop) shows fully with no
sideways scroll and no broken text; a plain-text thread and a normal-width email
are visually unchanged; vertical scroll still reaches the footer; no new console
errors; lint clean.
