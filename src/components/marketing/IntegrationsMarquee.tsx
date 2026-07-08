'use client'

import { useReducedMotion } from 'framer-motion'

/* Honest integrations band: a continuously scrolling row of the mail + messaging
   services Velnox connects to. Only Gmail is live today — the caption carries
   that honesty so we never over-claim (module-honesty policy). Pure CSS loop
   (no framer-motion) for a cheap, smooth infinite scroll; edges fade via a
   mask, the track pauses on hover, and reduced motion collapses it to a calm
   static row. */
// Email providers only. Gmail is live today; the rest are on the roadmap and
// the caption says so. We deliberately omit unbuilt messaging channels
// (Telegram/WhatsApp/Instagram) so the marquee never promises what we can't do.
const SERVICES: { name: string; icon: string }[] = [
  { name: 'Gmail', icon: '/icons/gmail.svg' },
  { name: 'Outlook', icon: '/icons/outlook.svg' },
  { name: 'Yahoo Mail', icon: '/icons/yahoo.svg' },
  { name: 'iCloud Mail', icon: '/icons/icloud.svg' },
  { name: 'Proton Mail', icon: '/icons/proton.svg' },
]

function Item({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="marquee-item">
      <img src={icon} alt="" width={22} height={22} style={{ display: 'block', flexShrink: 0 }} />
      <span>{name}</span>
    </div>
  )
}

export default function IntegrationsMarquee() {
  const reduce = useReducedMotion()

  return (
    <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <div className="mkt-x" style={{ maxWidth: 1140, margin: '0 auto', padding: '26px 32px' }}>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 18px' }}>
          Works with <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Gmail</strong> today — more channels on the way.
        </p>

        {reduce ? (
          <div className="marquee-static">
            {SERVICES.map(s => <Item key={s.name} {...s} />)}
          </div>
        ) : (
          <div className="marquee" aria-hidden>
            {/* set rendered twice back-to-back for a seamless -50% loop */}
            <div className="marquee-track">
              {SERVICES.map(s => <Item key={`a-${s.name}`} {...s} />)}
              {SERVICES.map(s => <Item key={`b-${s.name}`} {...s} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
