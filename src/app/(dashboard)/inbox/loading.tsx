import { Loader } from 'lucide-react'

// Fallback for the inbox *page* segment — this fills the detail pane only.
// (The conversation list streams separately via <Suspense> in inbox/layout.tsx,
// so rendering a list here too would briefly show two lists.)
export default function InboxLoading() {
  return (
    <div className="inbox-empty">
      <Loader size={22} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Loading your inbox…</p>
    </div>
  )
}
