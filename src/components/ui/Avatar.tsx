interface AvatarProps {
  initials: string
  color?: string
  background?: string
  size?: number
}

export default function Avatar({ initials, color, background, size }: AvatarProps) {
  return (
    <div
      className="avatar"
      style={{
        ...(size ? { width: size, height: size } : {}),
        color: color ?? 'var(--text-primary)',
        background: background ?? 'var(--bg-elevated)',
      }}
    >
      {initials}
    </div>
  )
}
