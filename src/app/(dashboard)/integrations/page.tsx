import type { Metadata } from 'next'
import IntegrationsClient from './IntegrationsClient'

export const metadata: Metadata = { title: 'Integrations — Velnox' }

export default function IntegrationsPage() {
  return <IntegrationsClient />
}
