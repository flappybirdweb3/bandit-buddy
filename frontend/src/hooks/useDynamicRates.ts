import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { DynamicRates } from '@/types/game.types';

export function useDynamicRates(refetchInterval: number = 20_000) {
  const query = useQuery<DynamicRates>({
    queryKey: ['dynamic-rates'],
    queryFn: api.getDynamicRates,
    refetchInterval,
    staleTime: 15_000,
  });

  const data = query.data;

  // Calculators:
  // Convert FARM -> GOLD (Deposit)
  // GOLD = FARM * depositRate
  const calculateGoldFromFarm = (farmAmount: number): number => {
    if (!farmAmount || farmAmount <= 0) return 0;
    const rate = data?.depositRate ?? (data?.baseRate ?? 1.45);
    return Number((farmAmount * rate).toFixed(2));
  };

  // Convert GOLD -> FARM (Withdraw / Cashout)
  // FARM = GOLD * withdrawRate
  const calculateFarmFromGold = (goldAmount: number): number => {
    if (!goldAmount || goldAmount <= 0) return 0;
    const rate = data?.withdrawRate ?? 0.65;
    return Number((goldAmount * rate).toFixed(4));
  };

  // Minimum gold required to receive 1 FARM
  const minGoldForOneFarm = data?.withdrawRate && data.withdrawRate > 0
    ? Math.ceil(1.0 / data.withdrawRate)
    : 2;

  return {
    ...query,
    rates: data,
    farmPriceUsd: data?.farmPriceUsd ?? 0.000146,
    farmPriceBnb: data?.farmPriceBnb ?? 0.0000002,
    baseRate: data?.baseRate ?? 1.45,
    alpha: data?.alpha ?? 1.0,
    depositRate: data?.depositRate ?? 1.45,
    withdrawRate: data?.withdrawRate ?? 0.65,
    goldPerFarmWithdraw: data?.goldPerFarmWithdraw ?? 1.53,
    depositFeePct: (data?.depositFee ?? 0) * 100,
    withdrawFeePct: (data?.withdrawFee ?? 0.05) * 100,
    economyStatus: data?.economyStatus ?? 'balanced',
    treasuryFarmBalance: data?.treasuryFarmBalance ?? 50000,
    killSwitchActive: Boolean(data?.killSwitchActive),
    killSwitchReason: data?.killSwitchReason ?? null,
    calculateGoldFromFarm,
    calculateFarmFromGold,
    minGoldForOneFarm,
  };
}
