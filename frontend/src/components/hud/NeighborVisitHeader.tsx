import { useState } from 'react';
import { Home, ChevronRight, Hand, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import { useGame } from '@/providers/GameProvider';

interface Props {
  targetUserId: string;
  targetUsername: string;
  hasGuardDog: boolean;
  guardDogType: string | null;
  guardDogDefense?: number;
  isRevenge?: boolean;
  onReturn: () => void;
}

const PET_LABEL: Record<string, string> = {
  Chihuahua: '🐕 Chihuahua', Corgi: '🦊 Corgi', Husky: '🐺 Husky',
  Rottweiler: '🦮 Rottweiler', Doberman: '🐾 Doberman', Pitbull: '💀 Pitbull',
};

export function NeighborVisitHeader({
  targetUserId,
  targetUsername,
  hasGuardDog,
  guardDogType,
  guardDogDefense = 0,
  isRevenge = false,
  onReturn,
}: Props) {
  const { profile } = useGame();
  const [isSwitching, setIsSwitching] = useState(false);

  // Fetch explore targets to power "Next Farm" hopping
  const { data: exploreFarms = [] } = useQuery({
    queryKey: ['exploreFarms'],
    queryFn: api.getExploreFarms,
    staleTime: 30_000,
  });

  const dailySteals = profile?.dailyStealCount ?? 0;
  const maxSteals = profile?.maxDailySteals ?? 5;

  const handleNextFarm = () => {
    if (exploreFarms.length === 0 || isSwitching) return;

    setIsSwitching(true);
    // Filter out current farm
    const candidates = exploreFarms.filter((f) => f.userId !== targetUserId);
    if (candidates.length === 0) {
      setIsSwitching(false);
      return;
    }

    // Pick next candidate in list or first
    const currentIndex = exploreFarms.findIndex((f) => f.userId === targetUserId);
    const nextTarget = candidates[(currentIndex + 1) % candidates.length] ?? candidates[0];

    if (nextTarget) {
      eventBus.emit('visit-farm', { userId: nextTarget.userId, username: nextTarget.username });
    }
    setTimeout(() => setIsSwitching(false), 400);
  };

  const dogLabel = guardDogType && PET_LABEL[guardDogType] ? PET_LABEL[guardDogType] : '🐕 Guard';

  return (
    <header className="fixed top-2 left-0 right-0 z-50 px-3 pointer-events-none">
      <div className="max-w-xl mx-auto glass rounded-2xl p-2.5 flex items-center justify-between gap-2 shadow-2xl border border-white/15 pointer-events-auto backdrop-blur-xl">
        {/* Return Home Button */}
        <button
          onClick={onReturn}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass hover:bg-white/15 active:scale-95 transition-all text-white/80 hover:text-white flex-shrink-0"
          title="Return to your own farm"
        >
          <Home size={15} className="text-amber-400" />
          <span className="text-xs font-black">My Farm</span>
        </button>

        {/* Center Target Info */}
        <div className="flex flex-col items-center justify-center min-w-0 flex-1 px-1">
          <div className="flex items-center gap-1.5 max-w-full">
            <span className="text-white font-black text-xs truncate">@{targetUsername}</span>
            {hasGuardDog && guardDogDefense > 0 ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                <ShieldAlert size={9} />
                {dogLabel} ({guardDogDefense}%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <ShieldCheck size={9} />
                Open
              </span>
            )}
            {isRevenge && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-black bg-red-600/30 text-red-300 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse">
                ⚔️ REVENGE (35% CAP)
              </span>
            )}
          </div>

          {/* Steals Left Sub-pill */}
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/50">
            <span className="flex items-center gap-0.5">
              <Hand size={9} className="text-red-400" />
              <span className={`font-bold ${dailySteals >= maxSteals ? 'text-red-400' : 'text-white/70'}`}>
                {dailySteals}/{maxSteals} steals today
              </span>
            </span>
          </div>
        </div>

        {/* Next Farm Button */}
        <button
          onClick={handleNextFarm}
          disabled={exploreFarms.length <= 1 || isSwitching}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none flex-shrink-0"
          title="Jump to next neighbor farm"
        >
          {isSwitching ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <>
              <span>Next</span>
              <ChevronRight size={14} />
            </>
          )}
        </button>
      </div>
    </header>
  );
}
