'use client'

/**
 * One form input rendered purely from a FieldSpec — the input widget comes
 * from the field-type registry (`FIELD_TYPES[type].input`), never from
 * industry-specific code. Values stay raw in form state; the record service
 * coerces/validates on write.
 */
import { FIELD_TYPES, type FieldSpec } from '@/lib/workspace/field-types'

export const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  fontSize: 13.5,
  borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'var(--bg-base)',
  color: 'var(--text-primary)',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 5,
}

export default function DynamicField({
  field,
  value,
  onChange,
}: {
  field: FieldSpec
  value: unknown
  onChange: (value: unknown) => void
}) {
  const input = FIELD_TYPES[field.type].input
  const required = field.required
  const label = (
    <span style={labelStyle}>
      {field.label}
      {required && <span style={{ color: 'var(--hot)' }}> *</span>}
    </span>
  )

  if (input === 'textarea') {
    return (
      <label>
        {label}
        <textarea
          rows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...fieldInputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </label>
    )
  }

  if (input === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          style={{ accentColor: 'var(--accent)' }}
        />
        <span style={{ ...labelStyle, marginBottom: 0 }}>{field.label}</span>
      </label>
    )
  }

  if (input === 'select') {
    return (
      <label>
        {label}
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          style={fieldInputStyle}
        >
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
    )
  }

  if (input === 'multiselect') {
    const selected = Array.isArray(value) ? (value as string[]) : []
    const toggle = (option: string) =>
      onChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option])
    return (
      <div>
        {label}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(field.options ?? []).map((o) => {
            const on = selected.includes(o)
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                aria-pressed={on}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-xs, 6px)',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent-dim)' : 'transparent',
                  color: on ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {o}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // text / number / date / datetime-local / email / tel / url
  return (
    <label>
      {label}
      <input
        type={input}
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        onChange={(e) => onChange(e.target.value)}
        style={fieldInputStyle}
        step={input === 'number' ? 'any' : undefined}
      />
    </label>
  )
}
