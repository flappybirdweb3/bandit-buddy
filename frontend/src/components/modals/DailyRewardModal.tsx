import { useState } from 'react';
import { X, Coins, Zap, Flame, CheckCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { DailyClaimResult } from '@/types/game.types';

interface Props {
  currentStreak: number;
  onClose: () => void;
}

const REWARDS = [50, 75, 100, 150, 200, 300, 500];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DailyRewardModal({ currentStreak, onClose }: Props) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<DailyClaimResult | null>(null);

  const { mutate: claim, isPending } = useMutation({
    mutationFn: api.claimDaily,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const nextDay = (currentStreak % 7) + 1; // 1-indexed day about to be claimed

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

        {/* 7-day grid */}
        <div className="grid grid-cols-7 gap-1.5 mb-5">
          {REWARDS.map((gold, i) => {
            const dayNum = i + 1;
            const isDone = dayNum <= currentStreak;
            const isNext = dayNum === nextDay;
            const isMax = dayNum === 7;

            return (
              <div
                key={i}
                className={[
                  'flex flex-col items-center rounded-xl py-2 px-1 text-center transition-all',
                  isDone ? 'bg-green-500/20 border border-green-500/40' :
                  isNext ? (isMax ? 'glass-gold border border-amber-400/60 scale-105' : 'glass-purple border border-violet-500/60 scale-105') :
                  'bg-white/5',
                ].join(' ')}
              >
                <div className="text-[9px] text-white/40 font-semibold mb-1">{DAY_LABELS[i]}</div>
                {isDone
                  ? <CheckCircle size={14} className="text-green-400 my-0.5" />
                  : <span className={`text-base leading-none ${isMax ? 'text-amber-300' : isNext ? 'text-violet-300' : 'text-white/30'}`}>
                      {isMax ? '👑' : '🪙'}
                    </span>
                }
                <div className={`text-[10px] font-black mt-1 ${
                  isDone ? 'text-green-400' : isNext ? (isMax ? 'text-amber-300' : 'text-violet-300') : 'text-white/30'
                }`}>
                  {gold >= 1000 ? `${gold / 100 / 10}k` : `${gold}G`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Result panel (after claim) */}
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
                👑 Max streak bonus! Come back tomorrow to maintain it.
              </div>
            )}
            {!result.isMaxStreak && (
              <div className="mt-3 text-white/40 text-xs">
                Tomorrow: <span className="text-violet-300 font-bold">{result.nextStreakReward}G</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-4 w-full glass py-3 rounded-2xl text-white font-bold text-sm active:scale-95 transition-all"
            >
              Awesome!
            </button>
          </div>
        ) : (
          <>
            {/* Next reward preview */}
            <div className="glass rounded-2xl p-4 mb-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-2xl">
                {nextDay === 7 ? '👑' : '🪙'}
              </div>
              <div className="flex-1">
                <div className="text-white/40 text-[10px] mb-1">TODAY'S REWARD (Day {nextDay})</div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-amber-300 font-black text-lg">
                    <Coins size={16} /> {REWARDS[nextDay - 1]}G
                  </span>
                  <span className="flex items-center gap-1 text-green-300 font-bold text-sm">
                    <Zap size={13} /> +{nextDay === 7 ? 100 : 50} Energy
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
        )}
      </div>
    </div>
  );
}
