'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24)
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className="glass"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        transition: 'box-shadow 0.25s ease',
        boxShadow: scrolled ? '0 1px 24px rgba(12,18,60,0.07)' : 'none',
      }}
    >
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 32px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>flo</span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', marginBottom: 10, display: 'inline-block' }} />
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link href="/login" style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, textDecoration: 'none', borderRadius: 8, transition: 'color 0.15s' }}>
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary" style={{ padding: '8px 18px', fontSize: 14, gap: 6 }}>
            Get started <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </header>
  )
}
