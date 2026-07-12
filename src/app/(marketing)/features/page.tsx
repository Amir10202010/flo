import type { Metadata } from 'next'
import FeaturesContent from './FeaturesContent'

export const metadata: Metadata = {
  title: 'Features — Velnox',
  description:
    'Your Gmail, triaged by AI: a ranked inbox, a going-cold radar, review-before-send reply drafts and search by meaning — on the Gmail you already use. Built for solo client work.',
  alternates: { canonical: '/features' },
  openGraph: {
    type: 'website',
    siteName: 'Velnox',
    title: 'Features — Velnox',
    description: 'AI triage, a going-cold radar, drafted replies and search by meaning — on the Gmail you already use.',
    url: '/features',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Features — Velnox',
    description: 'AI triage, a going-cold radar, drafted replies and search by meaning — on the Gmail you already use.',
  },
}

export default function FeaturesPage() {
  return <FeaturesContent />
}
