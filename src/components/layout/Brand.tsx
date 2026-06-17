import Link from 'next/link'

/**
 * Brand lockup — the Velnox "V" mark (public/logo.png) followed by the serif
 * wordmark. Single source of truth for the three places the brand appears:
 * the marketing navbar, the dashboard sidebar, and the dashboard mobile topbar.
 * `size` drives the wordmark font-size; the mark scales with it.
 */
export default function Brand({
  size = 26,
  className,
  style,
}: {
  size?: number
  className?: string
  style?: React.CSSProperties
}) {
  const mark = Math.round(size * 0.92)
  return (
    <Link
      href="/"
      className={className}
      aria-label="Velnox home"
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.28), textDecoration: 'none', ...style }}
    >
      <img
        src="/logo.png"
        alt=""
        width={mark}
        height={mark}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }}
      />
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: size, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        velnox
      </span>
    </Link>
  )
}
