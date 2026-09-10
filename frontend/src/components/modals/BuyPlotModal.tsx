import { useState } from 'react';
import { X, LockOpen, Coins, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGame } from '@/providers/GameProvider';
import { api } from '@/api/client';

interface Props {
  cost: number;
  onClose: () => void;
}

export function BuyPlotModal({ cost, onClose }: Props) {
  const { profile } = useGame();
  const queryClient = useQueryClient();
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ plotCount: number; nextCost: number | null } | null>(null);

  const canAfford = (profile?.goldBalance ?? 0) >= cost;

  const handleBuy = async () => {
    if (!canAfford || buying) return;
    setBuying(true);
    setError('');
    try {
      const res = await api.buyPlot();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['myFarm'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
      ]);
      setDone({ plotCount: res.plotCount, nextCost: res.nextCost });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to buy plot');
      setBuying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-0" />

        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-white font-black text-base">Unlock Plot</h2>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="px-5 pb-4 flex flex-col items-center gap-4 text-center">
            <div className="text-5xl">🌱</div>
            <div>
              <div className="text-white font-black text-lg">New Plot Unlocked!</div>
              <div className="text-white/50 text-sm mt-1">You now have <span className="text-green-400 font-bold">{done.plotCount} plots</span></div>
            </div>
            {done.nextCost && (
              <div className="glass rounded-2xl px-4 py-2 flex items-center gap-2 text-white/40 text-xs">
                <span>Next plot:</span>
                <Coins size={12} className="text-amber-400" />
                <span className="text-amber-300 font-bold">{done.nextCost}G</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-green-500 text-white font-black text-base active:scale-95 transition-all"
            >
              Start Farming!
            </button>
          </div>
        ) : (
          <div className="px-5 pb-4 flex flex-col gap-4">
            {/* Plot preview */}
            <div className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-amber-900/40 border-2 border-amber-700/40 flex items-center justify-center text-3xl flex-shrink-0">
                🌾
              </div>
              <div>
                <div className="text-white font-bold text-sm">New Farm Plot</div>
                <div className="text-white/40 text-xs mt-0.5">Plant more crops, earn more gold</div>
                <div className="flex items-center gap-1.5 mt-2">
                  <Coins size={13} className="text-amber-400" />
                  <span className="text-amber-300 font-black text-base">{cost}G</span>
                </div>
              </div>
            </div>

            {/* Balance */}
            <div className="flex items-center justify-between px-1">
              <span className="text-white/40 text-xs">Your balance</span>
              <div className="flex items-center gap-1.5">
                <Coins size={12} className="text-amber-400" />
                <span className={`font-bold text-sm ${canAfford ? 'text-amber-300' : 'text-red-400'}`}>
                  {profile?.goldBalance.toFixed(0) ?? 0}G
                </span>
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-xs text-center bg-red-500/10 rounded-xl px-3 py-2">{error}</div>
            )}

            {!canAfford && (
              <div className="text-white/30 text-xs text-center">
                Need {(cost - (profile?.goldBalance ?? 0)).toFixed(0)}G more to unlock
              </div>
            )}

            <button
              onClick={handleBuy}
              disabled={!canAfford || buying}
              className={[
                'w-full py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95',
                canAfford && !buying
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black'
                  : 'bg-white/10 text-white/30 cursor-not-allowed',
              ].join(' ')}
            >
              {buying ? (
                <span className="animate-pulse">Unlocking...</span>
              ) : (
                <>
                  <LockOpen size={18} />
                  <span>Unlock for {cost}G</span>
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
