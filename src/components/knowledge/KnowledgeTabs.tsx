'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * View switcher for the Knowledge section — Graph (the canvas) and Notes (the
 * written memory). Same segmented pattern as the inbox filters: neutral
 * outline, near-black when active.
 */
const TABS = [
  { href: '/knowledge', label: 'Graph' },
  { href: '/knowledge/notes', label: 'Notes' },
]

export default function KnowledgeTabs() {
  const pathname = usePathname()
  return (
    <nav className="kn-tabs" aria-label="Knowledge views">
      {TABS.map((t) => {
        const active = t.href === '/knowledge' ? pathname === '/knowledge' : pathname.startsWith(t.href)
        return (
          <Link key={t.href} href={t.href} className="kn-tab" data-active={active} aria-current={active ? 'page' : undefined}>
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
