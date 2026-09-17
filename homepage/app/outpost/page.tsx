import type { Metadata } from 'next'
import Outpost from '@/components/Outpost'

export const metadata: Metadata = {
  title: 'Outpost — Trade Smart, Ride Farther',
  description: 'The Outpost is where the frontier changes hands. Swap resources, discover rare buddies, and make your next move count.',
  openGraph: { title: 'Outpost Market | Bandit Buddy', url: 'https://banditbuddy.xyz/outpost' },
}

export default function OutpostPage() {
  return <Outpost />
}
