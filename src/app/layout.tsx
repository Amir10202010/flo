import type { Metadata } from 'next'
import { Inter, Instrument_Serif } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import PostHogProvider from '@/components/analytics/PostHogProvider'
import './globals.css'

// One typeface for the product (UI + marketing body): Inter, the calm, neutral,
// "invisible" sans used by Linear/GitHub/Stripe. Instrument Serif exists for a
// single job — the landing hero headline (.hero-serif) — and must not creep
// into UI surfaces.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const instrument = Instrument_Serif({
  variable: '--font-instrument',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
})

const TITLE = 'Velnox — The AI assistant for your inbox'
const DESCRIPTION =
  'Velnox reads your Gmail and tells you who to reply to and follow up with today — and drafts the reply. Connect in 30 seconds. It’s your own inbox.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: 'Velnox',
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-scroll-behavior suppresses Next.js router warning about smooth scroll
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${instrument.variable} h-full`}>
      <body className="min-h-full">
        <PostHogProvider>{children}</PostHogProvider>
        <Analytics />
      </body>
    </html>
  )
}
