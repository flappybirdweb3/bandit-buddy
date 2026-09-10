import { X, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Achievement, AchievementCategory } from '@/types/game.types';

interface Props { onClose: () => void }

const CAT_LABEL: Record<AchievementCategory, string> = {
  farmer: '🌾 Farmer',
  raider: '🥷 Raider',
  streak: '🔥 Streak',
  social: '👥 Social',
};

const CAT_ORDER: AchievementCategory[] = ['farmer', 'raider', 'streak', 'social'];

function AchievementCard({ a }: { a: Achievement }) {
  const isDone = a.unlocked;
  return (
    <div className={[
      'rounded-2xl p-3.5 flex gap-3 border transition-all',
      isDone
        ? 'bg-amber-500/12 border-amber-400/35 shadow-[0_0_12px_rgba(251,191,36,0.12)]'
        : 'bg-white/4 border-white/8',
    ].join(' ')}>
      {/* Icon */}
      <div className={[
        'w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0',
        isDone ? 'bg-amber-400/20' : 'bg-white/8',
        !isDone && 'grayscale opacity-50',
      ].join(' ')}>
        {a.emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={`text-sm font-black leading-tight ${isDone ? 'text-amber-300' : 'text-white/60'}`}>
            {a.name}
            {isDone && <span className="ml-1.5 text-[10px] font-normal text-amber-400/70">✓</span>}
          </p>
          <span className={`text-[10px] font-bold flex-shrink-0 ${isDone ? 'text-amber-400' : 'text-white/30'}`}>
            {a.progress}/{a.target}
          </span>
        </div>
        <p className="text-white/35 text-[11px] mb-2 leading-snug">{a.description}</p>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isDone ? 'bg-amber-400' : 'bg-violet-500'}`}
            style={{ width: `${a.pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function AchievementModal({ onClose }: Props) {
  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: api.getAchievements,
    staleTime: 60_000,
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const byCategory = (cat: AchievementCategory) =>
    achievements.filter((a) => a.category === cat);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up flex flex-col"
        style={{ maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-amber-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Achievements</h2>
              <p className="text-white/40 text-xs mt-0.5">
                {unlockedCount}/{achievements.length} unlocked
              </p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Progress ring summary */}
        {!isLoading && achievements.length > 0 && (
          <div className="flex-shrink-0 px-5 mb-4">
            <div className="glass rounded-2xl px-4 py-3 flex items-center gap-4">
              {/* Mini progress bar */}
              <div className="flex-1">
                <div className="flex justify-between mb-1.5">
                  <span className="text-white/40 text-[10px]">Overall progress</span>
                  <span className="text-amber-300 text-[10px] font-bold">
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
                <p className="text-white/30 text-[9px] mt-0.5">badges</p>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1 px-5 pb-8 flex flex-col gap-5">
          {isLoading && (
            <div className="text-center py-12 text-white/40 text-sm">Loading…</div>
          )}

          {!isLoading && CAT_ORDER.map((cat) => {
            const items = byCategory(cat);
            if (items.length === 0) return null;
            const catUnlocked = items.filter((a) => a.unlocked).length;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-white/50 text-xs font-bold uppercase tracking-wide">
                    {CAT_LABEL[cat]}
                  </p>
                  <span className="text-white/25 text-[10px]">{catUnlocked}/{items.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((a) => <AchievementCard key={a.id} a={a} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
