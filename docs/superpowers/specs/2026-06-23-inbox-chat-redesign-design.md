# Inbox Chat Redesign — focused conversation + context rail

**Date:** 2026-06-23
**Status:** Approved — ready for implementation

## Problem

The thread view (`src/app/(dashboard)/inbox/[id]/page.tsx`) is confusing,
cluttered, and visually weak. Concretely:

1. **The header is overloaded.** Above the first message it stacks: identity
   (avatar/name/channel/email/subject) → `CategoryMover` + `PriorityBadge`
   (HOT/COLD) → a full-color AI-insight banner (`.chat-ai`) → the entire
   `ThreadCollab` bar (assignee dropdown, 3-way status segmented control, tags
   dropdown + chips, **internal-notes list + its own textarea with a Send
   button**) → the "Catch me up" button/card (`ThreadSummary`). On an active
   thread the header can be taller than the conversation, and there are **two
   text inputs with Send buttons on screen at once** (notes + reply).
2. **AI is scattered and not distinct.** AI insight lives in the header banner,
   "Catch me up" is a separate button→card, draft controls are buried in the
   composer toolbar. No single, premium AI surface.
3. **Messages are inconsistent.** Short messages render as in/out chat bubbles
   (`.msg-bubble*`); rich HTML emails render as full-width bordered iframes with
   *no sender treatment*. A mixed thread reads as two different components and
   you lose track of who sent what. No sender labels; timestamps are tiny,
   muted, relative-only ("5m ago") — wrong for email.
4. **The composer feels like an afterthought.** A mismatched control strip sits
   below the reply row: AI-draft button, an unstyled native `<select>` for tone,
   a "Steer" toggle whose input appears *detached above* the row, a template
   menu, an offline label, and a hint shoved right.
5. **Weak hierarchy + inline styles.** Everything in the header is similar
   weight; `ThreadCollab` is built almost entirely from inline styles (against
   the project's CSS-class convention), so spacing/rhythm is inconsistent.

**Goal:** a clean, premium, email-client-grade chat — a focused conversation
column, one distinct AI surface, consistent message cards, and a polished
composer. Full redesign, not a restyle.

## Decisions (locked)

- **Right context rail (3-pane inside the detail pane).** A slim identity header
  on top; a collapsible right rail holds **everything** that overloaded the
  header — AI, assignee/status/tags/category, and internal notes. The
  conversation column owns the center. (Chosen over a compact-header variant —
  it's the premium pattern that matches the message-card direction.)
- **Email-style stacked message cards. No chat bubbles.** Every message is a
  full-width card with a sender row (avatar, name, real timestamp, hover
  actions) and a body. Plain-text and rich-HTML emails share the **same card
  chrome** (the sandboxed `EmailFrame` sits *inside* the card). Retire
  `.msg-bubble*`.
- **No HOT/COLD anywhere in the chat.** Remove `PriorityBadge` from the thread
  view entirely. (Priority still drives the list/sorting elsewhere — untouched.)
- **Sender roles: contact vs. "You".** The schema stores no per-member message
  author (`Message` has only `direction`), and `Contact` has **no company
  field**. So inbound = the contact (initials avatar + name); outbound = **"You"**
  (distinct accent-tinted avatar + a subtle left accent on the card). There are
  **no AI-authored messages in the timeline** — AI lives in the rail and as
  review-before-send drafts. "Consistent but role-distinct" = identical card
  chrome, differentiated by avatar tint + label + a 2px accent edge on outbound.
- **One AI surface.** The rail's AI panel unifies risk + summary + next action +
  an inline "Catch me up" expander. The header banner and the standalone
  summary button are removed (no duplicate AI entry points).
- **Polished single composer.** One cohesive block: textarea + an *integrated*
  toolbar (AI Draft, a **styled** Tone menu — not a native `<select>`, Steer
  expanding *inside* the block, Templates, Send). The notes textarea leaves the
  conversation column for the rail, so the two inputs no longer compete.
- **No backend/API/schema changes.** Pure presentation + client wiring. All
  existing endpoints (`/draft`, `/reply`, `/summarize`, `/assign`, `/state`,
  `/tags`, `/internal-notes`, category PATCH) are reused as-is.

## Architecture

### Layout

```
.chat (flex column, height:100%)
├─ .chat-header  ── slim identity: [◀ mobile] avatar · name · email · channel chip
│                   · subject ·········································· [⊟ rail toggle]
└─ .chat-body (flex row, flex:1, min-h:0)
   ├─ .chat-main (flex column, flex:1, min-w:0)
   │  ├─ .chat-scroll (flex:1, overflow-y:auto)  ── day seps + .msg-card stack
   │  └─ .composer                                ── one polished input block
   └─ .chat-rail (≈320px, collapsible; own scroll)
      ├─ Rail AI panel      (✦ risk chip · summary · → next action · ▸ Catch me up)
      ├─ Rail properties    (Assignee ▾ · Status ▾ · Tags + · Category ▾)
      └─ Rail internal notes (🔒 list + composer — team-only)
```

Desktop: rail open by default. Mobile (≤768px): rail off by default, opens as a
right slide-over drawer (overlay), messages full width. `InboxShell`'s outer
grid (`320px 1fr`) is **untouched** — the rail lives *inside* the detail pane.

### Components

**New — `src/components/inbox/ThreadLayout.tsx` (client).** Mirrors the
`InboxShell` props-as-ReactNode pattern so server-rendered content stays on the
server while the client owns layout + rail toggle:

```tsx
<ThreadLayout
  header={ReactNode}     // identity markup (server)
  messages={ReactNode}   // .msg-card stack (server)
  composer={ReactNode}   // <Composer/> or null (Gmail only)
  rail={ReactNode}       // <ThreadContextRail/> (client)
/>
```

Owns `railOpen` state (default: open ≥769px, closed below), renders the rail
toggle button into the header bar, and on mobile renders the rail as a drawer +
scrim. Optional: persist `railOpen` to `localStorage`.

**New — `src/components/inbox/ThreadContextRail.tsx` (client).** Composes the
three rail sections and owns the client data fetch that `ThreadCollab` did
(members, tags, conv-tags, notes via `Promise.all` of API routes — fine; these
are client fetches, not Prisma in a render path). Receives the AI analysis as
serializable props from the server page. To keep each unit focused it renders
three small sub-sections (same file or split if it grows):

- **AI panel** — props `{ summary, riskLevel, nextAction, provider }`. A soft
  risk chip (colored dot + "High risk", *not* a full-bleed banner), the summary
  paragraph, a `→ next action` line, and a "Catch me up" expander (reuses the
  restyled `ThreadSummary`). Marked with the app's AI gradient tile
  (`iconTone="ai"` convention). Hidden/placeholder when `analysis` is null.
  `provider === 'local'` keeps the "offline" label.
- **Properties** — `Assignee` (dropdown), `Status` (Open/Snoozed/Closed),
  `Tags` (chips + add), `Category` (moves `CategoryMover` here). Vertical
  label→control rows, CSS classes (no inline styles).
- **Internal notes** — the notes list + composer, relocated here, clearly
  team-only.

**Restyle — `src/components/ThreadSummary.tsx`.** Becomes the inline "Catch me
up" expander *inside* the rail AI panel (same `/summarize` call + cache).
Visual only; logic unchanged.

**Remove — `src/components/ThreadCollab.tsx`.** Its data logic + handlers
(assignee/state/tags/notes) are absorbed into `ThreadContextRail` (now in a
vertical rail layout with CSS classes). Delete the file and its header mount.

**New (optional but cleaner) — `src/components/inbox/MessageCard.tsx`
(server).** Renders one email-style card: header row (avatar, sender name, time,
hover actions) + body, where the body is either the sanitized inline HTML or
`<EmailFrame/>` (both inside the card). Keeps `page.tsx` lean. Receives the
message + precomputed grouping flags (`newDay`, `cont`, `groupEnd`) + `now`.

**Rewrite — `src/components/Composer.tsx`.** Same API/handlers; new presentation:
one rounded block containing the textarea and an integrated toolbar. Replace the
native `<select>` tone control with a **styled dropdown menu** (reuse the
`.cat-menu`/`TemplateMenu` popover pattern). The Steer input expands *inside* the
block (connected to the AI Draft button), not detached above. Send stays
prominent; offline + "Enter to send" hints stay subtle.

**Restructure — `src/app/(dashboard)/inbox/[id]/page.tsx`.** Build the four
pieces and hand them to `ThreadLayout`. Remove `PriorityBadge`, the `.chat-ai`
banner, the header `CategoryMover`, and `ThreadCollab`/`ThreadSummary` from the
header. Keep the grouping precompute. Render messages as `MessageCard`s.

**Update — `src/app/(dashboard)/inbox/[id]/loading.tsx`.** Skeleton matches the
new shape: slim header bar + full-width card skeletons (drop the bubble radii) +
a faint rail column on the right.

### Message card — detail

```
── Today ──────────────────────────────────────────
┌──────────────────────────────────────────────────┐
│ 🟣  Jane Doe                       9:20 AM   ⋯    │   ← header row
├──────────────────────────────────────────────────┤
│ Hi team, attaching the deck for review…           │   ← body (text or EmailFrame)
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐
│ 🔵  You                            9:22 AM   ⋯    │   ← outbound: accent avatar
│ ░ Got it, reviewing now.                          │     + 2px accent left edge
└──────────────────────────────────────────────────┘
```

- **Avatars:** inbound = contact initials on the existing purple gradient;
  outbound = "You" on a solid accent tint. New `.msg-avatar` with `.in`/`.out`.
- **Timestamp:** absolute (`9:20 AM` today, `Jun 20` / `Jun 20, 2025` older) via
  a new `formatStamp(date, now)`; full datetime in `title`. Day separators keep
  date context (existing `dayLabel`).
- **Grouping:** keep `newDay`/`cont`/`groupEnd`. Consecutive same-direction
  messages <10 min render tighter; a continuation card slims its header (time
  only, avatar column preserved for alignment) to cut repetition.
- **Actions:** a hover `⋯` affordance (copy text; room for future archive/reply-
  jump). Out of scope to wire beyond copy in v1.
- **Email bodies:** `EmailFrame` renders inside `.msg-card` (the card supplies
  the border/radius; the frame loses its own outer border). "Images blocked"
  bar unchanged.

### Composer — detail

```
┌────────────────────────────────────────────────────────┐
│  Write a reply…                                         │
│                                                         │
│  (steer field expands here when toggled, inside block)  │
├────────────────────────────────────────────────────────┤
│  ✦ AI draft   Tone ▾   ✎ Steer   ⊞ Templates    [ Send ]│
└────────────────────────────────────────────────────────┘
   offline template · Enter to send · Shift+Enter newline
```

- Single bordered container; focus ring on the whole block.
- **Tone** = styled popover menu (Warm / Concise / Formal / Match my style),
  replacing the native select.
- **Steer** toggles an inline field within the block; Enter triggers `draft()`.
- AI Draft button shows Draft → Regenerate / Drafting… states (unchanged logic).
- Hints (offline label, key hints) sit subtle below the block.

### CSS — `globals.css`

- **Add:** `.chat-body`, `.chat-main`, `.chat-scroll`, `.chat-rail`
  (+ `.chat-rail.open`/drawer + scrim), `.rail-section`, `.rail-ai*`,
  `.rail-prop*`, `.rail-notes*`, `.msg-card`, `.msg-card-head`, `.msg-avatar(.in/.out)`,
  `.msg-sender`, `.msg-time`, `.msg-actions`, `.msg-body`, `.msg-card.out` accent,
  the rail toggle button, and a restyled `.composer*` (incl. `.composer-tone-menu`).
- **Repurpose:** `.chat`, `.chat-header`, `.chat-day-sep`, `.thread-back`,
  `.email-frame*`, `.msg-html*` (the inline-HTML body styles still apply inside
  `.msg-body`).
- **Retire:** `.msg-bubble`, `.msg-bubble-in`, `.msg-bubble-out`, `.chat-row*`,
  `.chat-ai*`, the header-banner styles, and `.chat-time` (replaced by `.msg-time`).
- **Preserve load-bearing responsive classnames** and add `@media` rules for the
  rail drawer at ≤768px and the existing `.thread-back` reveal at ≤600px.

## Testing

No DOM test framework (house style) — UI is verified by lint + build + manual
smoke. The `tsx` pure-logic suites (`test:classifier`, `test:agentic`) are
unaffected (no logic changes). If `formatStamp` grows non-trivial, add a tiny
inline assertion; otherwise skip.

## Error handling / edge cases

- **No analysis yet** → AI panel shows a quiet "Not analyzed yet" state, not an
  empty card.
- **`provider === 'local'`** → keep the "offline" labels (insight + summary +
  draft), per the module-honesty policy.
- **No messages** → keep the existing empty state in the scroll area.
- **Non-Gmail / no contact email** → no composer (pass `composer={null}`).
- **Long subject / name** → truncate with ellipsis in the slim header.
- **Rail on mobile** → drawer closed by default; scrim click + Esc close it;
  body scroll locked while open.
- **EmailFrame height** → unchanged measure-on-load; card wraps without clipping.

## Non-goals (v1)

- No schema/API/backend changes; no new message-sender storage; outbound author
  stays "You" (no per-member attribution).
- No attachments rendering, no message-level reply/forward, no `⋯` actions
  beyond copy.
- No real-time presence/typing in the rail.
- No change to the conversation list, sorting, or priority logic elsewhere.

## Verification

- `npm run lint` and `npm run build` pass.
- Manual smoke: header is slim (avatar · name · email · channel · subject +
  toggle) with **no HOT/COLD**; messages are consistent full-width cards (text +
  HTML email share chrome); inbound vs. "You" is obvious; AI appears **once** in
  the rail (risk + summary + next action + Catch me up); composer is one block
  with a styled tone menu and inline steer; assignee/status/tags/category/notes
  all work from the rail; rail toggles on desktop and opens as a drawer on
  mobile; "Show images", AI draft/regenerate/steer/templates, send, and route
  refresh all still work.
