import type { Metadata } from 'next'
import FeaturesContent from './FeaturesContent'

export const metadata: Metadata = {
  title: 'Features — Velnox',
  description:
    'A shared Gmail inbox with an owner on every thread: assignment, internal notes, AI triage and drafts, routing rules, semantic search, roles and an audit log.',
  alternates: { canonical: '/features' },
  openGraph: {
    type: 'website',
    siteName: 'Velnox',
    title: 'Features — Velnox',
    description: 'Assignment, internal notes, AI triage and drafts, routing rules, search, roles and audit — on the Gmail you already use.',
    url: '/features',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Features — Velnox',
    description: 'Assignment, internal notes, AI triage and drafts, routing rules, search, roles and audit — on the Gmail you already use.',
  },
}

export default function FeaturesPage() {
  return <FeaturesContent />
}
