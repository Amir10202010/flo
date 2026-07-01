'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Inbox, LayoutDashboard, Search, Settings, Sparkles, Users } from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'
import { useWorkspaceSchema } from '@/lib/workspace/use-workspace-schema'
import { iconFor } from '@/lib/workspace/icons'
import { resolveTerm } from '@/lib/workspace/terminology'
import OrgSwitcher from '@/components/org/OrgSwitcher'
import Brand from './Brand'

interface NavEntry {
  href: string
  icon: typeof Inbox
  label: string
  pill?: string
  /** `data-tour` key — marks the element for the onboarding spotlight tour. */
  tour?: string
}

// The nav is generated per-workspace: Dashboard + Inbox are system anchors,
// then the org's own CRM objects (from the workspace schema — Patients,
// Cases, Campaigns…), then the contact directory under the org's own word
// for "Clients". Before the schema loads (or without a profile) it renders
// exactly the classic trio. Everything else is reachable via ⌘K.
const ANCHORS: NavEntry[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/inbox', icon: Inbox, label: 'Inbox', tour: 'inbox' },
]

const SYSTEM: NavEntry[] = [
  { href: '/settings', icon: Settings, label: 'Settings' },
]

function NavItem({ entry, active }: { entry: NavEntry; active: boolean }) {
  const Icon = entry.icon
  return (
    <Link
      href={entry.href}
      className={`nav-item${active ? ' active' : ''}`}
      title={entry.label} /* tooltip for icon-only mobile view */
      aria-current={active ? 'page' : undefined}
      data-tour={entry.tour}
    >
      <Icon size={15} />
      {/* span allows hiding label text on mobile while keeping icon */}
      <span className="sidebar-nav-label">{entry.label}</span>
      {entry.pill && <span className="nav-pill">{entry.pill}</span>}
    </Link>
  )
}

// Platform-correct shortcut hint, hydration-safe: the server snapshot renders
// "Ctrl", the client snapshot swaps to "⌘" on Apple devices after hydration.
const emptySubscribe = () => () => {}
const isApplePlatform = () => /Mac|iPhone|iPad/i.test(navigator.platform ?? '')
const serverIsApple = () => false

export default function Sidebar({ userName, userEmail }: { userName?: string | null; userEmail?: string | null }) {
  const pathname = usePathname()
  const togglePalette = useUiStore((s) => s.togglePalette)
  const openAssistant = useUiStore((s) => s.setAssistantOpen)
  const metaKey = useSyncExternalStore(emptySubscribe, isApplePlatform, serverIsApple) ? '⌘' : 'Ctrl'
  const { schema } = useWorkspaceSchema()

  // Workspace-generated nav: the org's own objects + its word for "Clients".
  const objectEntries: NavEntry[] = (schema?.nav ?? []).map((n) => ({
    href: n.href,
    icon: iconFor(n.icon),
    label: n.label,
  }))
  const contactsLabel = resolveTerm(schema?.terminology, 'contact').plural
  const sections: { label: string | null; items: NavEntry[] }[] = [
    { label: null, items: ANCHORS },
    ...(objectEntries.length ? [{ label: schema?.profile.industryLabel ?? 'Workspace', items: objectEntries }] : []),
    { label: null, items: [{ href: '/clients', icon: Users, label: contactsLabel, tour: 'clients' }] },
  ]

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : userEmail?.[0]?.toUpperCase() ?? '?'

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <aside
      className="sidebar-shell"
      style={{
        width: 224,
        height: '100%',
        borderRight: '1px solid var(--border)',
        padding: '16px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        flexShrink: 0,
        background: 'var(--bg-subtle)',
        overflowY: 'auto',
      }}
    >
      {/* Logo — hidden on mobile via .sidebar-logo-link (sidebar collapses to an icon rail) */}
      <Brand size={22} href="/dashboard" className="sidebar-logo-link" style={{ padding: '6px 8px', marginBottom: 6 }} />

      {/* Active organization picker — self-fetches so the layout stays DB-free */}
      <OrgSwitcher />

      {/* Command palette trigger */}
      <button type="button" className="sidebar-search-btn" onClick={togglePalette} title="Search (Ctrl/⌘ K)" data-tour="search">
        <Search size={14} />
        <span className="sidebar-nav-label">Search</span>
        <span className="cmdk-kbd">{metaKey} K</span>
      </button>

      {/* Ask Velnox AI — opens the assistant overlay (replaces the floating bubble) */}
      <button type="button" className="sidebar-search-btn" onClick={() => openAssistant(true)} title="Ask Velnox AI">
        <Sparkles size={14} />
        <span className="sidebar-nav-label">Ask AI</span>
      </button>

      {/* Navigation — generated from the workspace schema */}
      {sections.map((section, si) => (
        <nav key={si} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {section.label && <div className="sidebar-section-label">{section.label}</div>}
          {!section.label && si === 0 && <div style={{ height: 6 }} />}
          {section.items.map((entry) => (
            <NavItem key={entry.href} entry={entry} active={isActive(entry.href)} />
          ))}
        </nav>
      ))}

      <div style={{ flex: 1 }} />

      {/* System */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: '1px solid var(--border-light)', marginBottom: 8 }}>
        {SYSTEM.map((entry) => (
          <NavItem key={entry.href} entry={entry} active={isActive(entry.href)} />
        ))}
      </nav>

      {/* User profile — hidden on mobile via .sidebar-user-card */}
      <div
        className="sidebar-user-card"
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          padding: '10px 10px',
          borderRadius: 10,
          background: '#FFFFFF',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4b6bff, #9b6bff)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {userName ?? userEmail ?? 'User'}
          </span>
          {userEmail && userName && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userEmail}
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}
