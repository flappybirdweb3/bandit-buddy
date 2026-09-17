import { useState, useEffect } from 'react';
import { X, Coins, Zap, Flame, CheckCircle, Clock, Info } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { DailyClaimResult } from '@/types/game.types';

interface Props {
  currentStreak: number;
  canClaim: boolean;
  nextClaimAt: string | null;
  currentEnergy?: number;
  maxEnergy?: number;
  onClose: () => void;
}

// Must match backend: user.service.ts DAILY_REWARDS
const REWARDS = [120, 200, 300, 450, 650, 950, 1500];

function useCountdown(targetIso: string | null, onExpire?: () => void) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!targetIso) { setDisplay(''); return; }

    const tick = () => {
      const ms = new Date(targetIso).getTime() - Date.now();
      if (ms <= 0) {
        setDisplay('Ready!');
        onExpire?.();
        return;
      }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      if (h > 0) {
        setDisplay(`${h}h ${m}m`);
      } else if (m > 0) {
        setDisplay(`${m}m ${s}s`);
      } else {
        setDisplay(`${s}s`);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso, onExpire]);

  return display;
}

export function DailyRewardModal({
  currentStreak,
  canClaim,
  nextClaimAt,
  currentEnergy = 100,
  maxEnergy = 100,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<DailyClaimResult | null>(null);

  const countdown = useCountdown(
    canClaim ? null : nextClaimAt,
    () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  );

  const { mutate: claim, isPending } = useMutation({
    mutationFn: api.claimDaily,
    onSuccess: (data) => {
      setResult(data);
      eventBus.emit('play-sound', 'daily');
      try {
        (window as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
      } catch {}
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['myFarm'] });
      queryClient.invalidateQueries({ queryKey: ['dailyQuests'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });

  // Slot in the 7-day cycle currently available or next in line (0 to 6)
  const cycleDay = currentStreak % 7;
  const nextDayNum = cycleDay + 1;

  // Number of completed days shown in current 7-day cycle:
  // When canClaim is true: currentStreak represents days already claimed in this cycle (0 to 6)
  // When canClaim is false: currentStreak is post-claim. If multiple of 7, cycle is fully complete (7/7 days)
  const completedInCycle = canClaim
    ? (currentStreak % 7)
    : (((currentStreak - 1) % 7) + 1);

  const energyGain = cycleDay === 6 ? maxEnergy : 50;
  const willOverflow = currentEnergy + energyGain > maxEnergy;
  const effectiveGain = Math.max(0, maxEnergy - currentEnergy);

  const nextCycleReward = REWARDS[completedInCycle % 7];
  const nextCycleDay = (completedInCycle % 7) + 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-zinc-950/95 border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden mx-auto slide-up p-5"
        style={{
          maxHeight: 'calc(var(--tg-viewport-stable-height, 100vh) - 40px)',
          paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)) + 80px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer drag handle */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-400">
              <Flame size={20} />
            </div>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Daily Reward</h2>
              <p className="text-white/50 text-xs">
                {currentStreak > 0 ? `🔥 ${currentStreak}-day streak active` : 'Claim every day to build your streak'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition-all"
            aria-label="Close daily reward modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* 7-day cycle grid */}
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {REWARDS.map((gold, i) => {
            const isDone = i < completedInCycle;
            const isNext = canClaim && i === cycleDay;
            const isClaimedToday = !canClaim && i === completedInCycle - 1;
            const isMax = i === 6;

            return (
              <div
                key={i}
                className={[
                  'flex flex-col items-center rounded-xl py-2 px-1 text-center transition-all',
                  isDone || isClaimedToday
                    ? 'bg-green-500/20 border border-green-500/40'
                    : isNext
                    ? isMax
                      ? 'bg-amber-500/20 border border-amber-400/70 scale-105 shadow-md shadow-amber-500/20'
                      : 'bg-violet-500/20 border border-violet-500/70 scale-105 shadow-md shadow-violet-500/20'
                    : 'bg-white/5 border border-white/5',
                ].join(' ')}
              >
                <div className="text-[9px] text-white/40 font-semibold mb-1">D{i + 1}</div>
                {isDone || isClaimedToday ? (
                  <CheckCircle size={14} className="text-green-400 my-0.5" />
                ) : (
                  <span
                    className={`text-base leading-none ${
                      isMax ? 'text-amber-300' : isNext ? 'text-violet-300' : 'text-white/30'
                    }`}
                  >
                    {isMax ? '👑' : '🪙'}
                  </span>
                )}
                <div
                  className={`text-[10px] font-black mt-1 ${
                    isDone || isClaimedToday
                      ? 'text-green-400'
                      : isNext
                      ? isMax
                        ? 'text-amber-300'
                        : 'text-violet-300'
                      : 'text-white/30'
                  }`}
                >
                  {gold >= 1000 ? `${gold / 1000}k` : `${gold}G`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Result panel (after successful claim) */}
        {result ? (
          <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-5 mb-3 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-amber-300 font-black text-2xl mb-1">+{result.goldReward}G</div>
            <div className="text-white/70 text-sm mb-3 font-medium">Day {result.streak} reward claimed!</div>
            <div className="flex items-center justify-center gap-4 text-sm font-semibold">
              <div className="flex items-center gap-1.5 text-amber-300">
                <Coins size={14} /> +{result.goldReward} GOLD
              </div>
              <div className="flex items-center gap-1.5 text-green-300">
                <Zap size={14} /> +{result.energyRestore} Energy
              </div>
            </div>
            {result.isMaxStreak && (
              <div className="mt-3 text-amber-400 text-xs font-bold">
                👑 7-day cycle complete! Full energy restored.
              </div>
            )}
            {!result.isMaxStreak && (
              <div className="mt-3 text-white/40 text-xs">
                Tomorrow: <span className="text-violet-300 font-bold">+{result.nextStreakReward}G</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-4 w-full bg-white/10 hover:bg-white/20 border border-white/15 py-3 rounded-2xl text-white font-bold text-sm active:scale-95 transition-all"
            >
              Awesome!
            </button>
          </div>
        ) : canClaim ? (
          <>
            {/* Next reward preview */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 text-2xl ml-1">
                {nextDayNum === 7 ? '👑' : '🪙'}
              </div>
              <div className="flex-1 mr-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white/40 text-[10px] font-bold tracking-wider">
                    TODAY'S REWARD (DAY {nextDayNum} OF 7)
                  </span>
                  <span className="text-white/50 text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-md">
                    ⚡ {currentEnergy}/{maxEnergy}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-amber-300 font-black text-lg">
                    <Coins size={16} /> {REWARDS[cycleDay]}G
                  </span>
                  <span className="flex items-center gap-1 text-green-300 font-bold text-sm">
                    <Zap size={13} /> +{energyGain} Energy
                  </span>
                </div>
                {willOverflow && (
                  <p className="text-amber-400/90 text-[10px] mt-1.5 font-medium leading-tight">
                    ⚠️ Energy cap: +{effectiveGain} effective (at {maxEnergy} max). Spend some energy on crops/steals first to claim full bonus!
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => claim()}
              disabled={isPending}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 py-3.5 rounded-2xl text-white font-black text-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25"
            >
              <Flame size={16} />
              {isPending ? 'Claiming…' : 'Claim Daily Reward'}
            </button>
          </>
        ) : (
          /* Already claimed today — show countdown */
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center flex flex-col items-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <CheckCircle size={24} className="text-green-400" />
            </div>
            <div>
              <p className="text-white font-black text-base">Already claimed today!</p>
              <p className="text-white/40 text-xs mt-0.5">Keep your streak alive — next reward unlocks in:</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl px-5 py-2 flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              <span className="text-amber-300 font-black text-lg font-mono">{countdown || '…'}</span>
            </div>
            <p className="text-white/40 text-xs">
              Next: <span className="text-violet-300 font-bold">+{nextCycleReward}G</span> (Day {nextCycleDay} of 7)
            </p>
            <button
              onClick={onClose}
              className="w-full bg-white/10 hover:bg-white/15 border border-white/10 py-2.5 rounded-2xl text-white/70 hover:text-white font-bold text-sm active:scale-95 transition-all mt-1"
            >
              Close
            </button>
          </div>
        )}

        {/* Streak rules notice */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-white/30 text-[10px] text-center">
          <Info size={11} className="flex-shrink-0" />
          <span>Claims unlock every 20h. Claim within 48h to preserve your streak!</span>
        </div>
      </div>
    </div>
  );
}
