import Link from 'next/link'

const linkStyle: React.CSSProperties = { fontSize: 13.5, color: 'var(--text-secondary)', textDecoration: 'none' }

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Sign in', href: '/login' },
      { label: 'Get started', href: '/signup' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
]

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', padding: '56px 32px 32px', background: '#FFFFFF' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, justifyContent: 'space-between', marginBottom: 40 }}>
          <div style={{ maxWidth: 280 }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none', marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>flo</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginBottom: 8, display: 'inline-block' }} />
            </Link>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
              The AI inbox for managers of service businesses. One place for every customer conversation.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
            {columns.map(col => (
              <div key={col.title}>
                <h4 style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 14px' }}>
                  {col.title}
                </h4>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map(l => (
                    <li key={l.label}>
                      <Link href={l.href} style={linkStyle}>{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            AI inbox for service businesses · © 2026 Flo
          </p>
        </div>
      </div>
    </footer>
  )
}
