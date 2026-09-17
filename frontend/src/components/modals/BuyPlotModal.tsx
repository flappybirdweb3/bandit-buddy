import { useState } from 'react';
import { X, LockOpen, Coins, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGame } from '@/providers/GameProvider';
import { api } from '@/api/client';
import { soundManager } from '@/sounds/SoundManager';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') {
  try {
    const haptic = window.Telegram?.WebApp?.HapticFeedback;
    if (!haptic) return;
    if (type === 'success' || type === 'warning' || type === 'error') {
      haptic.notificationOccurred(type);
    } else {
      haptic.impactOccurred(type);
    }
  } catch {
    // Ignore unsupported environments
  }
}

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

  const handleClose = () => {
    soundManager.play('click');
    triggerHaptic('light');
    onClose();
  };

  const handleBuy = async () => {
    if (!canAfford || buying) return;
    setBuying(true);
    setError('');
    triggerHaptic('medium');
    try {
      const res = await api.buyPlot();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['myFarm'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
      ]);
      soundManager.play('upgrade');
      triggerHaptic('success');
      setDone({ plotCount: res.plotCount, nextCost: res.nextCost });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to buy plot');
      soundManager.play('click');
      triggerHaptic('error');
      setBuying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-zinc-950/95 border-t border-white/10 rounded-t-3xl mx-auto p-5 shadow-2xl flex flex-col slide-up"
        style={{
          maxHeight: 'min(90vh, 780px)',
          paddingBottom: 'max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚜</span>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Expand Farm</h2>
              <p className="text-white/40 text-xs">Unlock a brand new soil plot</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="text-5xl animate-bounce">🌱</div>
            <div>
              <div className="text-white font-black text-xl">New Plot Unlocked!</div>
              <div className="text-white/60 text-sm mt-1">
                You now have <span className="text-green-400 font-bold">{done.plotCount} plots</span>
              </div>
            </div>
            {done.nextCost && (
              <div className="bg-zinc-900/80 border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-2 text-white/60 text-xs">
                <span>Next plot cost:</span>
                <Coins size={12} className="text-amber-400" />
                <span className="text-amber-300 font-bold">{done.nextCost}G</span>
              </div>
            )}
            <button
              onClick={handleClose}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-400 text-black font-black text-base active:scale-95 shadow-lg shadow-green-500/20 transition-all"
            >
              Start Farming!
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-1">
            {/* Plot preview */}
            <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-900/30 border border-amber-600/30 flex items-center justify-center text-3xl shrink-0">
                🌾
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm">Fertile Farmland</div>
                <div className="text-white/50 text-xs mt-0.5">Plant more crops and multiply your passive gold earnings</div>
                <div className="flex items-center gap-1.5 mt-2">
                  <Coins size={13} className="text-amber-400" />
                  <span className="text-amber-300 font-black text-base">{cost}G</span>
                </div>
              </div>
            </div>

            {/* Balance comparison */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-xs">Your Current Balance</span>
                <div className="flex items-center gap-1.5">
                  <Coins size={12} className="text-amber-400" />
                  <span className={`font-bold text-sm ${canAfford ? 'text-amber-300' : 'text-red-400'}`}>
                    {profile?.goldBalance.toFixed(0) ?? 0}G
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-xs">Unlock Price</span>
                <div className="flex items-center gap-1.5">
                  <Coins size={12} className="text-amber-400" />
                  <span className="text-amber-300 font-bold text-sm">{cost}G</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            {!canAfford && (
              <div className="text-amber-300/80 text-xs text-center bg-amber-500/10 border border-amber-500/20 rounded-xl py-2">
                Need {(cost - (profile?.goldBalance ?? 0)).toFixed(0)}G more gold to unlock
              </div>
            )}

            <button
              onClick={handleBuy}
              disabled={!canAfford || buying}
              className={[
                'w-full py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg',
                canAfford && !buying
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-amber-500/20'
                  : 'bg-white/10 text-white/30 cursor-not-allowed',
              ].join(' ')}
            >
              {buying ? (
                <span className="animate-pulse">Unlocking Plot...</span>
              ) : (
                <>
                  <LockOpen size={18} className="text-amber-950" />
                  <span>Unlock for {cost}G</span>
                  <ChevronRight size={16} className="text-amber-950" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
