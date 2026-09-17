import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ToastProvider from '@/components/ToastProvider'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: { default: 'Bandit Buddy — Own the Frontier', template: '%s | Bandit Buddy' },
  description: 'Bandit Buddy is a living, breathing ranch game on-chain. Build your legend and own the frontier.',
  metadataBase: new URL('https://banditbuddy.xyz'),
  openGraph: {
    siteName: 'Bandit Buddy',
    images: [{ url: '/bandit-buddy-mascot.png', width: 400, height: 400 }],
    type: 'website',
  },
  twitter: {
    card: 'summary',
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
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
        <ToastProvider>
          <Header />
          {children}
          <Footer />
        </ToastProvider>
      </body>
    </html>
  )
}
