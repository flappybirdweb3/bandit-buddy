import { Wheat, UserPlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { eventBus } from '@/game/EventBus';
import { api } from '@/api/client';

export function FriendsBar() {
  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: api.getFriends,
    staleTime: 30_000,
  });

  return (
    <div className="fixed z-40 pointer-events-none"
      style={{ bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 112px)', left: 0, right: 0 }}
    >
      <div className="flex items-center gap-2 px-3 overflow-x-auto scrollbar-none pointer-events-auto pb-1">
        {friends.length > 0 && (
          <span className="text-white/40 text-[10px] font-semibold whitespace-nowrap flex-shrink-0">
            FRIENDS
          </span>
        )}

        {friends.map((f) => (
          <FriendAvatar key={f.userId} userId={f.userId} username={f.username} hasRipeCrops={f.hasRipeCrops} />
        ))}

        <button
          onClick={() => eventBus.emit('show-friends', undefined)}
          className="glass flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white/40 hover:text-white active:scale-90 transition-all"
        >
          <UserPlus size={16} />
        </button>
      </div>
    </div>
  );
}

function FriendAvatar({ userId, username, hasRipeCrops }: { userId: string; username: string; hasRipeCrops: boolean }) {
  const initial = (username ?? '?')[0].toUpperCase();

  return (
    <button
      onClick={() => eventBus.emit('visit-farm', { userId, username })}
      className="relative flex-shrink-0 w-11 h-11 active:scale-90 transition-all"
    >
      <div className="w-full h-full rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold text-sm border-2 border-white/20">
        {initial}
      </div>
      {hasRipeCrops && (
        <div className="absolute -top-0.5 -right-0.5 bg-amber-400 rounded-full w-4 h-4 flex items-center justify-center">
          <Wheat size={9} className="text-black" />
        </div>
      )}
    </button>
  );
}
