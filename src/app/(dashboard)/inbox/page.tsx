import Link from 'next/link'

export default function InboxPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Inbox</h1>
      <p className="mb-4">Unified inbox will appear here.</p>
      <ul className="space-y-2">
        <li><Link href="/inbox/placeholder">Conversation placeholder</Link></li>
      </ul>
    </div>
  )
}
