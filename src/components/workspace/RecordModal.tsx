'use client'

/**
 * Create/edit modal for one workspace record — the form is generated from the
 * object's FieldSpecs via DynamicField. Reuses the compose-modal shell styles.
 * Deletion is two-step inline (no window.confirm).
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, X } from 'lucide-react'
import type { WorkspaceObjectModel } from '@/services/workspace/workspace.service'
import type { RecordModel } from '@/services/workspace/record.service'
import DynamicField, { fieldInputStyle } from './DynamicField'

export default function RecordModal({
  object,
  record,
  onClose,
}: {
  object: WorkspaceObjectModel
  /** Null → create mode. */
  record: RecordModel | null
  onClose: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(record?.title ?? '')
  const [stageKey, setStageKey] = useState<string>(record?.stageKey ?? object.pipeline?.[0]?.key ?? '')
  const [data, setData] = useState<Record<string, unknown>>(record ? { ...record.data } : {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const editing = !!record

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const url = editing ? `/api/records/${record.id}` : `/api/objects/${object.key}/records`
      const r = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, stageKey: stageKey || null, data }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        setError(d?.error ?? 'Could not save')
        return
      }
      onClose()
      router.refresh()
    } catch {
      setError('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!record) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/records/${record.id}`, { method: 'DELETE' })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        setError(d?.error ?? 'Could not delete')
        return
      }
      onClose()
      router.refresh()
    } catch {
      setError('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="compose-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="compose-modal" role="dialog" aria-modal="true" aria-label={`${editing ? 'Edit' : 'New'} ${object.singular}`}>
        <div className="compose-head">
          <h2>{editing ? `Edit ${object.singular.toLowerCase()}` : `New ${object.singular.toLowerCase()}`}</h2>
          <button type="button" className="compose-x" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="composer-error" role="alert">
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            {error}
          </p>
        )}

        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '62vh', overflowY: 'auto', padding: '2px 2px 4px' }}>
          <label>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
              Title <span style={{ color: 'var(--hot)' }}>*</span>
            </span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${object.singular} title`}
              style={fieldInputStyle}
            />
          </label>

          {object.pipeline && object.pipeline.length > 0 && (
            <label>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Stage</span>
              <select value={stageKey} onChange={(e) => setStageKey(e.target.value)} style={fieldInputStyle}>
                {object.pipeline.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </label>
          )}

          {object.fields.map((f) => (
            <DynamicField
              key={f.key}
              field={f}
              value={data[f.key]}
              onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))}
            />
          ))}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <button type="submit" className="btn-primary" disabled={busy} style={{ justifyContent: 'center' }}>
              {busy ? 'Saving…' : editing ? 'Save changes' : `Create ${object.singular.toLowerCase()}`}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <div style={{ flex: 1 }} />
            {editing && !confirmDelete && (
              <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(true)} disabled={busy} style={{ color: 'var(--hot)' }}>
                Delete
              </button>
            )}
            {editing && confirmDelete && (
              <button type="button" className="btn-ghost" onClick={remove} disabled={busy} style={{ color: 'var(--hot)', fontWeight: 700 }}>
                Confirm delete?
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
