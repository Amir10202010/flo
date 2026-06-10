import type { ReactNode } from 'react'

/** Quiet empty state for a widget body — icon, one-liner, optional hint. */
export default function EmptyNote({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode
  title: string
  hint?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '36px 24px',
        textAlign: 'center',
      }}
    >
      {icon && (
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
          }}
        >
          {icon}
        </div>
      )}
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</p>
      {hint && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', maxWidth: 280, lineHeight: 1.5 }}>{hint}</p>}
    </div>
  )
}
