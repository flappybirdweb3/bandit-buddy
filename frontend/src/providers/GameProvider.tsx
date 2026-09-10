import { createContext, useContext, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { UserProfile, FarmData, SeedConfig } from '@/types/game.types';

interface GameContextValue {
  profile: UserProfile | undefined;
  myFarm: FarmData | undefined;
  seeds: SeedConfig[];
  isLoading: boolean;
  refetchAll: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
    refetchInterval: 30_000,
  });

  const { data: myFarm, isLoading: farmLoading } = useQuery({
    queryKey: ['myFarm'],
    queryFn: api.getMyFarm,
    refetchInterval: 5_000,
  });

  const { data: seeds = [] } = useQuery({
    queryKey: ['seeds'],
    queryFn: api.getSeeds,
    staleTime: Infinity,
  });

  const refetchAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['profile'] });
    qc.invalidateQueries({ queryKey: ['myFarm'] });
  }, [qc]);

  // Always-fresh refs so the scene-ready handler can access latest data
  const myFarmRef  = useRef(myFarm);
  const profileRef = useRef(profile);
  useEffect(() => { myFarmRef.current  = myFarm;  }, [myFarm]);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // Push data to Phaser whenever it changes
  useEffect(() => {
    if (myFarm) eventBus.emit('farm-updated', myFarm);
  }, [myFarm]);

  useEffect(() => {
    if (profile) eventBus.emit('profile-updated', profile);
  }, [profile]);

  // Re-push current data when Phaser scene finishes initialising (race condition guard)
  useEffect(() => {
    const unsub = eventBus.on('scene-ready', () => {
      if (myFarmRef.current)  eventBus.emit('farm-updated',    myFarmRef.current);
      if (profileRef.current) eventBus.emit('profile-updated', profileRef.current);
    });
    return unsub;
  }, []);

  return (
    <GameContext.Provider value={{
      profile,
      myFarm,
      seeds,
      isLoading: profileLoading || farmLoading,
      refetchAll,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be inside GameProvider');
  return ctx;
};
