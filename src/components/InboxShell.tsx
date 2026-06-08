'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export default function InboxShell({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  const pathname = usePathname()
  // On mobile, a selected conversation (/inbox/[id]) swaps the list out for the thread view.
  const showDetail = pathname !== '/inbox'

  return (
    <div
      className={`inbox-grid${showDetail ? ' show-detail' : ''}`}
      style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: '100%', flex: 1, overflow: 'hidden' }}
    >
      <div className="inbox-list" style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF' }}>
        {list}
      </div>
      <div className="inbox-detail" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
        {detail}
      </div>
    </div>
  )
}
