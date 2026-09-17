import type { Metadata } from 'next'
import Community from '@/components/Community'

export const metadata: Metadata = {
  title: 'Community — Pull Up a Chair, Tell Your Story',
  description: 'The campfire is where ranchers swap tips, find a crew, and celebrate the little wins that make the Bandit Buddy frontier feel alive.',
  openGraph: { title: 'Community Campfire | Bandit Buddy', url: 'https://banditbuddy.xyz/community' },
}

export default function CommunityPage() {
  return <Community />
}
