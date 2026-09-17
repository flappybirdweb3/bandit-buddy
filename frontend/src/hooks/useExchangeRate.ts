import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { ExchangeRate } from '@/types/game.types';

export function useExchangeRate(refetchInterval: number = 60_000) {
  const query = useQuery<ExchangeRate>({
    queryKey: ['exchange-rate'],
    queryFn: api.getExchangeRate,
    refetchInterval,
    staleTime: 30_000,
  });

  const rate = query.data;
  const isLive = Boolean(
    (rate?.source === 'dex' || rate?.source === 'pancakeswap-v2') &&
    (rate?.farmPriceUsd ?? 0) > 0
  );
  const killSwitchActive = Boolean(rate?.killSwitchActive);

  return {
    ...query,
    rate,
    isLive,
    killSwitchActive,
    farmPriceUsd: rate?.farmPriceUsd ?? 0,
    farmPriceBnb: rate?.farmPriceBnb ?? 0,
    goldPerFarm: rate?.goldPerFarm ?? 1,
  };
}
