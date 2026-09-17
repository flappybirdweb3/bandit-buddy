import type { Metadata } from 'next'
import TokenSale from '@/components/TokenSale'

export const metadata: Metadata = {
  title: 'Token Sale — Buy $FARM | Own the Frontier',
  description: 'Join the $FARM token sale. Angel round $0.001, Private sale $0.0025, Public IDO $0.005. Transparent vesting, community allocation, BSC network.',
  openGraph: {
    title: 'Token Sale — Buy $FARM | Bandit Buddy',
    description: 'Three sale rounds: Angel $0.001 · Private $0.0025 · Public IDO $0.005. Community-first allocation on BSC.',
    url: 'https://banditbuddy.xyz/token-sale',
  },
  alternates: { canonical: 'https://banditbuddy.xyz/token-sale' },
}

export default function TokenSalePage() {
  return <TokenSale />
}
