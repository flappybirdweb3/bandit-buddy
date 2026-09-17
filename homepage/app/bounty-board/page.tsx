import type { Metadata } from 'next'
import BountyBoard from '@/components/BountyBoard'

export const metadata: Metadata = {
  title: 'Bounty Board — Good Deeds, Great Rewards',
  description: 'Pick a job, rally your buddies, and earn on-chain assets. Every bounty pushes the Bandit Buddy frontier forward.',
  openGraph: { title: 'Bounty Board | Bandit Buddy', url: 'https://banditbuddy.xyz/bounty-board' },
}

export default function BountyBoardPage() {
  return <BountyBoard />
}
