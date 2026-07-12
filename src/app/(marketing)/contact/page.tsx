import type { Metadata } from 'next'
import ContactContent from './ContactContent'

export const metadata: Metadata = {
  title: 'Contact — Velnox',
  description:
    'Get in touch with the Velnox team about support, sales or security questions — or just start a free account and try the AI assistant for your Gmail yourself.',
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'website',
    siteName: 'Velnox',
    title: 'Contact — Velnox',
    description: 'Questions about support, sales or security? Talk to the Velnox team.',
    url: '/contact',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact — Velnox',
    description: 'Questions about support, sales or security? Talk to the Velnox team.',
  },
}

export default function ContactPage() {
  return <ContactContent />
}
