'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Inbox, LayoutDashboard, Share2, Sparkles, Users } from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'

const TABS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { href: '/inbox', icon: Inbox, label: 'Inbox' },
  { href: '/clients', icon: Users, label: 'Clients' },
  { href: '/knowledge', icon: Share2, label: 'Knowledge' },
] as const

/**
 * Mobile primary navigation — a labeled bottom tab bar that replaces the old
 * 52px icon rail below 768px. Rendered as a flex child of the dashboard layout
 * column (not a fixed overlay) so it never covers the inbox composer. The fourth
 * tab opens the Ask Velnox AI overlay; Search + Settings live in the top bar.
 */
export default function MobileTabBar() {
  const pathname = usePathname()
  const openAssistant = useUiStore((s) => s.setAssistantOpen)

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="mobile-tabbar" aria-label="Primary">
      {TABS.map((t) => {
        const Icon = t.icon
        const active = isActive(t.href)
        return (
          <Link key={t.href} href={t.href} className="mtab" data-active={active} aria-current={active ? 'page' : undefined}>
            <Icon size={20} />
            <span>{t.label}</span>
          </Link>
        )
      })}
      <button type="button" className="mtab" onClick={() => openAssistant(true)}>
        <Sparkles size={20} />
        <span>Ask</span>
      </button>
    </nav>
  )
}
