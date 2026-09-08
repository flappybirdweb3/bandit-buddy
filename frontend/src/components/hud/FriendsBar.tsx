import { Wheat, UserPlus } from 'lucide-react';
import { eventBus } from '@/game/EventBus';
import type { TelegramFriend } from '@/types/game.types';

interface Props {
  friends: TelegramFriend[];
}

export function FriendsBar({ friends }: Props) {
  if (friends.length === 0) return null;

  return (
    <div className="fixed z-40 pointer-events-none"
      style={{ bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 112px)', left: 0, right: 0 }}
    >
      <div className="flex items-center gap-2 px-3 overflow-x-auto scrollbar-none pointer-events-auto pb-1">
        {/* Label */}
        <span className="text-white/40 text-[10px] font-semibold whitespace-nowrap flex-shrink-0">
          FRIENDS
        </span>

        {friends.map((f) => (
          <FriendAvatar key={f.id} friend={f} />
        ))}

        {/* Add more */}
        <button className="glass flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white/40 hover:text-white active:scale-90 transition-all">
          <UserPlus size={16} />
        </button>
      </div>
    </div>
  );
}

function FriendAvatar({ friend }: { friend: TelegramFriend }) {
  const initial = (friend.username ?? friend.firstName ?? '?')[0].toUpperCase();

  const handleVisit = () => {
    if (friend.userId) {
      eventBus.emit('visit-farm', {
        userId: friend.userId,
        username: friend.username ?? friend.firstName,
      });
    }
  };

  return (
    <button
      onClick={handleVisit}
      className="relative flex-shrink-0 w-11 h-11 active:scale-90 transition-all"
    >
      {/* Avatar circle */}
      <div className="w-full h-full rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold text-sm border-2 border-white/20">
        {initial}
      </div>

      {/* Ripe badge */}
      {friend.hasRipeCrops && (
        <div className="absolute -top-0.5 -right-0.5 bg-amber-400 rounded-full w-4 h-4 flex items-center justify-center">
          <Wheat size={9} className="text-black" />
        </div>
      )}
    </button>
  );
}
