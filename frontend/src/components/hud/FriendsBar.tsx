import { Users, Wheat } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { eventBus } from '@/game/EventBus';
import { api } from '@/api/client';
import { soundManager } from '@/sounds/SoundManager';

export function FriendsBar() {
  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: api.getFriends,
    staleTime: 30_000,
  });

  const stealable = friends.filter((f) => f.isStealable).length;
  const hasRipe   = friends.some((f) => f.hasRipeCrops);

  const handleNeighborsClick = () => {
    try {
      (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    } catch {}
    soundManager.play('click');
    eventBus.emit('show-friends');
  };

  return (
    <div
      className="fixed z-40 pointer-events-none"
      style={{
        bottom: 'calc(max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px))) + 158px)',
        left: 0,
        right: 0,
      }}
    >
      <div className="flex items-center gap-2 px-3 overflow-x-auto scrollbar-none pointer-events-auto pb-1 max-w-[430px] mx-auto">
        {/* Neighbors button */}
        <button
          onClick={handleNeighborsClick}
          className={[
            'relative flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all active:scale-95 shadow-md',
            stealable > 0
              ? 'bg-gradient-to-r from-red-600/30 to-rose-600/20 border border-red-400/50 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.35)]'
              : 'bg-zinc-950/75 backdrop-blur-xl border border-white/15 text-white/85 hover:text-white hover:border-white/30',
          ].join(' ')}
        >
          <Users size={13} className={stealable > 0 ? 'text-red-300' : 'text-indigo-300'} />
          <span className="text-[10px] font-extrabold tracking-wide">
            {friends.length === 0 ? 'Invite Neighbors' : 'Neighbors'}
          </span>

          {stealable > 0 && (
            <span className="ml-0.5 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow animate-pulse">
              {stealable}🦝
            </span>
          )}
          {!stealable && hasRipe && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse" />
          )}
          {friends.length === 0 && (
            <span className="ml-0.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[8px] font-black px-1 py-0.2 rounded-full">
              +120G
            </span>
          )}
        </button>

        {/* Neighbor avatars — stealable first */}
        {[...friends].sort((a, b) => (b.isStealable ? 1 : 0) - (a.isStealable ? 1 : 0)).map((f) => (
          <NeighborAvatar
            key={f.userId}
            userId={f.userId}
            username={f.username}
            hasRipeCrops={f.hasRipeCrops}
            isStealable={f.isStealable}
          />
        ))}
      </div>
    </div>
  );
}

function NeighborAvatar({ userId, username, hasRipeCrops, isStealable }: {
  userId: string; username: string; hasRipeCrops: boolean; isStealable: boolean;
}) {
  const initial = (username ?? '?')[0].toUpperCase();

  const handleAvatarClick = () => {
    try {
      (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    } catch {}
    soundManager.play('click');
    eventBus.emit('visit-farm', { userId, username });
  };

  return (
    <button
      onClick={handleAvatarClick}
      className="relative flex-shrink-0 w-10 h-10 active:scale-90 transition-all"
      title={`Visit @${username}`}
    >
      <div className={[
        'w-full h-full rounded-full flex items-center justify-center text-white font-extrabold text-xs shadow-md select-none',
        isStealable
          ? 'bg-gradient-to-br from-red-500 to-rose-700 border-2 border-red-400/80 shadow-[0_0_10px_rgba(239,68,68,0.55)]'
          : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/20 text-white/90',
      ].join(' ')}>
        {initial}
      </div>
      {isStealable && (
        <div className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center animate-bounce shadow-md">
          <span className="text-[9px]">🦝</span>
        </div>
      )}
      {!isStealable && hasRipeCrops && (
        <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full w-4 h-4 flex items-center justify-center shadow-md">
          <Wheat size={9} className="text-black" />
        </div>
      )}
    </button>
  );
}
