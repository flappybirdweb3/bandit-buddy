import type { Metadata } from 'next'
import HomeClient from '@/components/HomeClient'

export const metadata: Metadata = {
  title: 'Bandit Buddy — Build Your Legend, Own the Frontier',
  description: 'Bandit Buddy is a living, breathing ranch game on-chain. Grow your land, collect rare buddies, and ride into a world where every choice is yours to keep.',
  openGraph: {
    title: 'Bandit Buddy — Build Your Legend, Own the Frontier',
    description: 'Play-to-own ranch game on BSC. Plant, harvest, steal, and earn $FARM.',
    url: 'https://banditbuddy.xyz',
  },
  twitter: {
    title: 'Bandit Buddy — Own the Frontier',
    description: 'Play-to-own ranch game on BSC.',
  },
}

export default function HomePage() {
  return <HomeClient />
}
