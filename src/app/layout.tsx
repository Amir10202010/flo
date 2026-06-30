import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

// Single typeface for the whole product (UI + marketing). Variable font, so every
// weight 400–700 is available without separate downloads. Inter is the calm,
// neutral, "invisible" sans used by Linear/GitHub/Stripe — hard to make look
// AI-templated, and it replaces the old DM Sans + Instrument Serif display pairing.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Velnox — The AI shared inbox for teams',
  description:
    'Velnox turns your team’s shared Gmail into one AI-triaged queue — assign threads, leave internal notes, and send AI-drafted replies. Built for support, sales and ops teams.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-scroll-behavior suppresses Next.js router warning about smooth scroll
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
