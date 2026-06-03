import React from 'react'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r px-4 py-6">
        <h2 className="font-bold mb-4">Flo</h2>
        <nav className="flex flex-col gap-2">
          <Link href="/inbox">Inbox</Link>
          <Link href="/integrations">Integrations</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
