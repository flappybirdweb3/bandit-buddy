import type { Metadata } from 'next'
import Roadmap from '@/components/Roadmap'

export const metadata: Metadata = {
  title: 'Roadmap — A Trail Worth Following',
  description: 'From the first campfire to a living on-chain world. Genesis Gacha, Dog Breeding, Genetic Marketplace, and the full on-chain launch of Bandit Buddy.',
  openGraph: { title: 'Roadmap Season 01 | Bandit Buddy', url: 'https://banditbuddy.xyz/roadmap' },
  alternates: { canonical: 'https://banditbuddy.xyz/roadmap' },
}

export default function RoadmapPage() {
  return <Roadmap />
}
