import { useState } from 'react';
import { X, Trophy, Crown, Coins, Flame, Sword, Wheat, Zap, RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { LeaderboardEntry } from '@/types/game.types';

interface Props { onClose: () => void }

type Category = 'thieves' | 'rich' | 'streak' | 'farmer';

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode; color: string; metricLabel: string; emoji: string; desc: string }[] = [
  { id: 'thieves', label: 'Raiders',  icon: <Sword size={13} />,  color: 'text-red-300',    metricLabel: 'Gold Stolen',  emoji: '🥷', desc: 'Top raiders by total gold looted' },
  { id: 'rich',    label: 'Richest',  icon: <Coins size={13} />,  color: 'text-amber-300',  metricLabel: 'Gold Balance', emoji: '💰', desc: 'Highest gold balances in the realm' },
  { id: 'streak',  label: 'Streaks',  icon: <Flame size={13} />,  color: 'text-orange-300', metricLabel: 'Day Streak',   emoji: '🔥', desc: 'Consecutive daily check-in streaks' },
  { id: 'farmer',  label: 'Farmers',  icon: <Wheat size={13} />,  color: 'text-green-300',  metricLabel: 'Harvests',     emoji: '🌾', desc: 'Total crops harvested of all time' },
];

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function fmtGold(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function getMetric(entry: LeaderboardEntry, cat: Category) {
  if (cat === 'thieves') return `${fmtGold(entry.goldStolen)} G`;
  if (cat === 'rich')    return `${fmtGold(entry.goldBalance)} G`;
  if (cat === 'farmer')  return `${(entry.totalHarvests ?? 0).toLocaleString()}`;
  return `${entry.dailyStreak}d`;
}

export function LeaderboardModal({ onClose }: Props) {
  const [cat, setCat] = useState<Category>('thieves');
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['leaderboard', cat],
    queryFn: () => api.getLeaderboard(cat),
    staleTime: 30_000,
  });

  const catMeta = CATEGORIES.find((c) => c.id === cat)!;
  const top3 = data?.entries.slice(0, 3) ?? [];
  const showPodium = !isLoading && !error && top3.length >= 3;
  const rest = showPodium ? (data?.entries.slice(3) ?? []) : (data?.entries ?? []);

  const handleVisit = (userId: string, username: string) => {
    eventBus.emit('visit-farm', { userId, username });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end px-7 py-2" style={{ paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 32px)) + 100px)' }} onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl glass mx-auto rounded-3xl overflow-hidden slide-up flex flex-col"
        style={{ maxHeight: 'calc(var(--tg-viewport-stable-height, 100vh) - 120px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
              <Crown size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-black text-base leading-none">Global Rankings</h2>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  title="Refresh rankings"
                  className="text-white/30 hover:text-white/70 active:rotate-180 transition-all disabled:opacity-40"
                >
                  <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
                </button>
              </div>
              <p className="text-white/40 text-xs mt-0.5">{catMeta.emoji} {catMeta.desc}</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex-shrink-0 px-5 mb-3 mt-1">
          <div className="glass rounded-2xl flex p-1 gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
                  cat === c.id ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/70',
                ].join(' ')}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 pb-6">
          {/* Podium */}
          {showPodium && (
            <div className="flex items-end justify-center gap-2 px-6 pb-4 pt-1">
              <PodiumCard entry={top3[1]} cat={cat} height={76} onVisit={handleVisit} />
              <PodiumCard entry={top3[0]} cat={cat} height={100} highlight onVisit={handleVisit} />
              <PodiumCard entry={top3[2]} cat={cat} height={64} onVisit={handleVisit} />
            </div>
          )}

          {/* Loading / error */}
          {isLoading && (
            <div className="text-center py-10 text-white/40 text-sm animate-pulse">Loading global rankings…</div>
          )}
          {error && (
            <div className="text-center py-10 text-red-400 text-sm">Failed to load leaderboard. Please try again.</div>
          )}

          {/* List of ranks */}
          {!isLoading && !error && data && (
            <div className="flex flex-col">
              {rest.map((entry, i) => (
                <RankRow
                  key={entry.userId}
                  entry={entry}
                  cat={cat}
                  divider={i === 0 && showPodium}
                  onVisit={handleVisit}
                />
              ))}

              {/* My rank pinned at bottom if not in top */}
              {data.myEntry && !data.entries.some((e) => e.isMe) && (
                <>
                  <div className="mx-5 my-2 border-t border-white/10" />
                  <div className="mx-4">
                    <RankRow entry={data.myEntry} cat={cat} pinned onVisit={handleVisit} />
                  </div>
                </>
              )}

              {data.entries.length === 0 && (
                <div className="text-center py-12">
                  <Trophy size={40} className="text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">No players ranked yet. Be the first!</p>
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
function PodiumCard({ entry, cat, height, highlight, onVisit }: {
  entry: LeaderboardEntry;
  cat: Category;
  height: number;
  highlight?: boolean;
  onVisit?: (userId: string, username: string) => void;
}) {
  const medal = MEDAL[entry.rank]!;
  const metric = getMetric(entry, cat);
  const catMeta = CATEGORIES.find((c) => c.id === cat)!;

  return (
    <div
      onClick={() => !entry.isMe && onVisit?.(entry.userId, entry.username)}
      className={`flex flex-col items-center gap-1 flex-1 ${!entry.isMe ? 'cursor-pointer group active:scale-95 transition-transform' : ''}`}
      title={entry.isMe ? 'Your rank' : `Visit @${entry.username}'s farm`}
    >
      {highlight && <Crown size={16} className="text-amber-400 mb-0.5 animate-bounce" />}
      <span className="text-xl leading-none">{medal}</span>
      <div className={[
        'w-11 h-11 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all',
        highlight
          ? 'bg-gradient-to-br from-amber-400 to-yellow-600 border-amber-300/60 text-black shadow-[0_0_16px_rgba(251,191,36,0.5)]'
          : entry.isMe
            ? 'bg-gradient-to-br from-violet-500 to-purple-700 border-violet-400/40 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]'
            : 'bg-gradient-to-br from-slate-600 to-slate-800 border-white/20 text-white group-hover:border-amber-400/50',
      ].join(' ')}>
        {(entry.username ?? '?')[0].toUpperCase()}
      </div>
      <div className="w-full text-center px-1">
        <p className={`text-[11px] font-bold truncate ${highlight ? 'text-amber-300' : 'text-white/80'}`}>
          @{entry.username ?? '—'}
        </p>
        {entry.isMe && <span className="text-[9px] text-violet-300 font-bold leading-none">(You)</span>}
      </div>
      {/* Platform */}
      <div
        className={`w-full rounded-t-2xl flex flex-col items-center justify-end pb-2.5 pt-3 transition-colors ${
          highlight ? 'glass-gold' : 'glass group-hover:bg-white/10'
        }`}
        style={{ height }}
      >
        <p className="text-amber-300 font-black text-xs leading-none">{metric}</p>
        <p className="text-white/35 text-[9px] mt-1">{catMeta.metricLabel}</p>
        {!entry.isMe && (
          <span className="text-[8px] text-white/30 group-hover:text-amber-300/80 flex items-center gap-0.5 mt-0.5">
            <Zap size={8} /> Visit
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Rank row (4th place and below) ─────────────────────────────
function RankRow({ entry, cat, divider, pinned, onVisit }: {
  entry: LeaderboardEntry;
  cat: Category;
  divider?: boolean;
  pinned?: boolean;
  onVisit?: (userId: string, username: string) => void;
}) {
  const medal = MEDAL[entry.rank];
  const metric = getMetric(entry, cat);
  const catMeta = CATEGORIES.find((c) => c.id === cat)!;

  return (
    <div
      onClick={() => !entry.isMe && onVisit?.(entry.userId, entry.username)}
      className={[
        'flex items-center gap-3 px-4 py-2.5 transition-colors',
        entry.isMe || pinned
          ? 'mx-2 my-1 rounded-2xl border border-violet-500/30 bg-violet-500/10'
          : 'hover:bg-white/5 cursor-pointer active:scale-[0.99]',
        divider ? 'mt-2 border-t border-white/5 pt-3' : '',
      ].join(' ')}
      title={entry.isMe ? 'Your rank' : `Click to visit @${entry.username}'s farm`}
    >
      {/* Rank number */}
      <div className="w-8 text-center flex-shrink-0" style={{ marginLeft: '10px' }}>
        {medal
          ? <span className="text-base">{medal}</span>
          : <span className="text-white/40 text-xs font-bold">#{entry.rank}</span>
        }
      </div>

      {/* Avatar */}
      <div className={[
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
        entry.isMe
          ? 'bg-gradient-to-br from-violet-500 to-purple-700 text-white ring-1 ring-violet-400/40'
          : 'bg-gradient-to-br from-slate-600 to-slate-800 text-white/80',
      ].join(' ')}>
        {(entry.username ?? '?')[0].toUpperCase()}
      </div>

      {/* Name & trust */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm font-bold truncate ${entry.isMe ? 'text-violet-300' : 'text-white'}`}>
            @{entry.username ?? 'Unknown'}
          </p>
          {(entry.isMe || pinned) && (
            <span className="text-[10px] text-violet-300 font-bold bg-violet-500/20 px-1.5 py-0.2 rounded-md leading-tight">
              you
            </span>
          )}
        </div>
        <p className="text-[10px] text-white/30 mt-0.5">trust {entry.trustScore}</p>
      </div>

      {/* Metric & Visit Button */}
      <div className="flex items-center gap-2 flex-shrink-0" style={{ marginRight: '10px' }}>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1">
            <span className="text-xs">{catMeta.emoji}</span>
            <span className={`font-black text-sm ${catMeta.color}`}>{metric}</span>
          </div>
        </div>
        {!entry.isMe && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVisit?.(entry.userId, entry.username);
            }}
            className="glass hover:glass-gold text-white/50 hover:text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 active:scale-90 transition-all"
            title={`Visit @${entry.username}'s farm`}
          >
            <Zap size={10} className="text-amber-400" /> Visit
          </button>
        )}
      </div>
    </div>
  );
}
