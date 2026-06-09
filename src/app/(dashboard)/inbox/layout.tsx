import { Suspense } from 'react'
import InboxShell from '@/components/InboxShell'
import InboxListContent, { InboxListSkeleton } from '@/components/InboxListContent'

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  // The conversation list query streams inside <Suspense> so the inbox shell
  // (list chrome + detail pane) paints immediately instead of blocking the whole
  // subtree on the DB round-trip. InboxShell (client) decides which pane to show
  // on mobile — the list, or the conversation thread (children).
  const list = (
    <Suspense fallback={<InboxListSkeleton />}>
      <InboxListContent />
    </Suspense>
  )

  return <InboxShell list={list} detail={children} />
}
