import { X, Trophy, Coins, Crown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { LeaderboardEntry } from '@/types/game.types';

interface Props { onClose: () => void }

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function RankRow({ entry, divider }: { entry: LeaderboardEntry; divider?: boolean }) {
  const medal = MEDAL[entry.rank];
  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-3 transition-colors',
        entry.isMe ? 'bg-violet-500/15 border border-violet-500/30 rounded-2xl mx-2 my-1' : '',
        divider ? 'border-t border-white/5 mt-2 pt-4' : '',
      ].join(' ')}
    >
      {/* Rank */}
      <div className="w-8 text-center flex-shrink-0">
        {medal
          ? <span className="text-lg">{medal}</span>
          : <span className="text-white/40 text-sm font-bold">#{entry.rank}</span>
        }
      </div>

      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
        entry.isMe
          ? 'bg-gradient-to-br from-violet-500 to-purple-700 text-white'
          : 'bg-gradient-to-br from-green-500 to-emerald-700 text-white'
      }`}>
        {(entry.username ?? '?')[0].toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold truncate ${entry.isMe ? 'text-violet-300' : 'text-white'}`}>
          {entry.username ?? 'Unknown'}
          {entry.isMe && <span className="ml-1.5 text-[10px] text-violet-400 font-normal">(you)</span>}
        </div>
        <div className="text-[10px] text-white/30">Trust {entry.trustScore}</div>
      </div>

      {/* Gold */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Coins size={12} className="text-amber-400" />
        <span className="text-amber-300 font-bold text-sm">
          {entry.goldBalance >= 1000
            ? `${(entry.goldBalance / 1000).toFixed(1)}k`
            : entry.goldBalance.toFixed(0)}
        </span>
      </div>
    </div>
  );
}

export function LeaderboardModal({ onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: api.getLeaderboard,
    staleTime: 30_000,
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-0 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-amber-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Leaderboard</h2>
              <p className="text-white/40 text-xs">Top GOLD farmers</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Top-3 podium */}
        {data && data.entries.length >= 3 && (
          <div className="flex items-end justify-center gap-3 px-5 pb-4 flex-shrink-0">
            {/* 2nd */}
            <PodiumCard entry={data.entries[1]} height="h-20" />
            {/* 1st */}
            <PodiumCard entry={data.entries[0]} height="h-28" highlight />
            {/* 3rd */}
            <PodiumCard entry={data.entries[2]} height="h-16" />
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1 pb-4">
          {isLoading && (
            <div className="text-center py-12 text-white/40 text-sm">Loading rankings…</div>
          )}
          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load leaderboard</div>
          )}
          {data && (
            <>
              {/* Skip top 3 since shown in podium */}
              {data.entries.slice(3).map((entry) => (
                <RankRow key={entry.userId} entry={entry} />
              ))}

              {/* My rank separator if not in top list */}
              {data.myEntry && (
                <RankRow entry={data.myEntry} divider />
              )}
            </>
          )}
        </div>

        {/* Trophy icon at top 3 */}
        {data?.entries.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Trophy size={40} className="text-white/20 mx-auto mb-3" />
            <div className="text-white/40 text-sm">No players yet. Be the first!</div>
          </div>
        )}
      </div>
    </div>
  );
}

function PodiumCard({ entry, height, highlight }: { entry: LeaderboardEntry; height: string; highlight?: boolean }) {
  const medal = MEDAL[entry.rank]!;
  return (
    <div className={`flex flex-col items-center gap-1 flex-1 ${highlight ? 'order-none' : ''}`}>
      <span className="text-xl">{medal}</span>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
        highlight
          ? 'bg-gradient-to-br from-amber-400 to-yellow-600 border-amber-300 text-black'
          : entry.isMe
            ? 'bg-gradient-to-br from-violet-500 to-purple-700 border-violet-400 text-white'
            : 'bg-gradient-to-br from-green-500 to-emerald-700 border-white/20 text-white'
      }`}>
        {(entry.username ?? '?')[0].toUpperCase()}
      </div>
      <div className={`text-[10px] font-bold truncate max-w-full px-1 ${highlight ? 'text-amber-300' : 'text-white/70'}`}>
        {entry.username?.split('_')[0] ?? 'Unknown'}
      </div>
      <div className={`${height} w-full rounded-t-xl flex flex-col items-center justify-end pb-2 ${
        highlight ? 'glass-gold' : 'glass'
      }`}>
        <Coins size={11} className="text-amber-400" />
        <span className="text-amber-300 font-bold text-xs">
          {entry.goldBalance >= 1000
            ? `${(entry.goldBalance / 1000).toFixed(1)}k`
            : entry.goldBalance.toFixed(0)}
        </span>
      </div>
    </div>
  );
}
