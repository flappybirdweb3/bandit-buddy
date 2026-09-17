import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useGame } from '@/providers/GameProvider';
import type { DexTier } from '@/types/game.types';

export function useDexTier(refetchInterval?: number) {
  const { profile } = useGame();
  const walletAddress = profile?.walletAddress;

  const query = useQuery<DexTier>({
    queryKey: ['dex-tier', walletAddress],
    queryFn: api.getDexTier,
    staleTime: 60_000,
    enabled: !!walletAddress,
    refetchInterval,
  });

  const dexTier = query.data;
  const tier = dexTier?.tier ?? 1;
  const buyTax = dexTier?.buyTax ?? (tier === 3 ? 0.01 : tier === 2 ? 0.02 : 0.03);
  const sellTax = dexTier?.sellTax ?? (tier === 3 ? 0.015 : tier === 2 ? 0.03 : 0.05);

  return {
    ...query,
    dexTier,
    tier,
    buyTax,
    sellTax,
    buyTaxPct: (buyTax * 100).toFixed(1) + '%',
    sellTaxPct: (sellTax * 100).toFixed(1) + '%',
    volume24h: dexTier?.volume24h ?? 0,
    walletAddress,
  };
}
