import React from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

/* ── Prose primitives ─────────────────────────────────────────────────────────
   Server-component-safe building blocks that match the marketing design system
   (Inter headings + body, shared colour tokens). Reused by the /privacy and
   /terms pages so legal copy stays visually consistent. */

export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 100 }}>
      <h2 className="section-title" style={{ fontSize: 'clamp(20px, 2.6vw, 25px)', margin: '0 0 14px' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </section>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-secondary)', margin: 0 }}>{children}</p>
  )
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</ul>
  )
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{children}</li>
  )
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{children}</strong>
}

/* ── Page shell ──────────────────────────────────────────────────────────────── */
export default function LegalLayout({
  title,
  intro,
  updated,
  sections,
  children,
}: {
  title: string
  intro: string
  updated: string
  sections: { id: string; label: string }[]
  children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Navbar />

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <section className="hero-top mkt-x" style={{ paddingLeft: 32, paddingRight: 32 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <h1 className="display-title" style={{ fontSize: 'clamp(32px, 4.6vw, 46px)', margin: '0 0 16px' }}>
            {title}
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 18px' }}>{intro}</p>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>Last updated: {updated}</p>
        </div>
      </section>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <section className="mkt-x mkt-pb" style={{ padding: '0 32px 120px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 28 }}>
          {/* Table of contents */}
          <nav
            aria-label="On this page"
            className="mkt-card"
            style={{
              padding: '22px 26px',
              borderRadius: 16,
              background: '#FFFFFF',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h2
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                margin: '0 0 14px',
              }}
            >
              On this page
            </h2>
            <ol
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '9px 24px',
                counterReset: 'toc',
              }}
            >
              {sections.map((s, i) => (
                <li key={s.id} style={{ fontSize: 14, lineHeight: 1.4 }}>
                  <a href={`#${s.id}`} className="legal-toc-link" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>{i + 1}.</span>
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Content card */}
          <article
            className="mkt-card"
            style={{
              padding: '40px 44px',
              borderRadius: 20,
              background: '#FFFFFF',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 38,
            }}
          >
            {children}
          </article>

          {/* Cross-link footer */}
          <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            See also our{' '}
            <Link href="/privacy" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/terms" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
