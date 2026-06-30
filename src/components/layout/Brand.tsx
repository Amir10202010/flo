import Link from 'next/link'

/**
 * Brand lockup — the Velnox "V" mark (public/logo.png) followed by the wordmark.
 * Single source of truth for the three places the brand appears: the marketing
 * navbar, the dashboard sidebar, and the dashboard mobile topbar.
 * `size` drives the wordmark font-size; the mark scales with it. `href` defaults
 * to the marketing home but the in-app lockups pass `/dashboard` so the logo
 * never drops a signed-in user back onto the public site.
 */
export default function Brand({
  size = 26,
  href = '/',
  className,
  style,
}: {
  size?: number
  href?: string
  className?: string
  style?: React.CSSProperties
}) {
  const mark = Math.round(size * 0.92)
  return (
    <Link
      href={href}
      className={className}
      aria-label="Velnox home"
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.3), textDecoration: 'none', ...style }}
    >
      <img
        src="/logo.png"
        alt=""
        width={mark}
        height={mark}
        style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }}
      />
      <span style={{ fontWeight: 600, fontSize: size, color: 'var(--text-primary)', letterSpacing: '-0.035em', lineHeight: 1 }}>
        velnox
      </span>
    </Link>
  )
}
