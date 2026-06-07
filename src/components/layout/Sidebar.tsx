'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Inbox, Plug, Settings } from 'lucide-react'

const NAV = [
  { href: '/inbox',        icon: Inbox,    label: 'Inbox' },
  { href: '/integrations', icon: Plug,     label: 'Integrations' },
  { href: '/settings',     icon: Settings, label: 'Settings' },
]

export default function Sidebar({ userName, userEmail }: { userName?: string | null; userEmail?: string | null }) {
  const pathname = usePathname()

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : userEmail?.[0]?.toUpperCase() ?? '?'

  return (
    <aside
      className="sidebar-shell"
      style={{
        width: 220,
        height: '100%',
        borderRight: '1px solid var(--border)',
        padding: '16px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
        background: 'var(--bg-subtle)',
        overflowY: 'auto',
      }}
    >
      {/* Logo — hidden on mobile via .sidebar-logo-link */}
      <Link
        href="/"
        className="sidebar-logo-link"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none', padding: '6px 8px', marginBottom: 8 }}
      >
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 23, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>flo</span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginBottom: 9, display: 'inline-block' }} />
      </Link>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item${active ? ' active' : ''}`}
              title={label}  /* tooltip for icon-only mobile view */
            >
              <Icon size={15} />
              {/* span allows hiding label text on mobile while keeping icon */}
              <span className="sidebar-nav-label">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div style={{ flex: 1 }} />

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
