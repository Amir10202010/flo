'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, PanelRight } from 'lucide-react'

/**
 * 3-zone thread layout: a slim header bar, a main column (scrolling messages +
 * a fixed composer), and a collapsible right context rail. Mirrors the
 * InboxShell props-as-ReactNode pattern so the server page keeps rendering the
 * identity/messages/composer while this client component owns the layout grid,
 * the rail open state, and the mobile drawer.
 *
 * `railOpen` is a tri-state: `null` follows the CSS breakpoint default (open
 * column on desktop, off-canvas on mobile) so SSR/first paint is correct on
 * both with no hydration mismatch and no flash. The first toggle resolves it to
 * an explicit boolean based on the current viewport, then flips from there.
 */
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
  const [railOpen, setRailOpen] = useState<boolean | null>(null)

  function toggleRail() {
    setRailOpen((prev) =>
      prev === null ? !window.matchMedia('(min-width: 769px)').matches : !prev,
    )
  }

  const railClass = railOpen === null ? '' : railOpen ? ' open' : ' closed'

  return (
    <div className="chat">
      <div className="chat-header">
        <Link href="/inbox" className="thread-back" aria-label="Back to inbox">
          <ArrowLeft size={15} /> Inbox
        </Link>
        <div className="chat-header-main">{header}</div>
        {rail && (
          <button
            type="button"
            className={`rail-toggle${railOpen ? ' active' : ''}`}
            onClick={toggleRail}
            aria-pressed={railOpen === true}
            title="Toggle details"
            aria-label="Toggle details"
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

        {rail && <aside className={`chat-rail${railClass}`}>{rail}</aside>}
        {rail && railOpen === true && (
          <button className="rail-scrim" aria-label="Close details" onClick={() => setRailOpen(false)} />
        )}
      </div>
    </div>
  )
}
