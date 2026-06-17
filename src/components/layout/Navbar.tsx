'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import Brand from './Brand'

const LINKS = [
  { href: '/about',    label: 'About' },
  { href: '/features', label: 'Features' },
  { href: '/contact',  label: 'Contact' },
  { href: '/pricing',  label: 'Pricing' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })

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
        boxShadow: scrolled || menuOpen ? '0 1px 24px rgba(12,18,60,0.07)' : 'none',
      }}
    >
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 32px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <Brand size={26} />

        <nav className="navbar-links" style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {LINKS.map(l => {
            const active = pathname === l.href
            return (
              <Link key={l.href} href={l.href} className={`nav-link${active ? ' nav-link-active' : ''}`} aria-current={active ? 'page' : undefined}>
                {l.label}
              </Link>
            )
          })}
        </nav>

        <div className="nav-cta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link href="/login" style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, textDecoration: 'none', borderRadius: 8, transition: 'color 0.15s' }}>
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary" style={{ padding: '8px 18px', fontSize: 14, gap: 6 }}>
            Get started <ArrowRight size={14} />
          </Link>
        </div>

        <button
          type="button"
          className="nav-burger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>

      {/* Scroll progress — thin gradient line tied to page scroll */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute', left: 0, bottom: 0, height: 2, width: '100%',
          transformOrigin: '0% 50%', scaleX: progress,
          background: 'linear-gradient(90deg, #4F5CF4, #7C4DFF)',
        }}
      />

      {/* Mobile dropdown menu — smooth height + fade */}
      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.div
            className="nav-mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="nav-mobile-inner">
              {LINKS.map(l => {
                const active = pathname === l.href
                return (
                  <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className={`nav-mobile-link${active ? ' active' : ''}`}>
                    {l.label}
                  </Link>
                )
              })}
              <div className="nav-mobile-actions">
                <Link href="/login" onClick={() => setMenuOpen(false)} className="btn-ghost" style={{ justifyContent: 'center' }}>Sign in</Link>
                <Link href="/signup" onClick={() => setMenuOpen(false)} className="btn-primary" style={{ justifyContent: 'center' }}>Get started</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
