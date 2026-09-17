import type { Metadata } from 'next'
import Collection from '@/components/Collection'

export const metadata: Metadata = {
  title: 'Collection — Your On-Chain Assets',
  description: 'Browse your Bandit Buddy on-chain collection. Every seed, buddy, and treasure lives in your wallet. Filter by rarity and view token details.',
  openGraph: { title: 'On-Chain Collection | Bandit Buddy', url: 'https://banditbuddy.xyz/collection' },
}

export default function CollectionPage() {
  return <Collection />
}
