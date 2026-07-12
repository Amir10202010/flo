import type { Metadata } from 'next'
import PricingContent from './PricingContent'

export const metadata: Metadata = {
  title: 'Pricing — Velnox',
  description:
    'Simple flat pricing for your own inbox. Free to start on your own Gmail; Pro adds unlimited AI drafts, going-cold alerts and the assistant. Annual = 2 months free.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    type: 'website',
    siteName: 'Velnox',
    title: 'Pricing — Velnox',
    description: 'Simple flat pricing for your own inbox. Free to start; Pro adds unlimited AI drafts and going-cold alerts.',
    url: '/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — Velnox',
    description: 'Simple flat pricing for your own inbox. Free to start; Pro adds unlimited AI drafts and going-cold alerts.',
  },
}

export default function PricingPage() {
  return <PricingContent />
}
