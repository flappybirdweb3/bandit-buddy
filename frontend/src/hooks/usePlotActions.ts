import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { StealResult } from '@/types/game.types';

export function usePlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plotId, seedId }: { plotId: string; seedId: string }) =>
      api.plant(plotId, seedId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useHarvest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plotId: string) => api.harvest(plotId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      if (res.levelUp) eventBus.emit('level-up', { newLevel: res.newLevel });
    },
  });
}

export function useSteal(plotIndex: number) {
  const qc = useQueryClient();
  return useMutation<StealResult, Error, { targetUserId: string; plotId: string }>({
    mutationFn: ({ targetUserId, plotId }) => api.steal(targetUserId, plotId),
    onSuccess: (result) => {
      eventBus.emit('steal-animation', { success: result.success, plotIndex });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['friendFarm'] });
    },
  });
}
