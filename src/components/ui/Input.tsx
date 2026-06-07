interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export default function Input({ label, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <input id={inputId} className="input-base" {...props} />
    </div>
  )
}
