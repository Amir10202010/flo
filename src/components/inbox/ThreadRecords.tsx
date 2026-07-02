'use client'

/**
 * "Records" section of the thread context rail — shows workspace records
 * linked to this conversation and a search-to-link picker. Hidden entirely
 * for orgs with no workspace profile (no objects to link).
 */
import { createElement, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Link2, X } from 'lucide-react'
import { iconFor } from '@/lib/workspace/icons'
import { useWorkspaceSchema } from '@/lib/workspace/use-workspace-schema'
import type { LinkedRecord } from '@/services/workspace/record.service'

export default function ThreadRecords({ conversationId }: { conversationId: string }) {
  const { schema } = useWorkspaceSchema()
  const [records, setRecords] = useState<LinkedRecord[] | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LinkedRecord[]>([])
  const [busy, setBusy] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/conversations/${conversationId}/records`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setRecords((d?.records as LinkedRecord[]) ?? [])
      })
      .catch(() => {
        if (alive) setRecords([])
      })
    return () => {
      alive = false
    }
  }, [conversationId])

  // Debounced search for the picker; short queries render no dropdown (see
  // visibleResults) so the effect never needs a synchronous reset.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/workspace/records/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        const d = await r.json().catch(() => null)
        setResults(((d?.records as LinkedRecord[]) ?? []).filter((res) => !records?.some((x) => x.recordId === res.recordId)))
      } catch {
        /* aborted or offline — keep previous results */
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query, records])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setResults([])
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const visibleResults = query.trim().length >= 2 ? results : []

  // No workspace objects → nothing to link; keep the rail clean.
  if (!schema || schema.objects.length === 0) return null

  async function link(recordId: string) {
    setBusy(true)
    try {
      const r = await fetch(`/api/conversations/${conversationId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId }),
      })
      const d = await r.json().catch(() => null)
      if (r.ok && d?.record) {
        setRecords((prev) => [d.record as LinkedRecord, ...(prev ?? []).filter((x) => x.recordId !== recordId)])
        setQuery('')
        setResults([])
      }
    } finally {
      setBusy(false)
    }
  }

  async function unlink(linkId: string) {
    setBusy(true)
    try {
      const r = await fetch(`/api/conversations/${conversationId}/records?linkId=${encodeURIComponent(linkId)}`, { method: 'DELETE' })
      if (r.ok) setRecords((prev) => (prev ?? []).filter((x) => x.linkId !== linkId))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rail-section">
      <h3 className="rail-label">Records</h3>

      {records === null ? (
        <p className="rail-empty">Loading…</p>
      ) : records.length === 0 ? (
        <p className="rail-empty">Nothing linked yet — connect this thread to a {schema.objects[0].singular.toLowerCase()} or any other record.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {records.map((r) => (
            <div
              key={r.recordId}
              style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', background: 'var(--bg-base)' }}
            >
              {createElement(iconFor(r.icon), { size: 13, style: { color: 'var(--text-muted)', flexShrink: 0 } })}
              <Link href={`/o/${r.objectKey}`} style={{ minWidth: 0, flex: 1, textDecoration: 'none' }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                  {r.objectSingular}
                  {r.stageLabel ? ` · ${r.stageLabel}` : ''}
                </span>
              </Link>
              {r.linkId && (
                <button
                  type="button"
                  onClick={() => unlink(r.linkId!)}
                  disabled={busy}
                  aria-label={`Unlink ${r.title}`}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', padding: 2, flexShrink: 0 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div ref={boxRef} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', background: 'var(--bg-base)' }}>
          <Link2 size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Link a record…"
            aria-label="Search records to link"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--text-primary)', width: '100%', minWidth: 0 }}
          />
        </div>
        {visibleResults.length > 0 && (
          <div className="rail-menu" role="listbox" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30 }}>
            {visibleResults.map((r) => (
              <button key={r.recordId} type="button" className="rail-menu-item" onClick={() => link(r.recordId)} disabled={busy}>
                {createElement(iconFor(r.icon), { size: 12, style: { flexShrink: 0 } })}
                <span className="rail-trunc">{r.title}</span>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>{r.objectSingular}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
