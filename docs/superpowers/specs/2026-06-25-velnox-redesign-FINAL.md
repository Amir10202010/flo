# Velnox — FINAL Redesign Blueprint (Authoritative)

**Date:** 2026-06-25 · **Status:** FINAL — decisions made, executing.
**Supersedes** the audit in `2026-06-25-velnox-ux-redesign-design.md` (that doc = the *why*; this doc = the *what* + *how*).
**Mandate:** world-class SaaS a first-timer understands in <30s. Bold over conservative. Action over analytics. When unsure → delete.

---

## 1. Decision Framework — every surface, exactly one verdict

> Rule: **Keep · Merge · Move · Hide · Delete.** No neutral answers.

### Pages / routes
| Surface | Verdict | Lands as |
|---|---|---|
| `/dashboard` | **Keep** (rebuilt) | The command center. Tabs: **Today** (default) · Trends. |
| `/inbox` (+ `[id]`) | **Keep** | The doing surface. Polished, not restructured. |
| `/clients` | **Keep** | The only directory. Absorbs Relationship Health. |
| `/settings` | **Keep** | System hub. Absorbs Integrations + Digest + Notifications. |
| `/risk` | **Delete** | → dashboard widgets + **Alerts slide-over**. |
| `/insights` | **Delete** | → dashboard `SmartInsights` + digest → Settings. |
| `/analytics` | **Delete** | → dashboard **Trends** tab (slimmed). |
| `/assistant` | **Delete** | → the ⌘K omnibox (Ask-AI mode). |
| `/integrations` | **Delete** | → Settings › **Connections**. |

### Navigation
| Element | Verdict |
|---|---|
| "Intelligence" group (Clients/Insights/Risk/Analytics) | **Delete** the grouping |
| "Assistant" group | **Delete** |
| "System" group label | **Delete** (just two icons at the bottom) |
| 9 destinations | **Merge → 4** (Dashboard · Inbox · Clients · Settings) |
| ⌘K Command Palette | **Keep + elevate** → omnibox (search · navigate · **ask AI** · act) |
| OrgSwitcher | **Keep** |

### Dashboard modules
| Module | Verdict |
|---|---|
| `CommandCenter` (next best action) | **Keep → promote to #1**, full-width hero |
| 6-card KPI strip | **Merge → 3** clickable KPIs (Unanswered · At-risk · Urgent) |
| Health-score card | **Move** → inside CommandCenter |
| Conversations-count KPI | **Delete** |
| Follow-ups KPI | **Delete** |
| `RiskMonitor` | **Keep** (rename "Clients at risk") |
| `SmartInsights` | **Keep** (rename "What changed") |
| `RemindersCard` | **Keep** |
| `ActivityTimeline` | **Delete** (browse-only, no action) |
| `RelationshipHealth` | **Move** → Clients |
| `SyncChip` | **Move** → top-bar status dot |

### Assistant — the independent call
**Verdict: neither a page nor a floating bubble.** Fold the assistant into the **⌘K omnibox** (type a question → Ask-AI mode → propose→confirm→execute) + a visible **"Ask AI"** button in the top bar (discoverability) + the mobile **"Ask"** tab. **Delete** the `/assistant` page **and** the floating `AssistantWidget`. One AI surface, omnipresent, keyboard-first — Linear/Arc-grade, zero clutter.

### Analytics charts (the demoted set)
| Chart | Verdict |
|---|---|
| Response-time trend · Email volume · Threads-answered % · Team workload | **Keep** → Trends tab |
| Priority distribution (Donut) | **Hide** behind "More metrics" |
| Sentiment donut · Risk distribution · Inbound heatmap · Busiest-day · Inbox-load | **Delete** (decoration, not action) |

### Settings (7 tabs → 5)
| Tab | Verdict |
|---|---|
| Workspace (org · **Plan** · **Connections** · **Notifications** · **Digest** · account) | **Keep + absorb** |
| Members | **Keep** |
| Inboxes | **Keep** |
| Tags + Templates | **Merge → "Library"** |
| Rules | **Keep → "Automations"** |
| Audit log | **Hide** (role/plan-gated) |
| "Replay tour" card | **Delete** |

### First-run & honesty
| Element | Verdict |
|---|---|
| `OnboardingTour` spotlight | **Delete** → **Setup checklist** (3 steps, auto-dismiss) |
| Telegram channel (not wired, per CLAUDE.md) | **Delete** from UI/marketing/types |
| `ModulePill` honesty system | **Keep** |

---

## 2. Final Information Architecture

Four objects the user thinks in: **Now** (what to do), **Threads** (conversations), **People** (clients), **Workspace** (settings). Everything maps to one.

```
NOW         → /dashboard   (command center · Today | Trends · Alerts drawer)
THREADS     → /inbox       (list · thread · context rail)
PEOPLE      → /clients     (directory · relationship health · contact drill-in)
WORKSPACE   → /settings    (workspace · members · inboxes · library · automations)
EVERYWHERE  → ⌘K omnibox   (search · go · ask AI · act)  ·  OrgSwitcher
```

## 3. Final Navigation

**Desktop sidebar (248px):**
```
  ▣  Dashboard
  ✉  Inbox
  ◐  Clients
  ───────────
  ◯  Search / Ask AI   ⌘K
  ⚙  Settings
  [Org ▾]        [Avatar]
```
No section labels. Two clusters: the 3 work destinations, then the omnibox + settings.

**Top bar (all pages):** `‹page title›  •  ● synced 4m   [✦ Ask AI]   [🔔 Alerts]   [+ Compose]`

## 4. Final Page Hierarchy
```
/dashboard
  ├─ ?tab=today   (default)   hero action · 3 KPIs · queue · what-changed · reminders
  ├─ ?tab=trends              response-time · volume · answered% · team workload
  └─ Alerts drawer (slide-over, global bell)
/inbox
  └─ /inbox/[id]              thread + context rail (off-canvas <768)
/clients
  └─ /clients/[id]            contact profile (slide-over)
/settings
  └─ workspace | members | inboxes | library | automations | (audit*)
DELETED: /risk /insights /analytics /assistant /integrations
```

## 5. Final Mobile Hierarchy

**Bottom tab bar — 4 thumb-reachable, labeled tabs. No icon-rail, no desktop stacking.**
```
┌──────────────────────────────┐
│ Velnox        ● synced   ⚙    │  top: brand · status · settings
│                              │
│  [ scrollable content ]      │
│                              │
├──────────────────────────────┤
│  ▣        ✉        ◐      ✦   │
│ Home    Inbox   Clients  Ask │  bottom tabs (Ask = AI + search)
└──────────────────────────────┘
```
- **Home** → hero action → 3 KPI tap-rows → "Today's queue". Everything else behind "View more ▾". One decision per screenful.
- **Inbox** → list ↔ thread swap (already correct). Context rail off-canvas.
- **Clients** → **cards, not a table** (name · risk chip · awaiting badge · last active).
- **Ask** → full-screen omnibox: search threads/people + ask AI + quick actions.
- Settings → top-bar gear (not a tab; low-frequency).
- Compose → FAB on Home/Inbox.

## 6. Wireframes

**Desktop dashboard — Today:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ Dashboard            ● synced 4m   [✦ Ask AI] [🔔 3] [+ Compose]       │
├──────────────────────────────────────────────────────────────────────┤
│ ╔══════════════════════════════════════════════════════════════════╗ │
│ ║ ⚡ NEXT BEST ACTION                                   waiting 2d  ║ │  ← hero, #1
│ ║ ◐ Acme Corp — "Re: renewal terms"            [HIGH RISK]          ║ │
│ ║ AI: They're comparing vendors. Reassure on pricing, offer a call.║ │
│ ║ [ Open & draft reply → ]                                          ║ │
│ ╚══════════════════════════════════════════════════════════════════╝ │
│ ┌ 7 Unanswered →┐  ┌ 3 At risk →┐  ┌ 2 Urgent →┐    (clickable → inbox)│
│ ┌ Today's queue ─────────────────┐  ┌ What changed ──────────────────┐ │
│ │ 2. Beta Inc   reply late       │  │ ⚠ Response time +40% this week │ │
│ │ 3. Gamma LLC  AI: send proposal│  │ ✦ 2 clients went quiet         │ │
│ │ 4. …                           │  │ ⏰ Reminder: follow up Delta    │ │
│ └────────────────────────────────┘  └────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**Mobile Home:**
```
┌────────────────────────┐   ⚡ NEXT BEST ACTION
│ Velnox    ●synced  ⚙   │   Acme — renewal  [HIGH]
├────────────────────────┤   [ Open & draft → ]
│ ⚡ Acme — renewal [HIGH]│   ───────────────────
│ [ Open & draft → ]     │   ▸ 7 Unanswered
│ ▸ 7 Unanswered         │   ▸ 3 At risk
│ ▸ 3 At risk            │   ───────────────────
│ Today's queue          │   Today's queue …
│ 2. Beta Inc …          │   View more ▾
├────────────────────────┤
│ ▣    ✉    ◐    ✦       │
│Home Inbox Clnts Ask    │
└────────────────────────┘
```

**⌘K omnibox (AI folded in):**
```
┌─ ⌘K ───────────────────────────────────────┐
│ ✦ which clients are at risk?            ⏎   │
├─────────────────────────────────────────────┤
│  ASK AI  ›  "which clients are at risk?"     │  ← Enter on a question → assistant
│  ──────────────────────────────────────────  │
│  GO      Dashboard · Inbox · Clients · …      │
│  ACTIONS Sync now · Compose · Connect inbox   │
│  THREADS Acme renewal · Beta onboarding · …   │
└─────────────────────────────────────────────┘
```

## 7. Component Changes

**ADD**
- `components/layout/MobileTabBar.tsx` — 4-tab bottom bar (<768px).
- `components/layout/TopBar.tsx` — title · status dot · Ask AI · Alerts bell · Compose.
- `components/AlertsDrawer.tsx` — slide-over wrapping `AlertsPanel` logic.
- `components/dashboard/SetupChecklist.tsx` — replaces the tour.
- `components/dashboard/TrendsTab.tsx` — slim analytics (4 widgets + "More" expander).
- `components/dashboard/DashboardTabs.tsx` — Today | Trends.
- globals.css `--text-xs…--text-xl` tokens.

**EDIT**
- `Sidebar.tsx` → 4 items, 248px, no section labels.
- `dashboard/page.tsx` → CommandCenter #1, 3 clickable KPIs, tabs, drop ActivityTimeline/RelationshipHealth.
- `CommandPalette.tsx` → Ask-AI mode (Enter on free text → `/api/assistant`).
- `(dashboard)/layout.tsx` → render `TopBar` + `MobileTabBar`; remove `AssistantWidget` + `OnboardingTour`.
- `SettingsTabs.tsx` → 5 tabs; add Connections + Notifications + Digest; merge Tags+Templates → Library; Rules → Automations; gate Audit.
- `clients/page.tsx` → absorb `RelationshipHealth`; table → cards at mobile.
- `StatCard.tsx` → clickable `href` variant; KPI number 22–26px.
- `globals.css` → type scale up; `.exec-grid` 6→3; `.rel-grid` 3→2; card padding 20–24px; delete the 52px icon-rail rules; mobile bottom-bar + body padding.

**DELETE**
- `app/(dashboard)/{risk,insights,analytics,assistant,integrations}/` (pages + loading).
- `components/dashboard/AssistantWidget.tsx`, `ActivityTimeline.tsx`.
- `components/onboarding/OnboardingTour.tsx`, `ReplayTourButton.tsx`.
- `components/integrations/*` IntegrationsClient (logic → Settings › Connections).
- charts: `Heatmap.tsx` (+ sentiment/risk-dist/busiest-day usages); `Donut.tsx` if unused after.
- All Telegram references.
- Add redirect stubs: deleted routes → new homes.

## 8. Detailed Implementation Plan + Ordered Execution Roadmap

Front-loads the most visible wins; each step ends at a **green build (`npm run lint && npm run build`)** before the next. Steps are independently shippable.

| # | Step | Touches | Risk |
|---|---|---|---|
| **0** | **Honesty + density tokens** — remove Telegram; add `--text-*`; bump body 12.5→14.5, labels 10.5→12, KPI numbers to 22–26; card padding ↑ | `globals.css`, grep Telegram | low |
| **1** | **Dashboard = command center** — promote CommandCenter; 6→3 clickable KPIs; delete ActivityTimeline; add Today\|Trends tabs (Trends = slim analytics, kill heatmap/sentiment/risk-dist/busiest-day) | `dashboard/page.tsx`, `StatCard.tsx`, new `DashboardTabs`,`TrendsTab` | med |
| **2** | **Nav → 4 + omnibox AI** — Sidebar 4 items; fold Assistant into ⌘K; delete `AssistantWidget`; `TopBar` (Ask AI + Alerts bell + Compose); route redirects | `Sidebar.tsx`,`CommandPalette.tsx`,`layout.tsx`,`TopBar` | med |
| **3** | **Merge orphan pages** — `AlertsDrawer` (from /risk); Settings › Connections (from /integrations); Digest+Notifications (from /insights); delete the 5 routes | Settings, new `AlertsDrawer`, delete pages | med |
| **4** | **Mobile product** — `MobileTabBar`; mobile Home single-column priority; ClientsTable→cards; delete 52px rail | `MobileTabBar`,`layout.tsx`,`globals.css`,`ClientsTable` | med |
| **5** | **Clients + Settings + FTUE** — RelationshipHealth→Clients; Settings 7→5; `SetupChecklist`; delete `OnboardingTour` | `clients/page.tsx`,`SettingsTabs.tsx`, onboarding | low |

**Validation gates:** lint+build after every step; visual QA (gstack connect + manual login) after steps 1, 4. Ship 0→1→2 for ~80% of the perceived leap.
