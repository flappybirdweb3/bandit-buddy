import type { Metadata } from 'next'
import Whitepaper from '@/components/Whitepaper'

export const metadata: Metadata = {
  title: 'White Paper — The Frontier, By Design',
  description: 'A plain-language overview of the Bandit Buddy game economy, ownership model, guilds, fusion economy, and fair randomness systems.',
  openGraph: { title: 'White Paper | Bandit Buddy', url: 'https://banditbuddy.xyz/whitepaper' },
  alternates: { canonical: 'https://banditbuddy.xyz/whitepaper' },
}

export default function WhitepaperPage() {
  return <Whitepaper />
}
