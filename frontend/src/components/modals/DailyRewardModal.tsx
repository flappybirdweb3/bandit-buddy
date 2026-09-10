import { useState, useEffect } from 'react';
import { X, Coins, Zap, Flame, CheckCircle, Clock } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { DailyClaimResult } from '@/types/game.types';

interface Props {
  currentStreak: number;
  canClaim: boolean;
  nextClaimAt: string | null;
  onClose: () => void;
}

// Must match backend: user.service.ts DAILY_REWARDS
const REWARDS = [120, 200, 300, 450, 650, 950, 1500];

function useCountdown(targetIso: string | null) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!targetIso) { setDisplay(''); return; }

    const tick = () => {
      const ms = new Date(targetIso).getTime() - Date.now();
      if (ms <= 0) { setDisplay('Ready!'); return; }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setDisplay(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [targetIso]);

  return display;
}

export function DailyRewardModal({ currentStreak, canClaim, nextClaimAt, onClose }: Props) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<DailyClaimResult | null>(null);
  const countdown = useCountdown(canClaim ? null : nextClaimAt);

  const { mutate: claim, isPending } = useMutation({
    mutationFn: api.claimDaily,
    onSuccess: (data) => {
      setResult(data);
      eventBus.emit('play-sound', 'daily');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  // cycleDay is which slot in the 7-day cycle we're on (0-based)
  // currentStreak is the streak BEFORE today's claim
  const cycleDay = currentStreak % 7; // 0-based slot about to be claimed
  const nextDayNum = cycleDay + 1;    // 1-based for display

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={result ? onClose : undefined}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-orange-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Daily Reward</h2>
              <p className="text-white/40 text-xs">
                {currentStreak > 0 ? `🔥 ${currentStreak}-day streak!` : 'Claim every day to build streak'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* 7-day cycle grid */}
        <div className="grid grid-cols-7 gap-1.5 mb-5">
          {REWARDS.map((gold, i) => {
            // For streak display: completed slots are those already done in the current cycle
            const completedInCycle = currentStreak % 7;
            const isDone = canClaim ? i < completedInCycle : i <= completedInCycle - 1 + (result ? 1 : 0);
            const isNext = canClaim && i === completedInCycle;
            const isClaimed = !canClaim && i === completedInCycle - 1 + (result ? 1 : 0);
            const isMax = i === 6;

            return (
              <div
                key={i}
                className={[
                  'flex flex-col items-center rounded-xl py-2 px-1 text-center transition-all',
                  isDone || isClaimed ? 'bg-green-500/20 border border-green-500/40' :
                  isNext ? (isMax ? 'glass-gold border border-amber-400/60 scale-105' : 'glass-purple border border-violet-500/60 scale-105') :
                  'bg-white/5',
                ].join(' ')}
              >
                <div className="text-[9px] text-white/40 font-semibold mb-1">D{i + 1}</div>
                {isDone || isClaimed
                  ? <CheckCircle size={14} className="text-green-400 my-0.5" />
                  : <span className={`text-base leading-none ${isMax ? 'text-amber-300' : isNext ? 'text-violet-300' : 'text-white/30'}`}>
                      {isMax ? '👑' : '🪙'}
                    </span>
                }
                <div className={`text-[10px] font-black mt-1 ${
                  isDone || isClaimed ? 'text-green-400' : isNext ? (isMax ? 'text-amber-300' : 'text-violet-300') : 'text-white/30'
                }`}>
                  {gold >= 1000 ? `${gold / 1000}k` : `${gold}G`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Result panel (after successful claim) */}
        {result ? (
          <div className="glass-gold rounded-2xl p-5 mb-4 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-amber-300 font-black text-2xl mb-1">+{result.goldReward}G</div>
            <div className="text-white/60 text-sm mb-3">Day {result.streak} reward claimed!</div>
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-amber-300">
                <Coins size={14} /> +{result.goldReward} GOLD
              </div>
              <div className="flex items-center gap-1.5 text-green-300">
                <Zap size={14} /> +{result.energyRestore} Energy
              </div>
            </div>
            {result.isMaxStreak && (
              <div className="mt-3 text-amber-400 text-xs font-bold">
                👑 Cycle complete! Full energy restored.
              </div>
            )}
            {!result.isMaxStreak && (
              <div className="mt-3 text-white/40 text-xs">
                Tomorrow: <span className="text-violet-300 font-bold">+{result.nextStreakReward}G</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-4 w-full glass py-3 rounded-2xl text-white font-bold text-sm active:scale-95 transition-all"
            >
              Awesome!
            </button>
          </div>
        ) : canClaim ? (
          <>
            {/* Next reward preview */}
            <div className="glass rounded-2xl p-4 mb-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-2xl">
                {nextDayNum === 7 ? '👑' : '🪙'}
              </div>
              <div className="flex-1">
                <div className="text-white/40 text-[10px] mb-1">TODAY'S REWARD (Day {nextDayNum} of 7)</div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-amber-300 font-black text-lg">
                    <Coins size={16} /> {REWARDS[cycleDay]}G
                  </span>
                  <span className="flex items-center gap-1 text-green-300 font-bold text-sm">
                    <Zap size={13} /> +{cycleDay === 6 ? 100 : 50} Energy
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => claim()}
              disabled={isPending}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 py-4 rounded-2xl text-white font-black text-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Flame size={16} />
              {isPending ? 'Claiming…' : 'Claim Daily Reward'}
            </button>
          </>
        ) : (
          /* Already claimed today — show countdown */
          <div className="glass rounded-2xl p-5 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <div>
              <p className="text-white font-black text-base">Already claimed today!</p>
              <p className="text-white/40 text-sm mt-1">Keep your streak alive — come back in:</p>
            </div>
            <div className="glass-gold rounded-2xl px-6 py-3 flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              <span className="text-amber-300 font-black text-xl">{countdown || '…'}</span>
            </div>
            <p className="text-white/25 text-xs">
              Next: <span className="text-violet-300 font-bold">+{REWARDS[nextDayNum % 7]}G</span> (Day {nextDayNum % 7 + 1} of 7)
            </p>
            <button
              onClick={onClose}
              className="w-full glass py-3 rounded-2xl text-white/60 font-bold text-sm active:scale-95 transition-all"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
