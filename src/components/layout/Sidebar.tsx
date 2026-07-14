'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Inbox, LayoutDashboard, LogOut, Search, Settings, Share2, Sparkles, Users } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { useUiStore } from '@/stores/ui.store'
import Brand from './Brand'

interface NavEntry {
  href: string
  icon: typeof Inbox
  label: string
  pill?: string
  /** `data-tour` key — marks the element for the onboarding spotlight tour. */
  tour?: string
}

// A fixed, personal-inbox nav: Dashboard (home), Inbox, and the contact
// directory. Search + Ask AI sit above it as actions; everything else is
// reachable via ⌘K.
const NAV: NavEntry[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/inbox', icon: Inbox, label: 'Inbox', tour: 'inbox' },
  { href: '/clients', icon: Users, label: 'Contacts', tour: 'clients' },
  { href: '/graph', icon: Share2, label: 'Graph', pill: 'Beta' },
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
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const togglePalette = useUiStore((s) => s.togglePalette)
  const openAssistant = useUiStore((s) => s.setAssistantOpen)

  async function handleSignOut() {
    setSigningOut(true)
    await getSupabaseClient().auth.signOut()
    router.replace('/login')
  }
  const metaKey = useSyncExternalStore(emptySubscribe, isApplePlatform, serverIsApple) ? '⌘' : 'Ctrl'

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

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ height: 6 }} />
        {NAV.map((entry) => (
          <NavItem key={entry.href} entry={entry} active={isActive(entry.href)} />
        ))}
      </nav>

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
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {userName ?? userEmail ?? 'User'}
          </span>
          {userEmail && userName && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userEmail}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          title="Sign out"
          aria-label="Sign out"
          className="sidebar-signout"
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: signingOut ? 'default' : 'pointer' }}
        >
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  )
}
