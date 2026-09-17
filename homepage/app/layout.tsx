import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Bandit Buddy — Own the frontier',
  description: 'Bandit Buddy is a living, breathing ranch game on-chain. Build your legend and own the frontier.',
  metadataBase: new URL('https://banditbuddy.xyz'),
  openGraph: {
    title: 'Bandit Buddy — Own the frontier',
    description: 'Build your legend. Own the frontier. Play on Telegram.',
    url: 'https://banditbuddy.xyz',
    siteName: 'Bandit Buddy',
    images: [{ url: '/bandit-buddy-mascot.png', width: 400, height: 400 }],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Bandit Buddy',
    description: 'Play-to-own ranch game on BSC.',
    images: ['/bandit-buddy-mascot.png'],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f6f4ef',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-[#f6f4ef]">
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  )
}
