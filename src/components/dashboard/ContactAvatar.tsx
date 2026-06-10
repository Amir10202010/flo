import { avatarGradient, initialsOf } from './avatar'

/** Initials avatar with a colour derived from the contact name — consistent across pages. */
export default function ContactAvatar({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.34),
        color: '#fff',
        background: avatarGradient(name),
      }}
    >
      {initialsOf(name)}
    </div>
  )
}
