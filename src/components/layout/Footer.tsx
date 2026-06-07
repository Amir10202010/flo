import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', padding: '36px 32px', background: '#FFFFFF' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>flo</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginBottom: 8, display: 'inline-block' }} />
        </Link>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          AI inbox for sales managers · © 2025
        </p>
      </div>
    </footer>
  )
}
