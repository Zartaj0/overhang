import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://overhang.vercel.app'),
  title: 'Overhang — Know Your Exit Before You Ape',
  description: 'Birdeye-powered exit intelligence for Solana meme tokens. Get your Safe Size, Seller Overhang score, whale alerts, and a staged Exit Plan in seconds.',
  openGraph: {
    title: 'Overhang — Know Your Exit Before You Ape',
    description: 'Exit intelligence for Solana tokens, powered by Birdeye live data.',
    type: 'website',
    images: [{ url: '/api/og?symbol=SOL&score=42&tier=yellow&tierLabel=Proceed+With+Caution&safeSize=4.5K&top10=38.2&sellPct=54&liq=9.2M', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Overhang — Know Your Exit Before You Ape',
    description: 'Exit intelligence for Solana tokens, powered by Birdeye.',
    images: ['/api/og?symbol=SOL&score=42&tier=yellow&tierLabel=Proceed+With+Caution&safeSize=4.5K&top10=38.2&sellPct=54&liq=9.2M'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
