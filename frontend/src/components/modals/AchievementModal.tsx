import { useState } from 'react';
import { X, Trophy, Sparkles, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { soundManager } from '@/sounds/SoundManager';
import type { Achievement, AchievementCategory } from '@/types/game.types';

interface Props { onClose: () => void }

type TabFilter = 'all' | AchievementCategory;

const CAT_LABEL: Record<AchievementCategory, string> = {
  farmer: '🌾 Farmer',
  raider: '🥷 Raider',
  streak: '🔥 Streak',
  social: '👥 Social',
};

const CAT_ORDER: AchievementCategory[] = ['farmer', 'raider', 'streak', 'social'];

function triggerSelection() {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  } catch {}
}

function triggerLight() {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
  } catch {}
}

function AchievementCard({ a }: { a: Achievement }) {
  const isDone = a.unlocked;
  return (
    <div
      className={`rounded-2xl p-3.5 flex items-center gap-3 border transition-all ${
        isDone
          ? 'bg-amber-500/12 border-amber-400/35 shadow-[0_0_12px_rgba(251,191,36,0.12)]'
          : 'bg-white/5 border-white/10 opacity-75'
      }`}
    >
      {/* Icon */}
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
          isDone ? 'bg-amber-400/20 ring-1 ring-amber-400/40' : 'bg-white/10 grayscale opacity-40'
        }`}
      >
        {a.emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={`text-sm font-black leading-tight flex items-center gap-1.5 ${isDone ? 'text-amber-300' : 'text-white/70'}`}>
            {a.name}
            {isDone && (
              <span className="bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full leading-none">
                ✓
              </span>
            )}
          </p>
          <span className={`text-[11px] font-black flex-shrink-0 ${isDone ? 'text-amber-400' : 'text-white/40'}`}>
            {a.progress}/{a.target}
          </span>
        </div>
        <p className="text-white/40 text-[11px] mb-2 leading-snug">{a.description}</p>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isDone ? 'bg-gradient-to-r from-amber-400 to-yellow-300' : 'bg-violet-500'
            }`}
            style={{ width: `${Math.min(100, a.pct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function AchievementModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  const handleClose = () => {
    soundManager.play('click');
    triggerLight();
    onClose();
  };

  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: api.getAchievements,
    staleTime: 60_000,
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const filteredAchievements = achievements.filter((a) => {
    if (activeTab === 'all') return true;
    return a.category === activeTab;
  });

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col justify-end"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-zinc-950/95 border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden mx-auto slide-up p-5"
        style={{
          maxHeight: 'min(90vh, 780px)',
          paddingBottom: 'max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-amber-400">
              <Trophy size={16} />
            </div>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Achievements</h2>
              <p className="text-white/40 text-xs">
                {unlockedCount}/{achievements.length} badges unlocked
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Progress ring summary */}
        {!isLoading && achievements.length > 0 && (
          <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-4 mb-3 flex-shrink-0">
            {/* Mini progress bar */}
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-white/50 text-[10px] font-bold">Badge Mastery</span>
                <span className="text-amber-300 text-[10px] font-black">
                  {Math.round((unlockedCount / achievements.length) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700"
                  style={{ width: `${Math.round((unlockedCount / achievements.length) * 100)}%` }}
                />
              </div>
            </div>
            {/* Badge count */}
            <div className="text-center flex-shrink-0">
              <p className="text-amber-300 font-black text-xl leading-none">{unlockedCount}</p>
              <p className="text-white/40 text-[9px] mt-0.5 font-semibold">badges</p>
            </div>
          </div>
        )}

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2 mb-2 flex-shrink-0">
          <button
            onClick={() => {
              triggerSelection();
              soundManager.play('click');
              setActiveTab('all');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm'
                : 'glass text-white/40 hover:text-white/70'
            }`}
          >
            All ({achievements.length})
          </button>
          {CAT_ORDER.map((cat) => {
            const count = achievements.filter((a) => a.category === cat).length;
            const done = achievements.filter((a) => a.category === cat && a.unlocked).length;
            return (
              <button
                key={cat}
                onClick={() => {
                  triggerSelection();
                  soundManager.play('click');
                  setActiveTab(cat);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeTab === cat
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm'
                    : 'glass text-white/40 hover:text-white/70'
                }`}
              >
                {CAT_LABEL[cat]}
                <span className="text-[10px] opacity-60">({done}/{count})</span>
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 flex flex-col gap-2.5 pr-0.5">
          {isLoading && (
            <div className="text-center py-12 text-white/40 text-sm">Loading badges…</div>
          )}

          {!isLoading && filteredAchievements.length === 0 && (
            <div className="text-center py-12 text-white/40 text-sm">No badges in this category.</div>
          )}

          {!isLoading && filteredAchievements.map((a) => (
            <AchievementCard key={a.id} a={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
