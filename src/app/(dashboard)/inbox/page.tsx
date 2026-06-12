import { MessagesSquare } from 'lucide-react'

// Default detail pane (no conversation selected). The "connect a channel" call
// to action lives in the conversation-list pane (InboxList → ConnectEmpty), so
// it isn't duplicated here.
export default function InboxPage() {
  return (
    <div className="inbox-empty">
      <div className="inbox-empty-icon">
        <MessagesSquare size={22} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Select a conversation</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Choose a contact on the left to open the thread.</p>
      </div>
      <p style={{ display: 'flex', alignItems: 'center', gap: 7, margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
        <span className="cmdk-kbd">Ctrl/⌘ K</span>
        jumps to any page, action or thread
      </p>
    </div>
  )
}
