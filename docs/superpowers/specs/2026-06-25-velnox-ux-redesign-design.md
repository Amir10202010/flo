# Velnox — UX/UI Simplification & Product Redesign

**Date:** 2026-06-25
**Author:** Product/UX audit (Claude)
**Status:** Draft for review
**Positioning decision:** *Transitioning solo → team.* The IA must work for one person today and scale to a team without a rebuild. Team features (shared inbox, Members, assignment, workload) stay **available but not loud** until an org adds a second seat.
**Cut license:** *Pre-launch — cut hard.* Recommendations below include real deletions and page removals, not just reshuffling.

---

## 0. TL;DR — the one-sentence diagnosis

> **Velnox is a genuinely good product (the AI Command Center, risk flags, and review-before-send drafts are real and differentiated) buried under an information architecture that shows the same data four times, in 11px type, across nine navigation destinations — so it reads like an internal analytics tool instead of a product that tells you what to do next.**

The fix is not more design. It is **subtraction**: collapse 9 destinations to 4, fold the duplicate "Intelligence" pages into the dashboard, lead with the one action that matters, make the type readable, and give mobile a real navigation bar.

### The five highest-leverage moves (do these first, in order)

| # | Move | Why it matters | Effort |
|---|------|----------------|--------|
| 1 | **Collapse the "Intelligence" section** (Risk, Insights → Dashboard; Analytics → a Dashboard tab; keep Clients) | Kills the core fragmentation + duplication. 9 nav items → 4. | M |
| 2 | **Lead the dashboard with the next action, not 6 KPIs** | Turns an info dashboard into an action surface. The `CommandCenter` is your best asset — it's currently 7th on the page. | S |
| 3 | **Replace the 52px mobile icon-rail with a bottom tab bar** | Mobile nav is the single worst surface for a first-timer. | M |
| 4 | **Raise the type scale** (body 12.5→14.5, labels 10.5→12) | This *is* the "feels cramped / feels like an internal tool" feeling. It's measurable. | S |
| 5 | **One assistant, one connect path** | Kill the `/assistant` page (keep the floating widget); merge `/integrations` into Settings. | S |

Everything below is the detailed version.

---

## 1. Complete UX Audit (Keep / Merge / Move / Hide / Delete)

Audited against the real codebase. Verdicts assume the *transitioning solo→team, pre-launch* frame.

### 1.1 Global navigation (`src/components/layout/Sidebar.tsx`)

Current: **9 destinations** in 4 groups + a floating assistant + a command palette.

| Element | Verdict | Action |
|---|---|---|
| Dashboard | **Keep** | Becomes the home + action surface; absorbs Risk + Insights. |
| Inbox | **Keep** | The "doing" surface. Untouched in IA, polished in density. |
| Clients | **Keep** | The one Intelligence page with standalone value (contact directory / CRM-lite). |
| Insights (`/insights`) | **Merge → Dashboard + Settings** | Its hero is the *same* `InsightCard` component as the dashboard. Trends fold into the dashboard; the Weekly Digest is a *setting*, not a page. |
| Risk Monitor (`/risk`) | **Merge → Dashboard + Alerts drawer** | Its hero (`RiskMonitor`) is already on the dashboard. Alert lifecycle (ack/resolve/snooze) becomes a slide-over drawer, not a page. |
| Analytics (`/analytics`) | **Move → Dashboard tab ("Trends")** | 4 KPIs + 10 charts. Demote: keep the 3–4 useful ones, hide the rest behind expanders. Out of the primary rail. |
| AI Assistant (`/assistant`) | **Delete the page** | Redundant with the floating `AssistantWidget` that's already on every screen. Long-term: merge into ⌘K. |
| Integrations (`/integrations`) | **Merge → Settings › Connections** | The B2B migration already moved inbox-connect into Settings › Inboxes. Two doors to one job. |
| Settings | **Keep** | Correct pattern (tabbed). Absorbs Integrations + Notifications/Digest. |
| Floating `AssistantWidget` | **Keep (the one assistant)** | Companion, not destination. |
| ⌘K Command Palette | **Keep + elevate** | This is your Linear-grade asset. Should become the omnibox: search + navigate + *ask AI* + act. |
| OrgSwitcher | **Keep** | Required for solo→team. |

**Net: 9 → 4 primary destinations** (Dashboard, Inbox, Clients, Settings), assistant floating, Analytics as a Dashboard tab.

### 1.2 Dashboard (`src/app/(dashboard)/dashboard/page.tsx`)

The home page renders, top to bottom: a sync chip, a **6-card KPI strip** (`.exec-grid`), then a 2-column grid of `CommandCenter` + `RiskMonitor` (left) and `SmartInsights` + `RemindersCard` + `ActivityTimeline` (right), then `RelationshipHealth`. **Eight modules.**

| Element | Verdict | Reasoning |
|---|---|---|
| `CommandCenter` (next best action + ranked queue) | **Keep + promote to #1** | Your single best module. It answers "what do I do now." It is currently *below* six stat cards. Move it to the literal top. |
| 6-card KPI strip (Health, Conversations, High Priority, Unanswered, Clients at Risk, Follow-ups) | **Hide 3, keep 3, make them clickable** | Six small numbers = noise, not signal. Keep **Unanswered, Clients at Risk, High Priority**. Each becomes a *button* that deep-links into a filtered Inbox. Drop Health-score, Conversations-count, Follow-ups from the top strip (Health → inside CommandCenter; the rest → Analytics tab). |
| `RiskMonitor` | **Keep** (this is now the risk surface) | Dashboard absorbs `/risk`. |
| `SmartInsights` | **Keep** (this is now the insights surface) | Dashboard absorbs `/insights`. |
| `RemindersCard` | **Keep** | Self-fetching, hides when empty. Good citizen. |
| `ActivityTimeline` | **Move → Analytics tab / collapse** | "Activity feed" is browse-not-act. Low daily value. Demote. |
| `RelationshipHealth` (3-col) | **Move → Clients page** | It's a condensed clients view. It belongs *with* Clients, not as a third dashboard band. |
| `SyncChip` | **Keep, shrink** | Move into the top bar as a small status dot. |

### 1.3 The four "Intelligence" pages — the duplication, itemized

Every one of these repeats the identical **4-KPI `StatCard` strip** (`.kpi-grid`) and re-renders a fuller version of a widget the dashboard already shows.

| Page | Unique value (keep) | Duplicated (cut) | Verdict |
|---|---|---|---|
| `/risk` | `AlertsPanel` lifecycle (ack/resolve/snooze) | KPIs, critical-threads grid, watchlist all ≈ dashboard `RiskMonitor` | **Merge.** Alerts → slide-over drawer. |
| `/insights` | Weekly Digest send/config | `InsightCard` grid = dashboard `SmartInsights`; trend KPIs ≈ dashboard | **Merge.** Digest → Settings › Notifications. |
| `/clients` | `ClientsTable` (real CRM-lite directory) | 4 KPIs partly ≈ dashboard | **Keep.** Fold `RelationshipHealth` in. |
| `/analytics` | response-time trend, volume, **team workload** | 4 KPIs; sentiment donut, risk-distribution, heatmap, busiest-day = eye-candy | **Demote to a tab.** Keep 3–4 charts, expander-hide the rest. |

### 1.4 Inbox (`src/app/(dashboard)/inbox/*`, `InboxShell`, context rail)

The 3-pane (list · thread · 320px context rail; rail goes off-canvas <768px) is **good** and the most mature surface. Mostly keep.

| Element | Verdict | Note |
|---|---|---|
| List ↔ thread mobile swap | **Keep** | Already intentional (not a stack). |
| 320px context rail (AI summary, risk, tags, notes) | **Keep** | Strong. Off-canvas on mobile is correct. |
| `Composer` AI draft / tone / regenerate | **Keep** | Differentiated. |
| `ThreadSummary` "catch me up" | **Keep** | |
| Density inside threads (13px body) | **Fix** | Bump to 14.5 (see §5). |

### 1.5 Settings (`SettingsTabs.tsx`) — 7 tabs

Workspace · Members · Inboxes · Tags · Templates · Rules · Audit log. The tabbed pattern is **correct** (Stripe/Linear do this). Tab *count* is fine for a settings surface — these are intentionally deep.

| Tab | Tier | Action |
|---|---|---|
| Workspace (org, plan, notifications, account) | T1 | Keep. Add **Connections** (merged Integrations) + **Weekly Digest** toggle here. |
| Members | T2 (T1 once 2nd seat) | Keep. |
| Inboxes | T1 | Keep — this is the connect path; make it the FTUE target. |
| Tags / Templates / Rules | T3 (power-user) | Keep as tabs. Don't surface in primary nav. |
| Audit log | T3 (compliance) | Keep. |
| "Getting started / replay tour" card | **Move** | → a help menu, not the Workspace tab. |

### 1.6 Global / cross-cutting

| Element | Verdict |
|---|---|
| `OnboardingTour` (spotlight over the live UI) | **Replace** with a setup checklist (§8). A tour over a cluttered UI just narrates the clutter. |
| Telegram references (UI/marketing/types — *not wired*, per CLAUDE.md) | **Delete from UI** | Showing a dead channel erodes trust. Hide until real. |
| `ModulePill` honesty system (live/beta/soon) | **Keep** | Genuinely good practice; keep enforcing it. |

---

## 2. Feature Prioritization (Tiers)

**Tier 1 — visible immediately (the product's job):**
- Inbox queue (awaiting reply / priority)
- **Next best action** (`CommandCenter` hero) on the Dashboard
- Risk flags (critical/high) + the Alerts drawer
- AI reply draft (review-before-send) in the Composer
- Connect-inbox (FTUE)

**Tier 2 — useful, secondary:**
- Clients directory
- Smart Insights + Reminders
- Weekly digest (it's a setting + an email)
- Core analytics: response time, threads answered %, volume, **team workload**
- Floating Assistant / ⌘K

**Tier 3 — advanced (keep, don't surface):**
- Analytics distributions (sentiment, risk dist, heatmap, busiest day)
- Tags, Templates, Rules
- Members management, Audit log

**Tier 4 — cut, hide, or merge now:**
- Standalone `/assistant` page → floating widget / ⌘K
- Standalone `/risk` page → Dashboard + drawer
- Standalone `/insights` page → Dashboard + Settings
- Standalone `/integrations` page → Settings › Connections
- The 6-up KPI strip → 3 clickable KPIs
- `ActivityTimeline` + `RelationshipHealth` as dashboard bands → relocate
- The spotlight `OnboardingTour` → setup checklist
- Telegram placeholders → remove until functional

---

## 3. New Information Architecture

### 3.1 Primary navigation — desktop sidebar

```
BEFORE (9)                          AFTER (4 + system)
─────────────────                   ─────────────────────────
  Dashboard                           ▣  Dashboard      ┐ tabs: Today · Trends
  Inbox                               ✉  Inbox          │
─ Intelligence ─                      ◐  Clients        ┘ primary
  Clients                            ───────────────
  Insights            ──►            ⚙  Settings   (Workspace·Members·Inboxes·
  Risk Monitor                          Connections·Tags·Templates·Rules·Audit)
  Analytics                          ───────────────
─ Assistant ─                        ◯ Search / ⌘K  (omnibox: find · go · ask AI)
  AI Assistant                       ✦ Assistant     (floating, every screen)
─ System ─                           [Org switcher]  [User]
  Integrations
  Settings
```

No section labels needed at 4 items. The "Intelligence" grouping disappears — its contents live where the work happens (Dashboard) or where you browse people (Clients).

### 3.2 Page hierarchy

```
/dashboard           ── Today (default) | Trends (was /analytics, slimmed)
   └─ Alerts drawer  ── slide-over (was /risk lifecycle)
/inbox
   └─ /inbox/[id]    ── thread + context rail
/clients             ── directory + RelationshipHealth folded in
   └─ /clients/[id]  ── (future) contact profile slide-over
/settings            ── tabs: Workspace · Members · Inboxes · Connections ·
                              Tags · Templates · Rules · Audit · Notifications
(removed) /risk /insights /analytics /assistant /integrations
```

### 3.3 Where the orphaned features land

| Was a page | Now lives as |
|---|---|
| `/risk` KPIs + threads | Dashboard widgets (already present) |
| `/risk` AlertsPanel | **Alerts slide-over** (bell in top bar + dashboard) |
| `/insights` InsightCards | Dashboard `SmartInsights` (already present) |
| `/insights` Weekly Digest | Settings › Notifications (toggle + "send preview") |
| `/analytics` | Dashboard **Trends tab** (slimmed) |
| `/assistant` | Floating widget (already present) + ⌘K |
| `/integrations` | Settings › **Connections** |

---

## 4. Dashboard Redesign — the single action-first home

**Principle (Goal 9):** the dashboard's first screenful must answer *"what do I do next?"* — not *"here are some numbers."*

### 4.1 Desktop wireframe

```
┌───────────────────────────────────────────────────────────────────────┐
│  Good to see you, Amir            ● synced 4m   [Trends]   [+ Compose]  │  ← header: status dot, tabs, primary CTA
├───────────────────────────────────────────────────────────────────────┤
│  ╔═══════════════════════════════════════════════════════════════════╗ │
│  ║  ⚡ NEXT BEST ACTION                                  waiting 2d   ║ │  ← CommandCenter hero, PROMOTED to #1
│  ║  ◐ Acme Corp — "Re: renewal terms"          [HIGH RISK]           ║ │     bigger, full-width, unmissable
│  ║  AI suggests: They're comparing vendors. Reassure on pricing…     ║ │
│  ║  [ Open & draft reply → ]                                          ║ │
│  ╚═══════════════════════════════════════════════════════════════════╝ │
│                                                                         │
│  ┌── 7 Unanswered ──┐ ┌── 3 At risk ──┐ ┌── 2 Urgent ──┐               │  ← 3 KPIs, each a BUTTON → filtered Inbox
│  │  oldest 3d  →    │ │  Acme, Beta  → │ │  reply now → │               │     (not 6 dead numbers)
│  └──────────────────┘ └───────────────┘ └──────────────┘               │
│                                                                         │
│  ┌─ Today's queue (ranked) ──────────┐  ┌─ Needs attention ──────────┐ │  ← CommandCenter list | SmartInsights
│  │ 2. Beta Inc   reply running late  │  │ ⚠ Response time up 40% wk  │ │
│  │ 3. Gamma LLC  AI: send proposal   │  │ ✦ 2 clients went quiet     │ │
│  │ 4. …                              │  │ + Reminders (if any)       │ │
│  └───────────────────────────────────┘  └────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
        ＊ ActivityTimeline + RelationshipHealth + full KPIs → "Trends" tab
```

### 4.2 What changed and why

1. **CommandCenter is the hero**, full-width, above everything. (Today it's 7th.)
2. **6 KPIs → 3 actionable KPIs**, each a deep-link into a pre-filtered Inbox. A number you can't act on doesn't belong on the home screen.
3. **Two columns, not three bands.** Left = your queue; right = what AI noticed. Everything browse-only (`ActivityTimeline`, `RelationshipHealth`, distributions) moves to the **Trends tab**.
4. **Alerts** = a bell in the header opening a slide-over (ack/snooze/resolve inline) — no page.
5. **"Trends" tab** holds the demoted Analytics: response-time trend, volume, threads-answered %, team workload. Sentiment donut / risk-distribution / heatmap / busiest-day go behind a "More metrics" expander.

---

## 5. Visual Density System

The complaint "cramped and narrow" is **two real problems**: (a) type is too small, and (b) too many columns make every cell narrow. The page is *already* `max-width: 1480` — width isn't the issue; **column count and type size are.**

### 5.1 Type scale (current → target)

| Token | Now | Target | Used for |
|---|---|---|---|
| label / micro | 10.5px | **12px** | section labels, chips |
| body-sm | 11.5–12px | **13px** | secondary text, metadata |
| body | 12.5–13.5px | **14.5px** | primary content, list rows |
| title-sm | 14px | **16px** | card titles |
| stat value | 15px | **22–26px** | KPI numbers (let them breathe) |
| page header (serif) | 26px | **26px (keep)** | the serif-26 standard is good |

Define these as CSS variables (`--text-xs … --text-xl`) instead of the ~40 hardcoded `font-size` literals in `globals.css`. One scale, enforced.

### 5.2 Density rules

- **Fewer columns.** `.exec-grid` 6→**3**; `.ana-grid` keep 2 but bigger cards; `.rel-grid` 3→**2**. Wider cells read as "spacious," which is what's being asked for.
- **Card padding** 14–18px → **20–24px**.
- **Stat numbers large.** A KPI's number should dominate its card (22–26px), label small above it. Right now label and number are nearly the same size.
- **Line-height** for body copy ≥1.55.
- **Sidebar** 224 → **248px** (room for the larger labels).

### 5.3 Hierarchy

Today every module is the same white card with a same-weight title — **flat hierarchy**, so nothing draws the eye (your "important actions aren't obvious"). Introduce **3 levels**: (1) the hero action (gradient, border, bigger), (2) standard cards, (3) quiet/expander content. The CommandCenter hero already hints at this — extend the pattern.

---

## 6. Mobile-First Redesign

**Rule (Goal 6): design mobile intentionally — do not stack the desktop.** Today the dashboard becomes ~8 stacked modules and `/analytics` becomes ~14 stacked cards. That's the anti-pattern.

### 6.1 The headline fix: bottom tab bar (replace the 52px icon rail)

```
   ┌─────────────────────────────────────┐
   │  Velnox            ● synced    ⌘ ⚙   │  ← slim top bar (brand, status, search, settings)
   ├─────────────────────────────────────┤
   │                                     │
   │   ⚡ NEXT BEST ACTION                │  ← same hero, single column
   │   Acme Corp — renewal   [HIGH]      │
   │   [ Open & draft → ]                │
   │                                     │
   │   ┌─ 7 Unanswered ─────────────┐    │  ← KPIs as full-width tap rows
   │   ┌─ 3 At risk ────────────────┐    │
   │                                     │
   │   Today's queue                     │
   │   2. Beta Inc …                     │
   │                                     │
   ├─────────────────────────────────────┤
   │   ▣        ✉         ◐         ⌘     │  ← BOTTOM TABS (labeled, thumb-reach)
   │  Home    Inbox    Clients   Search  │
   └─────────────────────────────────────┘
```

Current `@media (max-width:768px)` collapses the sidebar to a 52px icon-only strip with **labels hidden** (`globals.css:698–702`) — unusable for discovery. A labeled 4-item bottom tab bar is the iOS/Android standard and what Linear/Slack/Notion ship.

### 6.2 Per-surface mobile intent

| Surface | Mobile design (not a stack) |
|---|---|
| **Dashboard** | Hero action → 2–3 KPI tap-rows → "Today's queue" list. *Everything else collapsed* behind "View insights ▾". One decision per screenful. |
| **Inbox** | Already swaps list↔thread (`InboxShell`). Keep. Context rail stays off-canvas. ✓ |
| **Clients** | `ClientsTable` **must become stacked cards** on mobile (name + risk chip + awaiting badge + last-active). Tables don't work at 375px. |
| **Trends/Analytics** | Key numbers + 1 chart; distributions/heatmap behind expanders. Never 14 stacked cards. |
| **Settings** | Tabs → a scrollable segmented control or a list→detail drill-in. |

### 6.3 Touch targets

Nav items currently get `padding:13px` at mobile (≈40px) — borderline. Enforce **44×44px minimum** on every tappable element (KPI rows, list rows, drawer controls).

---

## 7. SaaS Standards — where Velnox violates the pattern

| Benchmark | Pattern | Velnox today | Fix |
|---|---|---|---|
| **Linear** | ⌘K omnibox; 4–5 nav items; keyboard-first | ⌘K ✓ but **9 nav items**; density without the speed payoff | Cut to 4; make ⌘K the ask-AI omnibox |
| **Stripe** | Generous type, clear hierarchy, tabbed settings | Tabbed settings ✓ but **11px type**, flat hierarchy | Type scale §5; 3-level hierarchy |
| **Notion / Attio** | Contact/CRM directory as a first-class object | Clients page exists but is one of four near-identical "intelligence" pages | Make Clients the *only* directory; fold others in |
| **Slack / Linear (mobile)** | Bottom tab bar | 52px icon-only rail | Bottom tabs §6 |
| **Intercom** | One AI assistant, omnipresent + actionable | **Two** assistants (page + widget) | Keep the widget; delete the page |
| **Arc / Framer** | Bold visual hierarchy, one clear focus | Everything is a same-weight card | Hero action + quiet secondary |
| **All of them** | Empty states that teach | Spotlight tour over a busy UI | Setup checklist §8 |

---

## 8. First-Time User Experience

A new user must learn, in 30 seconds: **what Velnox does**, **the first action**, **what success looks like.**

- **What it does:** the `DashboardEmpty` copy is already good and team-framed ("triages your team's shared inbox, ranks what needs attention, watches for at-risk accounts"). Keep it.
- **First action:** today it's buried — empty state → Settings → Inboxes tab. **Make "Connect your inbox" a single prominent CTA** that lands directly on the connect flow.
- **Replace the spotlight tour** with a **3-step setup checklist** pinned to the dashboard, auto-dismissing when complete:

```
  Get Velnox working  ▸ 1 of 3 done
  ✅  Connect your inbox
  ⬜  Let AI analyze your threads   (auto — runs after first sync)
  ⬜  See your first risk flag      → opens the Alerts drawer
```

- **Progressive disclosure:** new orgs see the solo view (no Members/Workload noise). Those modules appear when a 2nd seat is invited — the literal mechanism of the solo→team transition.
- **Per-surface empty states** that teach, not decorate: Clients ("contacts appear as mail syncs"), Inbox, Trends each get a one-line "here's what fills this in."

---

## 9. Action-Oriented Interface — "what should I do next?"

Each primary screen gets one unambiguous answer:

| Screen | Answers | Primary CTA |
|---|---|---|
| Dashboard | "Reply to the highest-risk waiting client" | CommandCenter hero → Open & draft |
| Inbox | "Clear the awaiting-reply queue" | ✦ AI draft on each awaiting thread |
| Clients | "Reach out to who's gone quiet" | Per-row → open thread / compose |
| Alerts drawer | "Triage this risk" | Ack / Snooze / Open |

**Make KPIs actionable:** every number deep-links to the filtered list behind it (`Unanswered → /inbox?awaiting=1`). A metric that isn't a button is a dead end.

---

## 10. Implementation Plan (phased, each ships independently)

Effort: **S** ≤1d · **M** 1–3d · **L** 3–5d. Files are the real touch-points.

### Phase 0 — Honesty cleanup (S)
- Remove Telegram placeholders from UI/marketing/types until wired (grep `Telegram`/`TELEGRAM`).
- Fix the connect-inbox CTA target (`DashboardEmpty.tsx:40` → direct to the connect flow, not `/settings` root).
- **Ships:** product stops advertising things that don't work.

### Phase 1 — IA collapse (M→L) ← the big win
- Rewrite `Sidebar.tsx` `SECTIONS` to 4 items (Dashboard, Inbox, Clients, Settings); drop section labels.
- Delete routes: `/insights`, `/risk`, `/assistant`, `/integrations` (`src/app/(dashboard)/…`).
- Move `AlertsPanel` into an **Alerts slide-over** (new `components/AlertsDrawer.tsx`), triggered from a top-bar bell.
- Move Weekly Digest (`SendDigestButton`, copy) into Settings › Notifications.
- Add **Connections** to `SettingsTabs.tsx` (absorb `IntegrationsClient`/`InboxesPanel`).
- Redirect old paths (`/risk`, `/insights`, `/assistant`, `/integrations`, and `/analytics` once Phase 4 lands) → new homes (avoid dead links / bookmarks).
- **Ships:** 9 → 4 destinations; duplication gone.

### Phase 2 — Mobile navigation (M)
- New `components/layout/MobileTabBar.tsx` (4 labeled tabs); render <768px in `(dashboard)/layout.tsx`.
- Remove the 52px icon-rail behavior (`globals.css:696–706`); hide the desktop sidebar <768px instead.
- `ClientsTable` → card layout at mobile widths.
- **Ships:** real mobile nav; tables stop breaking.

### Phase 3 — Density system (M)
- Add `--text-xs…--text-xl` tokens; replace hardcoded `font-size` literals (§5.1).
- Reduce columns: `.exec-grid` 6→3, `.rel-grid` 3→2; bump card padding to 20–24px (`globals.css:1854+`).
- Enlarge KPI numbers to 22–26px.
- **Ships:** the "cramped/internal-tool" feeling goes away.

### Phase 4 — Dashboard action-first (M)
- Reorder `dashboard/page.tsx`: CommandCenter hero #1; 6 KPIs → 3 clickable; relocate `ActivityTimeline` + `RelationshipHealth`.
- Add Dashboard tabs **Today | Trends**; Trends hosts the slimmed Analytics (expander-hide distributions/heatmap); remove the standalone `/analytics` route.
- Make KPIs deep-link into filtered `/inbox`.
- **Ships:** dashboard tells you what to do.

### Phase 5 — FTUE (S→M)
- Replace `OnboardingTour` spotlight with a **setup checklist** component on the dashboard.
- Per-surface empty states (Clients, Inbox, Trends).
- Gate team modules (Members/Workload) behind "2nd seat invited."
- **Ships:** a first-timer understands Velnox in 30 seconds.

### Sequencing
**0 → 1 → 4** delivers ~80% of the perceived improvement (honesty + simplified nav + action-first home). **2 → 3** make it feel premium and mobile-real. **5** converts first-timers. Phases are independent; ship and validate each.

---

## Appendix — Consolidated Delete / Merge / Move

**Delete (now):**
- `/assistant` page · `/risk` page · `/insights` page · `/integrations` page
- 6-up KPI strip (→ 3) · spotlight `OnboardingTour` · Telegram UI placeholders
- Dashboard `ActivityTimeline` band · sentiment/risk-dist/heatmap/busiest-day as *primary* surfaces

**Merge:**
- Risk + Insights → Dashboard · Alerts → slide-over · Integrations → Settings › Connections
- Weekly Digest → Settings › Notifications · `RelationshipHealth` → Clients · Analytics → Dashboard "Trends" tab
- (later) Assistant → ⌘K omnibox

**Move:**
- "Replay tour" → help menu · browse-only metrics → Trends tab · SyncChip → top bar status dot

**Keep & elevate:**
- CommandCenter (→ #1) · ⌘K palette (→ omnibox) · Inbox 3-pane · review-before-send drafts · ModulePill honesty · Clients directory
