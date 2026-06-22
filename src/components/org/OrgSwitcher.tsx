'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown } from 'lucide-react'
import { ROLE_LABEL } from '@/lib/permissions'
import type { OrgRole } from '@prisma/client'

interface OrgItem {
  id: string
  name: string
  slug: string
  role: OrgRole
}

/**
 * Active-organization picker for the sidebar. Self-fetches `/api/orgs` so the
 * dashboard layout stays DB-free (same pattern as RemindersCard). Switching
 * POSTs `/api/orgs/switch` (sets the httpOnly `velnox_org` cookie) and refreshes
 * the route so every server component re-resolves under the new org.
 */
export default function OrgSwitcher() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<OrgItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/orgs')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return
        setOrgs(d.organizations ?? [])
        setActiveId(d.activeId ?? d.organizations?.[0]?.id ?? null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const active = orgs.find((o) => o.id === activeId) ?? orgs[0] ?? null
  if (!active) return null

  async function switchTo(id: string) {
    if (id === active!.id) {
      setOpen(false)
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/orgs/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: id }),
      })
      if (r.ok) {
        setActiveId(id)
        setOpen(false)
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  const initial = active.name.trim()[0]?.toUpperCase() ?? 'V'

  return (
    <div ref={ref} style={{ position: 'relative', padding: '0 8px', marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '8px 9px',
          borderRadius: 10,
          background: '#FFFFFF',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xs)',
          cursor: busy ? 'default' : 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            flexShrink: 0,
            background: 'linear-gradient(135deg,#4b6bff,#9b6bff)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {initial}
        </span>
        <span className="sidebar-nav-label" style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {active.name}
          </span>
          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)' }}>{ROLE_LABEL[active.role]}</span>
        </span>
        <ChevronsUpDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} className="sidebar-nav-label" />
      </button>

      {open && orgs.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 8,
            right: 8,
            zIndex: 40,
            background: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-md)',
            padding: 4,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === active.id}
              onClick={() => switchTo(o.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 8px',
                borderRadius: 7,
                background: o.id === active.id ? 'var(--accent-dim)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {o.name}
                </span>
                <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)' }}>{ROLE_LABEL[o.role]}</span>
              </span>
              {o.id === active.id && <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
