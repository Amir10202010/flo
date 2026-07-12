import type { Metadata } from 'next'
import AboutContent from './AboutContent'

export const metadata: Metadata = {
  title: 'About — Velnox',
  description:
    'Why we built Velnox: an AI assistant for your own Gmail that ranks who to answer today, flags clients going cold, and drafts the reply — so solo client work stops slipping.',
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'website',
    siteName: 'Velnox',
    title: 'About — Velnox',
    description: 'Why we built Velnox — the AI assistant for the solo professional’s Gmail.',
    url: '/about',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About — Velnox',
    description: 'Why we built Velnox — the AI assistant for the solo professional’s Gmail.',
  },
}

export default function AboutPage() {
  return <AboutContent />
}
