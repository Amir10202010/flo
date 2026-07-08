import type { Metadata } from 'next'
import AboutContent from './AboutContent'

export const metadata: Metadata = {
  title: 'About — Velnox',
  description:
    'Why we built Velnox: a shared Gmail inbox that gives every thread an owner and an AI-drafted reply, so busy teams stop dropping conversations.',
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'website',
    siteName: 'Velnox',
    title: 'About — Velnox',
    description: 'Why we built Velnox — the AI shared inbox for teams that runs on the Gmail you already use.',
    url: '/about',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About — Velnox',
    description: 'Why we built Velnox — the AI shared inbox for teams that runs on the Gmail you already use.',
  },
}

export default function AboutPage() {
  return <AboutContent />
}
