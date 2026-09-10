import { useState } from 'react';
import { X, Trophy, Crown, Coins, Flame, Sword, Wheat } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { LeaderboardEntry } from '@/types/game.types';

interface Props { onClose: () => void }

type Category = 'thieves' | 'rich' | 'streak' | 'farmer';

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode; color: string; metricLabel: string; emoji: string }[] = [
  { id: 'thieves', label: 'Raiders',  icon: <Sword size={13} />,  color: 'text-red-300',    metricLabel: 'Gold Stolen',  emoji: '🥷' },
  { id: 'rich',    label: 'Richest',  icon: <Coins size={13} />,  color: 'text-amber-300',  metricLabel: 'Gold Balance', emoji: '💰' },
  { id: 'streak',  label: 'Streaks',  icon: <Flame size={13} />,  color: 'text-orange-300', metricLabel: 'Day Streak',   emoji: '🔥' },
  { id: 'farmer',  label: 'Farmers',  icon: <Wheat size={13} />,  color: 'text-green-300',  metricLabel: 'Harvests',     emoji: '🌾' },
];

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function fmtGold(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function getMetric(entry: LeaderboardEntry, cat: Category) {
  if (cat === 'thieves') return fmtGold(entry.goldStolen);
  if (cat === 'rich')    return fmtGold(entry.goldBalance);
  if (cat === 'farmer')  return `${entry.totalHarvests ?? 0}`;
  return `${entry.dailyStreak}d`;
}

export function LeaderboardModal({ onClose }: Props) {
  const [cat, setCat] = useState<Category>('thieves');

  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard', cat],
    queryFn: () => api.getLeaderboard(cat),
    staleTime: 30_000,
  });

  const catMeta = CATEGORIES.find((c) => c.id === cat)!;
  const top3 = data?.entries.slice(0, 3) ?? [];
  const rest = data?.entries.slice(3) ?? [];

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
            <Crown size={18} className="text-amber-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Leaderboard</h2>
              <p className="text-white/40 text-xs mt-0.5">{catMeta.emoji} {catMeta.metricLabel} rankings</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex-shrink-0 px-5 mb-4">
          <div className="glass rounded-2xl flex p-1 gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
                  cat === c.id ? 'bg-white/15 text-white' : 'text-white/40',
                ].join(' ')}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 pb-6">
          {/* Podium */}
          {!isLoading && !error && top3.length >= 3 && (
            <div className="flex items-end justify-center gap-2 px-6 pb-5">
              <PodiumCard entry={top3[1]} cat={cat} height={72} />
              <PodiumCard entry={top3[0]} cat={cat} height={96} highlight />
              <PodiumCard entry={top3[2]} cat={cat} height={60} />
            </div>
          )}

          {/* Loading / error */}
          {isLoading && (
            <div className="text-center py-10 text-white/40 text-sm">Loading rankings…</div>
          )}
          {error && (
            <div className="text-center py-10 text-red-400 text-sm">Failed to load leaderboard</div>
          )}

          {/* Rest of list (rank 4+) */}
          {!isLoading && !error && data && (
            <div className="flex flex-col">
              {rest.map((entry, i) => (
                <RankRow key={entry.userId} entry={entry} cat={cat} divider={i === 0 && top3.length >= 3} />
              ))}

              {/* My rank pinned at bottom if not in top */}
              {data.myEntry && !data.entries.some((e) => e.isMe) && (
                <>
                  <div className="mx-5 my-2 border-t border-white/10" />
                  <div className="mx-4">
                    <RankRow entry={data.myEntry} cat={cat} pinned />
                  </div>
                </>
              )}

              {data.entries.length === 0 && (
                <div className="text-center py-12">
                  <Trophy size={40} className="text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">No players yet. Be the first!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Podium card (top 3) ─────────────────────────────────────────
function PodiumCard({ entry, cat, height, highlight }: {
  entry: LeaderboardEntry; cat: Category; height: number; highlight?: boolean;
}) {
  const medal = MEDAL[entry.rank]!;
  const metric = getMetric(entry, cat);

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      {highlight && <Crown size={16} className="text-amber-400 mb-0.5" />}
      <span className="text-xl leading-none">{medal}</span>
      <div className={[
        'w-11 h-11 rounded-full flex items-center justify-center text-sm font-black border-2',
        highlight
          ? 'bg-gradient-to-br from-amber-400 to-yellow-600 border-amber-300/60 text-black shadow-[0_0_16px_rgba(251,191,36,0.5)]'
          : entry.isMe
            ? 'bg-gradient-to-br from-violet-500 to-purple-700 border-violet-400/40 text-white'
            : 'bg-gradient-to-br from-slate-600 to-slate-800 border-white/20 text-white',
      ].join(' ')}>
        {(entry.username ?? '?')[0].toUpperCase()}
      </div>
      <p className={`text-[10px] font-bold truncate w-full text-center px-1 ${highlight ? 'text-amber-300' : 'text-white/70'}`}>
        @{entry.username?.split('_')[0] ?? '—'}
      </p>
      {/* Platform */}
      <div
        className={`w-full rounded-t-xl flex flex-col items-center justify-end pb-2 pt-3 ${highlight ? 'glass-gold' : 'glass'}`}
        style={{ height }}
      >
        <p className="text-amber-300 font-black text-sm">{metric}</p>
        <p className="text-white/30 text-[9px] mt-0.5">{CATEGORIES.find(c => c.id === cat)?.metricLabel}</p>
      </div>
    </div>
  );
}

// ─── Rank row (4th place and below) ─────────────────────────────
function RankRow({ entry, cat, divider, pinned }: {
  entry: LeaderboardEntry; cat: Category; divider?: boolean; pinned?: boolean;
}) {
  const medal = MEDAL[entry.rank];
  const metric = getMetric(entry, cat);
  const catMeta = CATEGORIES.find((c) => c.id === cat)!;

  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-2.5',
        entry.isMe || pinned ? 'mx-2 my-1 rounded-2xl border border-violet-500/30 bg-violet-500/10' : '',
        divider ? 'mt-2' : '',
      ].join(' ')}
    >
      {/* Rank number */}
      <div className="w-8 text-center flex-shrink-0">
        {medal
          ? <span className="text-base">{medal}</span>
          : <span className="text-white/35 text-xs font-bold">#{entry.rank}</span>
        }
      </div>

      {/* Avatar */}
      <div className={[
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
        entry.isMe
          ? 'bg-gradient-to-br from-violet-500 to-purple-700 text-white'
          : 'bg-gradient-to-br from-slate-600 to-slate-800 text-white/80',
      ].join(' ')}>
        {(entry.username ?? '?')[0].toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${entry.isMe ? 'text-violet-300' : 'text-white'}`}>
          @{entry.username ?? 'Unknown'}
          {(entry.isMe || pinned) && <span className="ml-1.5 text-[10px] text-violet-400 font-normal">(you)</span>}
        </p>
        <p className="text-[10px] text-white/25">trust {entry.trustScore}</p>
      </div>

      {/* Metric */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-sm">{catMeta.emoji}</span>
        <span className={`font-black text-sm ${catMeta.color}`}>{metric}</span>
      </div>
    </div>
  );
}
