'use client'

/**
 * Manual field builder — the first schema-editing surface. Posts to the
 * admin-gated fields endpoint; the page refresh re-reads the schema so the
 * new column/input appears everywhere at once.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, X } from 'lucide-react'
import type { FieldTypeKey } from '@/lib/workspace/field-types'
import type { WorkspaceObjectModel } from '@/services/workspace/workspace.service'
import { fieldInputStyle } from './DynamicField'

const TYPE_LABELS: { value: FieldTypeKey; label: string }[] = [
  { value: 'TEXT', label: 'Text' },
  { value: 'LONG_TEXT', label: 'Long text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'MONEY', label: 'Money' },
  { value: 'DATE', label: 'Date' },
  { value: 'DATETIME', label: 'Date & time' },
  { value: 'BOOLEAN', label: 'Checkbox' },
  { value: 'SELECT', label: 'Select (one of…)' },
  { value: 'MULTI_SELECT', label: 'Multi-select' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'URL', label: 'Link' },
]

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 5,
}

export default function AddFieldModal({
  object,
  onClose,
}: {
  object: WorkspaceObjectModel
  onClose: () => void
}) {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [type, setType] = useState<FieldTypeKey>('TEXT')
  const [optionsRaw, setOptionsRaw] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [showInList, setShowInList] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wantsOptions = type === 'SELECT' || type === 'MULTI_SELECT'

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/objects/${object.key}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          type,
          options: wantsOptions ? optionsRaw.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
          currency: type === 'MONEY' ? currency : undefined,
          showInList,
        }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        setError(d?.error ?? 'Could not add the field')
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
      <div className="compose-modal" role="dialog" aria-modal="true" aria-label={`Add a field to ${object.plural}`}>
        <div className="compose-head">
          <h2>Add a field to {object.plural.toLowerCase()}</h2>
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

        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <span style={labelStyle}>Field name <span style={{ color: 'var(--hot)' }}>*</span></span>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Insurance policy number"
              style={fieldInputStyle}
            />
          </label>

          <label>
            <span style={labelStyle}>Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as FieldTypeKey)} style={fieldInputStyle}>
              {TYPE_LABELS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          {wantsOptions && (
            <label>
              <span style={labelStyle}>Options (comma-separated) <span style={{ color: 'var(--hot)' }}>*</span></span>
              <input
                value={optionsRaw}
                onChange={(e) => setOptionsRaw(e.target.value)}
                placeholder="Basic, Premium, VIP"
                style={fieldInputStyle}
              />
            </label>
          )}

          {type === 'MONEY' && (
            <label>
              <span style={labelStyle}>Currency</span>
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} style={{ ...fieldInputStyle, width: 90, textTransform: 'uppercase' }} />
            </label>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={showInList} onChange={(e) => setShowInList(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            <span style={{ ...labelStyle, marginBottom: 0 }}>Show as a column in the list</span>
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button type="submit" className="btn-primary" disabled={busy} style={{ justifyContent: 'center' }}>
              {busy ? 'Adding…' : 'Add field'}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
