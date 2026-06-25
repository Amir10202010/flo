'use client'

import Link from 'next/link'
import { Search, Settings } from 'lucide-react'
import { useUiStore } from '@/stores/ui.store'

/**
 * Right-side actions for the mobile top bar (the sidebar is hidden on phones).
 * Search opens the ⌘K palette (which also reaches Trends, Compose, Sync, etc.);
 * the gear links to Settings. Primary nav lives in the bottom MobileTabBar.
 */
export default function MobileTopActions() {
  const togglePalette = useUiStore((s) => s.togglePalette)
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
      <button type="button" className="topbar-icon-btn" onClick={togglePalette} aria-label="Search" title="Search">
        <Search size={18} />
      </button>
      <Link href="/settings" className="topbar-icon-btn" aria-label="Settings" title="Settings">
        <Settings size={18} />
      </Link>
    </div>
  )
}
