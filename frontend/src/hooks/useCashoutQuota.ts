import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { CashoutQuota } from '@/types/game.types';

export function useCashoutQuota(refetchInterval: number = 20_000) {
  return useQuery<CashoutQuota>({
    queryKey: ['cashout-quota'],
    queryFn: api.getCashoutQuota,
    refetchInterval,
    staleTime: 10_000,
  });
}
