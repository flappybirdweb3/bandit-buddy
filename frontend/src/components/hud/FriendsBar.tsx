import { Sword, Wheat } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { eventBus } from '@/game/EventBus';
import { api } from '@/api/client';

export function FriendsBar() {
  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: api.getFriends,
    staleTime: 30_000,
  });

  const stealable = friends.filter((f) => f.isStealable).length;
  const hasRipe   = friends.some((f) => f.hasRipeCrops);

  return (
    <div className="fixed z-40 pointer-events-none"
      style={{ bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 112px)', left: 0, right: 0 }}
    >
      <div className="flex items-center gap-2 px-3 overflow-x-auto scrollbar-none pointer-events-auto pb-1">
        {/* Neighbors button */}
        <button
          onClick={() => eventBus.emit('show-friends')}
          className={[
            'relative flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all active:scale-95',
            stealable > 0
              ? 'bg-red-500/25 border border-red-400/40 text-red-300'
              : 'glass text-white/70 hover:text-white',
          ].join(' ')}
        >
          <Sword size={13} />
          <span className="text-[10px] font-black tracking-wide">NEIGHBORS</span>
          {stealable > 0 && (
            <span className="ml-0.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
              {stealable}🦝
            </span>
          )}
          {!stealable && hasRipe && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          )}
        </button>

        {/* Neighbor avatars — stealable first */}
        {[...friends].sort((a, b) => (b.isStealable ? 1 : 0) - (a.isStealable ? 1 : 0)).map((f) => (
          <NeighborAvatar key={f.userId} userId={f.userId} username={f.username}
            hasRipeCrops={f.hasRipeCrops} isStealable={f.isStealable} />
        ))}
      </div>
    </div>
  );
}

function NeighborAvatar({ userId, username, hasRipeCrops, isStealable }: {
  userId: string; username: string; hasRipeCrops: boolean; isStealable: boolean;
}) {
  const initial = (username ?? '?')[0].toUpperCase();

  return (
    <button
      onClick={() => eventBus.emit('visit-farm', { userId, username })}
      className="relative flex-shrink-0 w-11 h-11 active:scale-90 transition-all"
    >
      <div className={[
        'w-full h-full rounded-full flex items-center justify-center text-white font-bold text-sm',
        isStealable
          ? 'bg-gradient-to-br from-red-500 to-rose-700 border-2 border-red-400/60 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
          : 'bg-gradient-to-br from-violet-500 to-purple-700 border-2 border-white/20',
      ].join(' ')}>
        {initial}
      </div>
      {isStealable && (
        <div className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center animate-bounce">
          <span className="text-[9px]">🦝</span>
        </div>
      )}
      {!isStealable && hasRipeCrops && (
        <div className="absolute -top-0.5 -right-0.5 bg-amber-400 rounded-full w-4 h-4 flex items-center justify-center">
          <Wheat size={9} className="text-black" />
        </div>
      )}
    </button>
  );
}
