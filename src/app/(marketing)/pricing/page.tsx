import type { Metadata } from 'next'
import PricingContent from './PricingContent'

export const metadata: Metadata = {
  title: 'Pricing — Velnox',
  description:
    'Flat, no-per-seat pricing for the AI shared inbox. Free for one mailbox; Pro, Team and Business add full AI, shared inboxes and roles. Monthly or annual (2 months free).',
  alternates: { canonical: '/pricing' },
  openGraph: {
    type: 'website',
    siteName: 'Velnox',
    title: 'Pricing — Velnox',
    description: 'Flat, no-per-seat pricing for the AI shared inbox. Free to start; upgrade as your team grows.',
    url: '/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — Velnox',
    description: 'Flat, no-per-seat pricing for the AI shared inbox. Free to start; upgrade as your team grows.',
  },
}

export default function PricingPage() {
  return <PricingContent />
}
