import Link from 'next/link'
import { MessageCircle, Globe, Mail } from 'lucide-react'

const linkStyle: React.CSSProperties = { fontSize: 13.5, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.15s' }

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'How it works', href: '/#how' },
      { label: 'Get started', href: '/signup' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Sign in', href: '/login' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy & security', href: '/about' },
    ],
  },
]

const SOCIAL = [
  { label: 'Email', href: 'mailto:sagindiktar@gmail.com', Icon: Mail },
  { label: 'Community', href: '#', Icon: MessageCircle },
  { label: 'Website', href: '/', Icon: Globe },
]

export default function Footer() {
  return (
    <footer className="mkt-x" style={{ borderTop: '1px solid var(--border)', padding: '64px 32px 32px', background: '#FFFFFF' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div className="footer-top" style={{ display: 'flex', flexWrap: 'wrap', gap: 48, justifyContent: 'space-between', marginBottom: 44 }}>
          <div style={{ maxWidth: 300 }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none', marginBottom: 14 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>velnox</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginBottom: 9, display: 'inline-block' }} />
            </Link>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>
              The AI Gmail inbox for client-facing teams. Every client thread, sorted by who needs you first — so no warm deal ever goes cold.
            </p>
            <div className="footer-social">
              {SOCIAL.map(({ label, href, Icon }) => (
                <a key={label} href={href} aria-label={label} target="_blank" rel="noopener noreferrer">
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>

          <div className="footer-links" style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
            {columns.map(col => (
              <div key={col.title}>
                <h4 style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 14px' }}>
                  {col.title}
                </h4>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {col.links.map(l => (
                    <li key={l.label}>
                      <Link href={l.href} style={linkStyle} className="footer-link">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            © 2026 Velnox · AI Gmail inbox for client-facing teams
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 12.5, color: 'var(--text-muted)' }}>
            <Link href="/privacy" style={{ ...linkStyle, fontSize: 12.5 }} className="footer-link">Privacy</Link>
            <Link href="/terms" style={{ ...linkStyle, fontSize: 12.5 }} className="footer-link">Terms</Link>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 3px rgba(22,163,74,0.15)' }} />
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
