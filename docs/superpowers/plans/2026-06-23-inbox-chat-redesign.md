# Inbox Chat Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Inbox thread view into a focused conversation column with a collapsible right context rail, email-style message cards (no bubbles), one unified AI surface, and a single polished composer.

**Architecture:** The detail pane (`inbox/[id]/page.tsx`, a server component) composes four pieces — a slim header, a message-card stack, a composer, and a context rail — and hands them to a new client `ThreadLayout` that owns the 3-zone grid + rail toggle/drawer. The rail (`ThreadContextRail`, client) absorbs the AI insight, assignee/status/tags/category, and internal notes that used to overload the header. No backend/API/schema changes.

**Tech Stack:** Next.js 16 App Router (RSC), React 19, TypeScript, plain CSS in `src/app/globals.css` (no Tailwind utilities in JSX), lucide-react icons.

## Global Constraints

- **No backend/API/schema changes.** Reuse existing endpoints only: `POST /api/conversations/[id]/draft` (+ DELETE), `/reply`, `/summarize`, `/assign`, `/state`, `/tags`, `/internal-notes`, `PATCH /api/conversations/[id]` (category), `GET /api/orgs/members`, `GET /api/tags`.
- **Styling:** inline styles for true one-offs; CSS classes in `globals.css` for anything repeated/hoverable. **No Tailwind utility classes in JSX.** Design tokens only (`var(--accent)`, `var(--text-*)`, `var(--border)`, `var(--radius*)`, `var(--shadow-*)`, etc.).
- **No HOT/COLD priority badge anywhere in the chat.** Do not import `PriorityBadge` in the thread view.
- **Sender roles:** inbound = contact (initials avatar + name); outbound = `"You"` (accent avatar + accent edge). No per-member attribution (`Message` has only `direction`); `Contact` has **no `company` field** — header shows name · email · channel · subject only.
- **Module honesty:** keep `provider === 'local'` "offline" labels on AI insight, summary, and draft.
- **Verification per task:** `npm run lint` and `npm run build` both pass, plus the task's manual check. (No DOM test framework — that's the house pattern for UI.)
- **Preserve load-bearing classnames** targeted by media queries: `.thread-back` (revealed ≤600px), and keep the `@media (max-width: 768px)` chat rules working.

---

## File Structure

**Create:**
- `src/components/inbox/ThreadLayout.tsx` (client) — 3-zone layout (header / main[scroll+composer] / rail) + rail open state, toggle button, mobile drawer + scrim.
- `src/components/inbox/ThreadContextRail.tsx` (client) — composes the AI panel, properties (assignee/status/tags/category), and internal notes. Owns the members/tags/notes fetch (was in `ThreadCollab`). Receives AI analysis as props.
- `src/components/inbox/MessageCard.tsx` (server) — one email-style card (sender row + body); body = sanitized inline HTML or `<EmailFrame/>`.
- `src/lib/format-time.ts` — shared `formatStamp(d, now)` + `dayLabel(d, now)` (moved out of `page.tsx` so `MessageCard` can use them).

**Modify:**
- `src/app/(dashboard)/inbox/[id]/page.tsx` — restructure to compose pieces into `ThreadLayout`; remove `PriorityBadge`, `.chat-ai` banner, header `CategoryMover`/`ThreadCollab`/`ThreadSummary`.
- `src/components/Composer.tsx` — integrated toolbar; styled tone menu (replace native `<select>`); inline steer.
- `src/components/ThreadSummary.tsx` — restyle as the "Catch me up" expander used inside the rail AI panel (logic unchanged).
- `src/app/(dashboard)/inbox/[id]/loading.tsx` — skeleton matches new shape.
- `src/app/globals.css` — add `.chat-body/.chat-main/.chat-scroll/.chat-rail`, `.rail-*`, `.msg-card*`, `.rail-toggle`, restyled `.composer*`; retire `.msg-bubble*`, `.chat-row*`, `.chat-ai*`, `.chat-time`.

**Delete:**
- `src/components/ThreadCollab.tsx` — absorbed into `ThreadContextRail`.

---

## Task 1: Message cards (timestamps + MessageCard + CSS)

Swap the bubble message loop for email-style cards. Header/composer/rail stay as-is this task (valid intermediate state).

**Files:**
- Create: `src/lib/format-time.ts`
- Create: `src/components/inbox/MessageCard.tsx`
- Modify: `src/app/(dashboard)/inbox/[id]/page.tsx` (message loop only)
- Modify: `src/app/globals.css` (add `.msg-card*`; keep old classes for now)

**Interfaces:**
- Produces: `formatStamp(d: Date | string, now: Date): string`, `dayLabel(d: Date, now: Date): string` from `@/lib/format-time`.
- Produces: `MessageCard` default export, props `{ msg: { id; direction; content; contentHtml: string | null; sentAt: Date | string }, contactName: string, now: Date, cont: boolean }`.

- [ ] **Step 1: Create `src/lib/format-time.ts`**

```ts
/** Absolute message stamp: "9:20 AM" today, "Jun 20" / "Jun 20, 2025" older. */
export function formatStamp(d: Date | string, now: Date): string {
  const date = new Date(d)
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
  return date.toLocaleDateString('en-US', opts)
}

/** Full datetime for hover titles. */
export function fullStamp(d: Date | string): string {
  return new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Day-separator label: Today / Yesterday / "Mar 4" / "Mar 4, 2025". */
export function dayLabel(d: Date, now: Date): string {
  const day = (x: Date) => Math.floor((x.getTime() - x.getTimezoneOffset() * 60000) / 86_400_000)
  const diff = day(now) - day(d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
  return d.toLocaleDateString('en-US', opts)
}
```

- [ ] **Step 2: Create `src/components/inbox/MessageCard.tsx`** (server component)

```tsx
import { UserRound } from 'lucide-react'
import EmailFrame from '@/components/EmailFrame'
import { sanitizeMessageHtml, sanitizeEmailRich } from '@/lib/sanitize-email'
import { formatStamp, fullStamp } from '@/lib/format-time'

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]?.toUpperCase() ?? '').slice(0, 2).join('') || '?'
}

type Msg = {
  id: string
  direction: string
  content: string
  contentHtml: string | null
  sentAt: Date | string
}

export default function MessageCard({
  msg,
  contactName,
  now,
  cont,
}: {
  msg: Msg
  contactName: string
  now: Date
  cont: boolean
}) {
  const out = msg.direction === 'OUTBOUND'
  const rich = msg.contentHtml ? sanitizeEmailRich(msg.contentHtml) : null
  const isEmail = !!(rich && rich.html.length > 0)

  return (
    <article className={`msg-card ${out ? 'out' : 'in'}${cont ? ' cont' : ''}`}>
      <header className="msg-card-head">
        <span className={`msg-avatar ${out ? 'out' : 'in'}`} aria-hidden>
          {out ? <UserRound size={15} /> : initials(contactName)}
        </span>
        <span className="msg-sender">{out ? 'You' : contactName}</span>
        <time className="msg-time" dateTime={new Date(msg.sentAt).toISOString()} title={fullStamp(msg.sentAt)}>
          {formatStamp(msg.sentAt, now)}
        </time>
      </header>
      <div className={`msg-body${isEmail ? ' msg-body-email' : ''}`}>
        {isEmail ? (
          <EmailFrame html={rich!.html} hasImages={rich!.hasImages} />
        ) : (
          <div className="msg-html" dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(msg.content) }} />
        )}
      </div>
    </article>
  )
}
```

- [ ] **Step 3: Replace the message loop in `page.tsx`**

Remove the `formatTime`/`dayLabel` local functions (now in `@/lib/format-time`) and the bubble JSX. Keep the `rows` grouping precompute, but simplify each row to `{ msg, sentAt, newDay, cont }` (drop `groupEnd`/`rich` — `MessageCard` computes rich itself). Import at top: `import MessageCard from '@/components/inbox/MessageCard'` and `import { dayLabel } from '@/lib/format-time'`. The messages block becomes:

```tsx
<div className="chat-messages thread-messages">
  {rows.length === 0 ? (
    <div className="inbox-empty" style={{ padding: '60px 24px' }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No messages yet</p>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
        New messages in this thread will appear here after the next sync.
      </p>
    </div>
  ) : (
    rows.map(({ msg, sentAt, newDay, cont }) => (
      <Fragment key={msg.id}>
        {newDay && (
          <div className="chat-day-sep"><span>{dayLabel(sentAt, now)}</span></div>
        )}
        <MessageCard msg={msg} contactName={conv.contact.name} now={now} cont={cont} />
      </Fragment>
    ))
  )}
</div>
```

Update the `rows` precompute to drop `groupEnd`:

```tsx
const rows = conv.messages.map((msg, i) => {
  const prev = conv.messages[i - 1]
  const sentAt = new Date(msg.sentAt)
  const newDay = !prev || new Date(prev.sentAt).toDateString() !== sentAt.toDateString()
  const cont =
    !newDay &&
    prev !== undefined &&
    prev.direction === msg.direction &&
    sentAt.getTime() - new Date(prev.sentAt).getTime() < 10 * 60_000
  return { msg, sentAt, newDay, cont }
})
```

- [ ] **Step 4: Add `.msg-card*` CSS** to `globals.css` (near the old `.msg-bubble` block; leave old classes until Task 5)

```css
/* ── Email-style message cards ──────────────────────────────────────────── */
.msg-card {
  margin-top: 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-xs);
  overflow: hidden;
}
.msg-card:first-child { margin-top: 0; }
.msg-card.cont { margin-top: 6px; }
.msg-card.out { border-left: 2px solid var(--accent); }
.msg-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px 0;
}
.msg-avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  font-size: 11.5px; font-weight: 700; color: #fff;
}
.msg-avatar.in  { background: linear-gradient(135deg, #4b6bff, #9b6bff); }
.msg-avatar.out { background: var(--accent); }
.msg-sender { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.msg-time { margin-left: auto; font-size: 11.5px; color: var(--text-muted); flex-shrink: 0; }
.msg-body { padding: 8px 16px 14px; font-size: 13.5px; line-height: 1.6; color: var(--text-primary); }
.msg-body-email { padding: 12px 16px 14px; }
/* email frame sits flush inside the card (card already supplies the chrome) */
.msg-body-email .email-frame-wrap { border: none; border-radius: 8px; box-shadow: none; }
```

- [ ] **Step 5: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 6: Manual check**

Open any thread (`/inbox/<id>`). Messages render as full-width cards with a sender row (avatar + name + absolute time) and body; inbound shows the contact's initials/name, outbound shows a person icon + "You" + an accent left edge; HTML emails render inside the same card chrome (no double border); day separators still appear.

- [ ] **Step 7: Commit**

```bash
git add src/lib/format-time.ts src/components/inbox/MessageCard.tsx "src/app/(dashboard)/inbox/[id]/page.tsx" src/app/globals.css
git commit -m "feat(inbox): email-style message cards (retire chat bubbles)"
```

---

## Task 2: ThreadLayout shell (slim header + rail container + drawer)

Introduce the 3-zone layout and slim the header. The rail temporarily renders the **existing** `ThreadCollab` + AI insight markup moved out of the header, so the app stays whole; Task 3 rebuilds the rail's content.

**Files:**
- Create: `src/components/inbox/ThreadLayout.tsx`
- Modify: `src/app/(dashboard)/inbox/[id]/page.tsx` (compose pieces)
- Modify: `src/app/globals.css` (layout + header + rail-toggle + drawer)

**Interfaces:**
- Produces: `ThreadLayout` default export, props `{ header: ReactNode; messages: ReactNode; composer: ReactNode; rail: ReactNode }`.
- Consumes: nothing new.

- [ ] **Step 1: Create `src/components/inbox/ThreadLayout.tsx`** (client)

```tsx
'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, PanelRight } from 'lucide-react'

export default function ThreadLayout({
  header,
  messages,
  composer,
  rail,
}: {
  header: ReactNode
  messages: ReactNode
  composer: ReactNode
  rail: ReactNode
}) {
  const [railOpen, setRailOpen] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Desktop: rail open by default. Mobile: closed (opens as a drawer). Done in
  // an effect so SSR/first paint is deterministic (no hydration mismatch).
  useEffect(() => {
    setMounted(true)
    if (window.matchMedia('(max-width: 768px)').matches) setRailOpen(false)
  }, [])

  return (
    <div className="chat">
      <div className="chat-header">
        <Link href="/inbox" className="thread-back"><ArrowLeft size={15} /> Inbox</Link>
        <div className="chat-header-main">{header}</div>
        {rail && (
          <button
            type="button"
            className={`rail-toggle${railOpen ? ' active' : ''}`}
            onClick={() => setRailOpen((o) => !o)}
            aria-pressed={railOpen}
            title={railOpen ? 'Hide details' : 'Show details'}
          >
            <PanelRight size={16} />
          </button>
        )}
      </div>

      <div className="chat-body">
        <div className="chat-main">
          <div className="chat-scroll">{messages}</div>
          {composer}
        </div>

        {rail && (
          <aside className={`chat-rail${railOpen ? ' open' : ''}`}>{rail}</aside>
        )}
        {rail && mounted && railOpen && (
          <button className="rail-scrim" aria-label="Close details" onClick={() => setRailOpen(false)} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Restructure `page.tsx` to compose pieces**

Replace the single `return (<div className="chat">…)` with: build `header`, `messages`, `composer`, and `rail` nodes and pass them to `ThreadLayout`. Remove imports of `PriorityBadge`, `ArrowLeft`/`Sparkles` (now used inside layout/rail), `CategoryMover`, `ThreadCollab`, `ThreadSummary` from the page top (they move into the rail in Task 3). For **this** task, keep behavior by passing the still-existing markup into the rail. Concretely:

```tsx
import { Fragment } from 'react'
import { notFound } from 'next/navigation'
import { requireOrgPage } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import MessageCard from '@/components/inbox/MessageCard'
import ThreadLayout from '@/components/inbox/ThreadLayout'
import ThreadContextRail from '@/components/inbox/ThreadContextRail'
import Composer from '@/components/Composer'
import { dayLabel } from '@/lib/format-time'
import { getReadyDraft } from '@/services/draft.service'
// (no PriorityBadge import)
```

The slim header node (no priority badge, no banner, no collab):

```tsx
const header = (
  <div className="chat-id">
    <div className="chat-avatar">{initials(conv.contact.name)}</div>
    <div className="chat-id-text">
      <h2 className="chat-name">{conv.contact.name}</h2>
      <div className="chat-sub">
        <span className="chat-chip">{channelName}</span>
        {conv.contact.email && <span className="chat-email">{conv.contact.email}</span>}
        {conv.subject && <span className="chat-subject">{conv.subject}</span>}
      </div>
    </div>
  </div>
)
```

The messages node = the `<div className="chat-messages thread-messages">…</div>` from Task 1 (the `.chat-scroll` wrapper now comes from `ThreadLayout`, so this inner div keeps only its padding role — rename its class usage in Task 5; for now leave `chat-messages` but it lives inside `.chat-scroll`). To avoid double-scroll, change this wrapper to a plain block:

```tsx
const messages = rows.length === 0 ? (
  <div className="inbox-empty" style={{ padding: '60px 24px' }}>…</div>
) : (
  rows.map(({ msg, sentAt, newDay, cont }) => (
    <Fragment key={msg.id}>
      {newDay && <div className="chat-day-sep"><span>{dayLabel(sentAt, now)}</span></div>}
      <MessageCard msg={msg} contactName={conv.contact.name} now={now} cont={cont} />
    </Fragment>
  ))
)
```

The composer node:

```tsx
const composer =
  conv.channel === 'GMAIL' && conv.contact.email ? (
    <Composer conversationId={conv.id} initialDraft={readyDraft} autoDraft={wantsAutoDraft && !readyDraft} />
  ) : null
```

The rail node (Task 3 builds `ThreadContextRail`; until then this task can pass the **old** markup inline to keep things working — but since Task 3 immediately follows, pass the new component and build it next):

```tsx
const rail = (
  <ThreadContextRail
    conversationId={conv.id}
    initialAssigneeId={conv.assigneeId}
    initialState={conv.state as 'OPEN' | 'SNOOZED' | 'CLOSED'}
    category={conv.category as EmailCategory}
    analysis={
      analysis
        ? {
            summary: analysis.summary,
            riskLevel: analysis.riskLevel,
            nextAction: analysis.nextAction,
            provider: analyzedBy,
          }
        : null
    }
  />
)

return <ThreadLayout header={header} messages={messages} composer={composer} rail={rail} />
```

Keep the `initials` helper local to `page.tsx` for the header avatar. Keep `channelName`, `analysis`, `analyzedBy`, `readyDraft`, `wantsAutoDraft`, `now`, `rows` computations.

> Because Task 2 references `ThreadContextRail`, do Task 2 + Task 3 together before building (the build won't pass until `ThreadContextRail` exists). Commit at the end of Task 3. If you prefer a green build at Task 2's end, temporarily inline the old `ThreadCollab` + AI markup as the `rail` node, then replace in Task 3.

- [ ] **Step 3: Add layout + slim-header + rail-toggle + drawer CSS** to `globals.css`

```css
/* ── Thread layout (header / main / rail) ───────────────────────────────── */
.chat-header {
  display: flex; align-items: center; gap: 12px;
  flex-shrink: 0; background: #fff;
  border-bottom: 1px solid var(--border);
  padding: 12px 20px;
}
.chat-header-main { flex: 1; min-width: 0; }
.chat-id { display: flex; align-items: center; gap: 11px; min-width: 0; }
.chat-id-text { min-width: 0; }
.chat-sub { display: flex; align-items: center; gap: 8px; margin-top: 3px; min-width: 0; }
.chat-subject { font-size: 12.5px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

.rail-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; flex-shrink: 0;
  border-radius: 9px; border: 1px solid var(--border);
  background: #fff; color: var(--text-secondary); cursor: pointer;
  transition: color .13s, border-color .13s, background .13s;
}
.rail-toggle:hover { color: var(--text-primary); border-color: var(--accent); }
.rail-toggle.active { color: var(--accent); border-color: var(--accent); background: var(--accent-dim); }

.chat-body { display: flex; flex: 1; min-height: 0; }
.chat-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.chat-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 22px 24px; background: var(--bg-subtle); display: flex; flex-direction: column; }

.chat-rail {
  width: 320px; flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: #fff; overflow-y: auto;
  display: none;
}
.chat-rail.open { display: block; }
.rail-scrim { display: none; }

@media (max-width: 768px) {
  .chat-header { padding: 10px 14px; }
  .chat-scroll { padding: 16px 16px; }
  .chat-rail {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 50;
    width: min(86vw, 340px); border-left: 1px solid var(--border);
    transform: translateX(100%); transition: transform .22s cubic-bezier(.16,1,.3,1);
    display: block;
  }
  .chat-rail.open { transform: translateX(0); }
  .rail-scrim {
    display: block; position: fixed; inset: 0; z-index: 40;
    background: rgba(12,18,60,.32); border: none; cursor: pointer;
  }
}
```

- [ ] **Step 4: Verify build + lint** (after Task 3's `ThreadContextRail` exists)

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 5: Manual check**

Header is one slim row: avatar · name · channel chip · email · subject, with a panel-toggle button on the right and **no HOT/COLD badge / no AI banner**. Desktop shows the rail as a right column; clicking the toggle hides/shows it. Resize to ≤768px → rail is hidden by default; toggle opens it as a right drawer over a scrim; scrim click closes it.

(Commit happens at the end of Task 3.)

---

## Task 3: ThreadContextRail (AI panel + properties + notes) & delete ThreadCollab

Build the rail's real content: a unified AI panel, the properties block (assignee/status/tags/category), and internal notes. Port the data logic from `ThreadCollab`, convert to CSS classes, then delete `ThreadCollab`.

**Files:**
- Create: `src/components/inbox/ThreadContextRail.tsx`
- Modify: `src/components/ThreadSummary.tsx` (restyle as inline expander)
- Modify: `src/app/globals.css` (`.rail-section`, `.rail-ai*`, `.rail-prop*`, `.rail-notes*`)
- Delete: `src/components/ThreadCollab.tsx`

**Interfaces:**
- Consumes: `ThreadLayout` (Task 2), `MessageCard` (Task 1).
- Produces: `ThreadContextRail` default export, props:
  ```ts
  {
    conversationId: string
    initialAssigneeId: string | null
    initialState: 'OPEN' | 'SNOOZED' | 'CLOSED'
    category: EmailCategory
    analysis: { summary: string; riskLevel: string; nextAction: string | null; provider: string } | null
  }
  ```

- [ ] **Step 1: Create `src/components/inbox/ThreadContextRail.tsx`** (client)

Port the members/tags/notes state + handlers verbatim from `ThreadCollab` (the `useEffect` loader, `assign`, `changeState`, `toggleTag`, `addNote`, outside-click for menus). Add a `RISK` chip map and embed `CategoryMover` + a restyled `ThreadSummary`. Render three `.rail-section`s. Full component:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Send, Sparkles, Tag as TagIcon, UserRound } from 'lucide-react'
import CategoryMover from '@/components/CategoryMover'
import ThreadSummary from '@/components/ThreadSummary'
import type { EmailCategory } from '@/types'

type Member = { membershipId: string; name: string | null; email: string; role: string }
type Tag = { id: string; name: string; color: string }
type Note = { id: string; body: string; authorName: string; createdAt: string }
type State = 'OPEN' | 'SNOOZED' | 'CLOSED'
type Analysis = { summary: string; riskLevel: string; nextAction: string | null; provider: string } | null

const STATES: { value: State; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'SNOOZED', label: 'Snoozed' },
  { value: 'CLOSED', label: 'Closed' },
]

const RISK: Record<string, { label: string; color: string }> = {
  LOW:      { label: 'Low risk',    color: 'var(--cold)' },
  MEDIUM:   { label: 'Medium risk', color: 'var(--attention)' },
  HIGH:     { label: 'High risk',   color: 'var(--hot)' },
  CRITICAL: { label: 'Critical',    color: 'var(--hot)' },
}

function memberLabel(m: Member): string { return m.name?.trim() || m.email }
function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function ThreadContextRail({
  conversationId,
  initialAssigneeId,
  initialState,
  category,
  analysis,
}: {
  conversationId: string
  initialAssigneeId: string | null
  initialState: State
  category: EmailCategory
  analysis: Analysis
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [meId, setMeId] = useState<string | null>(null)
  const [assigneeId, setAssigneeId] = useState<string | null>(initialAssigneeId)
  const [state, setState] = useState<State>(initialState)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [convTags, setConvTags] = useState<Tag[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [noteText, setNoteText] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const assignRef = useRef<HTMLDivElement>(null)
  const tagRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [m, t, ct, n] = await Promise.all([
        fetch('/api/orgs/members').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/tags').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/conversations/${conversationId}/tags`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/conversations/${conversationId}/internal-notes`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      if (!alive) return
      if (m) { setMembers(m.members ?? []); setMeId(m.me ?? null) }
      if (t) setAllTags(t.tags ?? [])
      if (ct) setConvTags(ct.tags ?? [])
      if (n) setNotes(n.notes ?? [])
    })()
    return () => { alive = false }
  }, [conversationId])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) setAssignOpen(false)
      if (tagRef.current && !tagRef.current.contains(e.target as Node)) setTagOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const assignee = members.find((m) => m.membershipId === assigneeId) ?? null
  const risk = analysis ? (RISK[analysis.riskLevel] ?? RISK.LOW) : null

  async function assign(membershipId: string | null) {
    setAssignOpen(false); setAssigneeId(membershipId); setBusy(true)
    try {
      await fetch(`/api/conversations/${conversationId}/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId }),
      })
    } finally { setBusy(false) }
  }
  async function changeState(next: State) {
    setState(next); setBusy(true)
    try {
      await fetch(`/api/conversations/${conversationId}/state`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: next }),
      })
    } finally { setBusy(false) }
  }
  async function toggleTag(tag: Tag) {
    const attached = !convTags.some((t) => t.id === tag.id)
    setConvTags((prev) => (attached ? [...prev, tag] : prev.filter((t) => t.id !== tag.id)))
    await fetch(`/api/conversations/${conversationId}/tags`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: tag.id, attached }),
    })
  }
  async function addNote() {
    const body = noteText.trim()
    if (!body) return
    setNoteText('')
    const r = await fetch(`/api/conversations/${conversationId}/internal-notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (r.ok) { const note = await r.json(); setNotes((prev) => [...prev, note]) }
  }

  return (
    <div className="rail">
      {/* AI panel */}
      <section className="rail-section">
        <div className="rail-ai-head">
          <span className="rail-ai-icon"><Sparkles size={13} /></span>
          <span className="rail-ai-title">AI insight</span>
          {risk && <span className="rail-risk" style={{ color: risk.color }}><span className="rail-risk-dot" style={{ background: risk.color }} />{risk.label}</span>}
        </div>
        {analysis ? (
          <>
            <p className="rail-ai-summary">{analysis.summary}</p>
            {analysis.nextAction && <p className="rail-ai-action">→ {analysis.nextAction}</p>}
            {analysis.provider === 'local' && (
              <span className="rail-offline" title="Generated by the offline heuristic — add a Gemini key for full AI analysis">offline mode</span>
            )}
            <ThreadSummary conversationId={conversationId} />
          </>
        ) : (
          <p className="rail-empty">Not analyzed yet. Insight appears after the next sync/analysis.</p>
        )}
      </section>

      {/* Properties */}
      <section className="rail-section">
        <h3 className="rail-label">Properties</h3>

        <div className="rail-prop">
          <span className="rail-prop-k">Assignee</span>
          <div ref={assignRef} className="rail-prop-v">
            <button type="button" onClick={() => setAssignOpen((o) => !o)} disabled={busy} className="rail-select">
              <UserRound size={13} />
              <span className="rail-select-label">{assignee ? memberLabel(assignee) : 'Unassigned'}</span>
              <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
            {assignOpen && (
              <div className="rail-menu" role="listbox">
                <button type="button" className="rail-menu-item" onClick={() => assign(meId)} disabled={!meId}>Assign to me</button>
                <button type="button" className="rail-menu-item" onClick={() => assign(null)}>
                  Unassigned {assigneeId === null && <Check size={13} style={{ color: 'var(--accent)' }} />}
                </button>
                <div className="rail-menu-sep" />
                {members.map((m) => (
                  <button key={m.membershipId} type="button" className="rail-menu-item" onClick={() => assign(m.membershipId)}>
                    <span className="rail-trunc">{memberLabel(m)}</span>
                    {assigneeId === m.membershipId && <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rail-prop">
          <span className="rail-prop-k">Status</span>
          <div className="rail-seg" role="group" aria-label="Conversation state">
            {STATES.map((s) => (
              <button key={s.value} type="button" onClick={() => changeState(s.value)} disabled={busy} data-active={state === s.value} className="rail-seg-btn">
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rail-prop">
          <span className="rail-prop-k">Category</span>
          <div className="rail-prop-v"><CategoryMover conversationId={conversationId} current={category} /></div>
        </div>

        <div className="rail-prop">
          <span className="rail-prop-k">Tags</span>
          <div ref={tagRef} className="rail-prop-v">
            <button type="button" onClick={() => setTagOpen((o) => !o)} className="rail-select">
              <TagIcon size={13} />
              <span className="rail-select-label">{convTags.length ? `${convTags.length} tag${convTags.length > 1 ? 's' : ''}` : 'Add tags'}</span>
              <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
            {tagOpen && (
              <div className="rail-menu" role="listbox">
                {allTags.length === 0 && <div className="rail-menu-empty">No tags yet — create them in Settings.</div>}
                {allTags.map((t) => {
                  const on = convTags.some((c) => c.id === t.id)
                  return (
                    <button key={t.id} type="button" className="rail-menu-item" onClick={() => toggleTag(t)}>
                      <span className="rail-trunc" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color, flexShrink: 0 }} />{t.name}
                      </span>
                      {on && <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {convTags.length > 0 && (
          <div className="rail-tag-chips">
            {convTags.map((t) => (
              <span key={t.id} className="rail-tag-chip" style={{ color: t.color, background: `${t.color}1a`, borderColor: `${t.color}55` }}>
                {t.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Internal notes */}
      <section className="rail-section">
        <h3 className="rail-label">Internal notes <span className="rail-label-hint">· only your team</span></h3>
        {notes.length > 0 && (
          <div className="rail-notes-list">
            {notes.map((n) => (
              <div key={n.id} className="rail-note">
                <div className="rail-note-head">
                  <span className="rail-note-author">{n.authorName}</span>
                  <span className="rail-note-time">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="rail-note-body">{n.body}</p>
              </div>
            ))}
          </div>
        )}
        <div className="rail-note-compose">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add an internal note…"
            rows={2}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addNote() } }}
            className="rail-note-input"
          />
          <button type="button" onClick={addNote} disabled={!noteText.trim()} className="btn-primary rail-note-send">
            <Send size={13} /> Note
          </button>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Restyle `ThreadSummary.tsx`** — change only the wrapper/card classes so it reads as an inline expander inside the AI panel. Replace the outer `className="thread-summary"` with `className="rail-summary"`, the button `className="thread-summary-btn"` with `className="rail-summary-btn"`, and the card `className="thread-summary-card"` with `className="rail-summary-card"`. Keep all logic, the `ts-*` inner classes, and the offline label as-is. (CSS for `.rail-summary*` added in Step 3.)

- [ ] **Step 3: Add rail-content CSS** to `globals.css`

```css
/* ── Context rail content ───────────────────────────────────────────────── */
.rail { display: flex; flex-direction: column; }
.rail-section { padding: 16px 18px; border-bottom: 1px solid var(--border-light); }
.rail-section:last-child { border-bottom: none; }
.rail-label { margin: 0 0 10px; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); }
.rail-label-hint { font-weight: 600; text-transform: none; letter-spacing: 0; }

.rail-ai-head { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
.rail-ai-icon { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 7px; color: #fff; background: linear-gradient(135deg, #4b6bff, #9b6bff); }
.rail-ai-title { font-size: 12px; font-weight: 700; color: var(--text-primary); }
.rail-risk { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; font-size: 11px; font-weight: 700; }
.rail-risk-dot { width: 7px; height: 7px; border-radius: 50%; }
.rail-ai-summary { margin: 0 0 7px; font-size: 13px; color: var(--text-secondary); line-height: 1.55; }
.rail-ai-action { margin: 0 0 4px; font-size: 13px; font-weight: 600; color: var(--accent); line-height: 1.45; }
.rail-offline { display: inline-block; font-size: 10.5px; font-weight: 600; font-style: italic; color: var(--text-muted); }
.rail-empty { margin: 0; font-size: 12.5px; color: var(--text-muted); line-height: 1.5; }

.rail-summary { margin-top: 10px; }
.rail-summary-btn { display: inline-flex; align-items: center; gap: 7px; padding: 6px 11px; border-radius: 8px; border: 1px solid var(--border); background: #fff; color: var(--text-secondary); font-size: 12px; font-weight: 600; font-family: var(--font-sans); cursor: pointer; transition: border-color .13s, color .13s; }
.rail-summary-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.rail-summary-btn:disabled { opacity: .6; cursor: default; }
.rail-summary-card { margin-top: 9px; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--border-light); background: var(--bg-subtle); }

.rail-prop { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; }
.rail-prop:last-child { margin-bottom: 0; }
.rail-prop-k { width: 64px; flex-shrink: 0; font-size: 12px; font-weight: 600; color: var(--text-muted); }
.rail-prop-v { position: relative; flex: 1; min-width: 0; }
.rail-select { display: inline-flex; align-items: center; gap: 7px; width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border); background: #fff; color: var(--text-primary); font-size: 12.5px; font-weight: 600; font-family: var(--font-sans); cursor: pointer; }
.rail-select:hover { border-color: var(--accent); }
.rail-select-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.rail-menu { position: absolute; top: calc(100% + 5px); left: 0; right: 0; z-index: 20; padding: 5px; border-radius: 10px; border: 1px solid var(--border); background: #fff; box-shadow: var(--shadow-lg); max-height: 240px; overflow-y: auto; }
.rail-menu-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 7px 9px; border: none; border-radius: 7px; background: none; color: var(--text-primary); font-size: 12.5px; font-family: var(--font-sans); cursor: pointer; text-align: left; }
.rail-menu-item:hover { background: var(--bg-subtle); }
.rail-menu-item:disabled { opacity: .5; cursor: default; }
.rail-menu-sep { height: 1px; background: var(--border-light); margin: 4px 0; }
.rail-menu-empty { padding: 8px 9px; font-size: 12px; color: var(--text-muted); }
.rail-trunc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

.rail-seg { display: inline-flex; flex: 1; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.rail-seg-btn { flex: 1; padding: 6px 0; border: none; background: #fff; color: var(--text-secondary); font-size: 11.5px; font-weight: 600; font-family: var(--font-sans); cursor: pointer; border-right: 1px solid var(--border); }
.rail-seg-btn:last-child { border-right: none; }
.rail-seg-btn[data-active='true'] { background: var(--accent-dim); color: var(--accent); }
.rail-seg-btn:disabled { cursor: default; }

.rail-tag-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 9px; }
.rail-tag-chip { font-size: 11px; font-weight: 600; border: 1px solid; border-radius: 100px; padding: 2px 9px; }

.rail-notes-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 9px; }
.rail-note { background: var(--bg-subtle); border: 1px solid var(--border-light); border-radius: 9px; padding: 8px 10px; }
.rail-note-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
.rail-note-author { font-size: 11.5px; font-weight: 700; color: var(--text-primary); }
.rail-note-time { font-size: 10.5px; color: var(--text-muted); }
.rail-note-body { margin: 0; font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap; }
.rail-note-compose { display: flex; flex-direction: column; gap: 7px; }
.rail-note-input { resize: vertical; min-height: 52px; padding: 8px 10px; font-size: 12.5px; border-radius: 9px; border: 1px solid var(--border); background: #fff; color: var(--text-primary); outline: none; font-family: inherit; }
.rail-note-input:focus { border-color: var(--accent); }
.rail-note-send { align-self: flex-end; padding: 7px 12px; font-size: 12.5px; gap: 6px; }
```

- [ ] **Step 4: Delete `ThreadCollab.tsx` + remove its import from `page.tsx`**

```bash
git rm src/components/ThreadCollab.tsx
```

Ensure `page.tsx` no longer imports `ThreadCollab`, `CategoryMover`, `ThreadSummary`, or `PriorityBadge` (CategoryMover/ThreadSummary are now imported by the rail; PriorityBadge is gone).

- [ ] **Step 5: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: both pass (no unused-import or type errors; `EmailCategory` still imported in `page.tsx` for the rail prop cast).

- [ ] **Step 6: Manual check**

Rail shows three sections: **AI insight** (gradient icon + risk chip + summary + → next action + a "Catch me up" expander that loads the structured summary), **Properties** (Assignee dropdown, Status segmented control, Category mover, Tags dropdown + chips — all persist + survive refresh), **Internal notes** (list + a compose box; Cmd/Ctrl+Enter posts). No second composer competes in the conversation column.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(inbox): context rail (unified AI + properties + notes); drop overloaded header"
```

---

## Task 4: Composer redesign (integrated toolbar, styled tone menu, inline steer)

**Files:**
- Modify: `src/components/Composer.tsx`
- Modify: `src/app/globals.css` (`.composer*` restyle + `.composer-tone-menu`)

**Interfaces:**
- Consumes: existing `/draft`, `/reply` endpoints; `TemplateMenu`, `DraftTone` type (unchanged).
- Produces: no new exports.

- [ ] **Step 1: Replace the native tone `<select>` with a styled popover** and move steer inside the block. In `Composer.tsx`: add `const [toneOpen, setToneOpen] = useState(false)` and a `toneRef` with an outside-click effect (mirror `CategoryMover`). Replace the `<select className="composer-tone">…</select>` with:

```tsx
<div className="composer-tone" ref={toneRef}>
  <button
    type="button"
    className="composer-tone-btn"
    onClick={() => setToneOpen((o) => !o)}
    disabled={busy}
    aria-haspopup="menu"
    aria-expanded={toneOpen}
    title="Tone of the AI draft"
  >
    {TONES.find((t) => t.value === tone)?.label}
    <ChevronDown size={12} />
  </button>
  {toneOpen && (
    <div className="composer-tone-menu" role="menu">
      {TONES.map((t) => (
        <button
          key={t.value}
          type="button"
          role="menuitemradio"
          aria-checked={tone === t.value}
          className="composer-tone-item"
          data-active={tone === t.value}
          onClick={() => { setTone(t.value); setToneOpen(false) }}
        >
          {t.label}{tone === t.value && <Check size={13} style={{ color: 'var(--accent)' }} />}
        </button>
      ))}
    </div>
  )}
</div>
```

Add the outside-click effect:

```tsx
useEffect(() => {
  if (!toneOpen) return
  function onDown(e: MouseEvent) {
    if (toneRef.current && !toneRef.current.contains(e.target as Node)) setToneOpen(false)
  }
  document.addEventListener('mousedown', onDown)
  return () => document.removeEventListener('mousedown', onDown)
}, [toneOpen])
```

Update imports: `import { AlertCircle, Check, ChevronDown, Loader, PencilLine, RotateCcw, Send, Sparkles } from 'lucide-react'`.

- [ ] **Step 2: Move the steer field inside the composer block.** Wrap the row + steer in a single `.composer-block`. Replace the current top-level `{showSteer && <input className="composer-steer" …/>}` and `.composer-row` with:

```tsx
<div className="composer-block">
  {showSteer && (
    <input
      className="composer-steer"
      value={steer}
      onChange={(e) => setSteer(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void draft() } }}
      placeholder="Tell the AI what to say… (e.g. “confirm we ship Friday”)"
      maxLength={500}
      disabled={busy}
      aria-label="What the AI draft should say"
    />
  )}
  <div className="composer-row">
    <textarea
      ref={textareaRef}
      value={body}
      onChange={(e) => { setBody(e.target.value); autoGrow() }}
      onKeyDown={onKeyDown}
      placeholder="Write a reply…"
      rows={1}
      disabled={sending}
      aria-label="Reply"
    />
    <button onClick={() => void send()} disabled={sending || !body.trim()} className="composer-send" aria-label="Send reply">
      {sending ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
    </button>
  </div>
  <div className="composer-tools">
    {/* AI draft button + tone popover (Step 1) + Steer toggle + TemplateMenu + offline label + hint — unchanged markup, now inside the block */}
  </div>
</div>
```

Keep the existing `.composer-tools` children (AI draft button, the new tone popover, the Steer toggle button, `TemplateMenu`, the `aiProvider==='local'` label, and the hint). Keep the top-level `{error && …}` above `.composer-block`.

- [ ] **Step 3: Restyle `.composer*` CSS.** Replace the existing composer block (the `.composer { … }` … `.composer-hint-inline` range) with:

```css
.composer { border-top: 1px solid var(--border); padding: 12px 24px 16px; background: #fff; flex-shrink: 0; }
.composer-error { display: flex; align-items: center; gap: 7px; margin: 0 0 9px; font-size: 12.5px; color: var(--hot); background: var(--hot-dim); border: 1px solid var(--hot-border); border-radius: 8px; padding: 7px 11px; }
.composer-block { border: 1.5px solid var(--border); border-radius: 14px; background: var(--bg-surface); padding: 8px 8px 8px 14px; transition: border-color .15s, box-shadow .15s; }
.composer-block:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,92,244,.1); }
.composer-steer { width: 100%; margin: 2px 0 8px; padding: 8px 11px; border: 1px solid var(--accent); border-radius: 10px; background: var(--accent-dim); font-family: var(--font-sans); font-size: 13px; color: var(--text-primary); outline: none; box-sizing: border-box; }
.composer-steer::placeholder { color: var(--text-muted); }
.composer-row { display: flex; align-items: flex-end; gap: 9px; }
.composer-row textarea { flex: 1; resize: none; max-height: 200px; min-height: 24px; padding: 6px 0; border: none; background: transparent; font-family: var(--font-sans); font-size: 14px; line-height: 1.55; color: var(--text-primary); outline: none; }
.composer-row textarea::placeholder { color: var(--text-muted); }
.composer-send { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: none; background: var(--accent); color: #fff; cursor: pointer; flex-shrink: 0; transition: background .15s, transform .15s, opacity .15s; }
.composer-send:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); }
.composer-send:disabled { opacity: .45; cursor: default; }
.composer-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-light); }
.composer-tool { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 9px; border: 1px solid var(--border); background: #fff; color: var(--text-secondary); font-size: 12px; font-weight: 600; font-family: var(--font-sans); cursor: pointer; transition: border-color .13s, color .13s, background .13s; }
.composer-tool:hover:not(:disabled) { border-color: rgba(79,92,244,.4); color: var(--text-primary); }
.composer-tool:disabled { opacity: .5; cursor: default; }
.composer-tool.active { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
.composer-tool-ai { color: var(--accent); border-color: rgba(79,92,244,.35); }
.composer-tool-ai:hover:not(:disabled) { background: var(--accent-dim); }
.composer-tone { position: relative; }
.composer-tone-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 9px; border: 1px solid var(--border); background: #fff; color: var(--text-secondary); font-size: 12px; font-weight: 600; font-family: var(--font-sans); cursor: pointer; }
.composer-tone-btn:hover:not(:disabled) { border-color: rgba(79,92,244,.4); color: var(--text-primary); }
.composer-tone-btn:disabled { opacity: .5; cursor: default; }
.composer-tone-menu { position: absolute; bottom: calc(100% + 6px); left: 0; z-index: 20; min-width: 150px; padding: 5px; border-radius: 10px; border: 1px solid var(--border); background: #fff; box-shadow: var(--shadow-lg); }
.composer-tone-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 7px 9px; border: none; border-radius: 7px; background: none; color: var(--text-primary); font-size: 12.5px; font-weight: 600; font-family: var(--font-sans); cursor: pointer; text-align: left; }
.composer-tone-item:hover { background: var(--bg-subtle); }
.composer-tone-item[data-active='true'] { color: var(--accent); }
.composer-ai-label { font-size: 10.5px; font-weight: 600; font-style: italic; color: var(--text-muted); }
.composer-hint { font-size: 10.5px; color: var(--text-muted); user-select: none; }
.composer-hint-inline { margin: 0 0 0 auto; }
```

Update the mobile rule (the existing `@media (max-width: 768px) { .composer { padding: 10px 14px 12px; } .composer-hint { display: none; } }`) — change padding to `10px 14px 14px`; keep hiding the hint.

- [ ] **Step 4: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 5: Manual check**

Composer is one cohesive bordered block with a focus ring; the toolbar sits under a hairline divider *inside* the block. The Tone control is a styled popover (Warm/Concise/Formal/Match my style with a check on the active one), **not** a native select. Clicking Steer reveals an inline field at the top of the block; Enter in it triggers a draft. AI draft → Regenerate/Drafting states, Templates, offline label, send, and Enter-to-send all still work.

- [ ] **Step 6: Commit**

```bash
git add src/components/Composer.tsx src/app/globals.css
git commit -m "feat(inbox): polished single composer with styled tone menu + inline steer"
```

---

## Task 5: Loading skeleton + retire dead CSS

**Files:**
- Modify: `src/app/(dashboard)/inbox/[id]/loading.tsx`
- Modify: `src/app/globals.css` (delete retired classes)

- [ ] **Step 1: Rewrite `loading.tsx`** to match the new shape (slim header bar + full-width card skeletons + faint rail column):

```tsx
// Shown immediately while the server fetches the conversation detail.
export default function ConversationLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: '#fff' }}>
        <div className="skeleton" style={{ width: 30, height: 30, borderRadius: '50%' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton" style={{ width: 150, height: 15, borderRadius: 5 }} />
          <div className="skeleton" style={{ width: 220, height: 12, borderRadius: 5 }} />
        </div>
        <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 9, marginLeft: 'auto' }} />
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-subtle)' }}>
          {[88, 64, 120, 72].map((h, i) => (
            <div key={i} className="skeleton" style={{ width: '100%', height: h, borderRadius: 14 }} />
          ))}
        </div>
        <div style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--border)', background: '#fff', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }} className="loading-rail">
          <div className="skeleton" style={{ width: '100%', height: 96, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  )
}
```

Add `@media (max-width: 768px) { .loading-rail { display: none !important; } }` to `globals.css`.

- [ ] **Step 2: Delete retired CSS** from `globals.css` — remove these now-unused rules: `.msg-bubble`, `.msg-bubble-in`, `.msg-bubble-out`, `.chat-row` (+ `.cont/.in/.out/:first-child`), `.chat-time`, `.chat-ai`, `.chat-ai-head`, `.chat-ai-summary`, `.chat-ai-action`, `.chat-head-row`, `.chat-avatar` *(keep — still used by the header + a copy is needed? No: header uses `.chat-avatar`; keep it)*, and the old `.thread-summary*` block (replaced by `.rail-summary*`). Also remove the `.msg-bubble-out .msg-html *` override rules (lines styling `.msg-bubble-out .msg-html a/blockquote/pre/code/.msg-quote`) since outbound is no longer a filled bubble — the `.msg-html` base rules remain for `.msg-body`. Keep `.msg-html*`, `.msg-email`, `.email-frame*`, `.msg-quote*` (still used inside cards), `.chat-day-sep*`, `.thread-back`, `.chat-name`, `.chat-chip`, `.chat-email`, `.chat-subject`, `.chat-avatar`.

> Grep before deleting each: `rg "msg-bubble|chat-row|chat-time|chat-ai|thread-summary|chat-head-row" src` — confirm zero JSX references remain (only the CSS definitions). Remove the old `@media` lines that referenced `.msg-bubble` (the `≤768px` and `≤600px` chat blocks) — keep the `.thread-back` reveal at ≤600px and the `.chat-header`/`.chat-scroll` mobile padding from Task 2.

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 4: Manual check (full smoke)**

Reload a thread: loading skeleton matches the new layout (slim header + card skeletons + rail). Then the full flow: slim header (no HOT/COLD), consistent message cards (text + HTML email), one AI surface + properties + notes in the rail, polished composer. Toggle the rail on desktop; open/close the mobile drawer. Exercise: AI draft + regenerate + steer + tone + template, send a reply (route refreshes, new card appears), "Catch me up", assignee/status/category/tags, add a note, "Show images" on an image email.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/inbox/[id]/loading.tsx" src/app/globals.css
git commit -m "chore(inbox): match loading skeleton to redesign + retire dead chat CSS"
```

---

## Self-Review

**Spec coverage:**
- Right context rail (collapsible + mobile drawer) → Tasks 2 (shell) + 3 (content). ✓
- Slim header, no HOT/COLD, no banner, no duplicate AI → Tasks 2 + 3. ✓
- Email-style stacked cards, shared chrome for HTML email, contact vs. "You" → Task 1. ✓
- One AI surface (risk + summary + next action + Catch me up) → Task 3. ✓
- Polished single composer, styled tone menu, inline steer → Task 4. ✓
- Loading skeleton + dead-CSS cleanup → Task 5. ✓
- No backend/API/schema changes → none of the tasks touch `src/app/api`, services, or `schema.prisma`. ✓

**Placeholder scan:** No TBD/TODO; every code step shows real code; CSS blocks are concrete. ✓

**Type consistency:** `ThreadContextRail` prop `analysis` shape `{ summary; riskLevel; nextAction; provider }` matches what `page.tsx` passes (built from `analysis.summary/riskLevel/nextAction` + `analyzedBy`). `MessageCard` `Msg` type matches the Prisma `message` fields selected (`id/direction/content/contentHtml/sentAt`). `ThreadLayout` props `{header, messages, composer, rail}` match the `page.tsx` call. `formatStamp/dayLabel/fullStamp` signatures consistent across `format-time.ts`, `MessageCard`, `page.tsx`. ✓

**Note on Task 2/3 build coupling:** `page.tsx` imports `ThreadContextRail`, so the build only goes green once Task 3 creates it — implement Tasks 2 and 3 back-to-back and run the build at the end of Task 3 (single commit at Task 3 Step 7). This is called out in Task 2.
