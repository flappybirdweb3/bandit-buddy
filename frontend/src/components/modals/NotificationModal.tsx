import { useState, useEffect } from 'react';
import { X, Bell, BellOff, Swords, Swords as RevengeIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { InAppNotification, NotifType, ActivityEntry } from '@/types/game.types';

interface Props { onClose: () => void }

type Tab = 'inbox' | 'raids';

// ── Notifications ────────────────────────────────────────────────
const NOTIF_ICON: Record<NotifType, string> = {
  steal_victim:    '🥷',
  dog_bite_owner:  '🐕',
  quest_complete:  '✅',
  harvest_ready:   '🌾',
  referral_joined: '🎉',
  daily_reminder:  '🔥',
  attack_victim:   '☣️',
};

const NOTIF_COLOR: Record<NotifType, string> = {
  steal_victim:    'bg-red-500/15 border-red-400/25',
  dog_bite_owner:  'bg-amber-500/15 border-amber-400/25',
  quest_complete:  'bg-green-500/15 border-green-400/25',
  harvest_ready:   'bg-yellow-500/15 border-yellow-400/25',
  referral_joined: 'bg-violet-500/15 border-violet-400/25',
  daily_reminder:  'bg-orange-500/15 border-orange-400/25',
  attack_victim:   'bg-lime-500/15 border-lime-400/25',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NotifCard({ item, onClose }: { item: InAppNotification; onClose: () => void }) {
  const icon  = NOTIF_ICON[item.type] ?? '📬';
  const color = NOTIF_COLOR[item.type] ?? 'bg-white/5 border-white/10';
  const canRevenge = item.type === 'steal_victim' && item.actorUserId && item.actorUsername;

  const handleRevenge = () => {
    if (!item.actorUserId || !item.actorUsername) return;
    eventBus.emit('visit-farm', { userId: item.actorUserId, username: item.actorUsername });
    onClose();
  };

  return (
    <div className={`rounded-2xl border p-3.5 flex gap-3 transition-all ${color} ${item.isRead ? 'opacity-60' : ''}`}>
      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-bold leading-tight ${item.isRead ? 'text-white/60' : 'text-white'}`}>
            {item.title}
          </p>
          <span className="text-white/25 text-[10px] flex-shrink-0">{timeAgo(item.createdAt)}</span>
        </div>
        <p className="text-white/40 text-xs mt-1 leading-snug">{item.body}</p>
        {canRevenge && (
          <button
            onClick={handleRevenge}
            className="mt-2 flex items-center gap-1.5 glass-red rounded-xl px-2.5 py-1 text-red-300 text-[11px] font-bold active:scale-95 transition-all"
          >
            <RevengeIcon size={10} /> Raid Back
          </button>
        )}
      </div>
      {!item.isRead && (
        <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0 mt-1" />
      )}
    </div>
  );
}

// ── Activity feed ────────────────────────────────────────────────
type RaidScenario = 'attack_win' | 'attack_fail' | 'defend_loss' | 'defend_win';

function getRaidScenario(e: ActivityEntry): RaidScenario {
  if (e.role === 'attacker') return e.success ? 'attack_win' : 'attack_fail';
  return e.success ? 'defend_loss' : 'defend_win';
}

const RAID_META: Record<RaidScenario, { emoji: string; color: string; bg: string; border: string; label: (u: string) => string; amountPrefix: string; amountColor: string }> = {
  attack_win:  { emoji: '🥷', color: 'text-green-300',  bg: 'bg-green-500/10',  border: 'border-green-400/25',  label: (u) => `Raided @${u}`,         amountPrefix: '+', amountColor: 'text-green-400' },
  attack_fail: { emoji: '🐕', color: 'text-red-300',    bg: 'bg-red-500/10',    border: 'border-red-400/25',    label: (u) => `Dog bit you at @${u}'s`, amountPrefix: '-', amountColor: 'text-red-400'   },
  defend_loss: { emoji: '💀', color: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-400/25', label: (u) => `@${u} stole from you`,   amountPrefix: '-', amountColor: 'text-red-400'   },
  defend_win:  { emoji: '🛡️', color: 'text-blue-300',   bg: 'bg-blue-500/10',   border: 'border-blue-400/25',   label: (u) => `@${u} was repelled`,     amountPrefix: '',  amountColor: 'text-blue-400'  },
};

function ActivityCard({ entry }: { entry: ActivityEntry }) {
  const scenario = getRaidScenario(entry);
  const meta = RAID_META[scenario];
  const amtStr = entry.amount > 0 ? `${meta.amountPrefix}${entry.amount.toFixed(2)}G` : null;

  return (
    <div className={`rounded-2xl border p-3.5 flex gap-3 ${meta.bg} ${meta.border}`}>
      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-base flex-shrink-0">
        {meta.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-bold leading-tight ${meta.color}`}>
            {meta.label(entry.otherUsername)}
          </p>
          <span className="text-white/25 text-[10px] flex-shrink-0">{timeAgo(entry.createdAt)}</span>
        </div>
        {amtStr && (
          <p className={`text-xs font-black mt-1 ${meta.amountColor}`}>{amtStr}</p>
        )}
      </div>
    </div>
  );
}

// ── Summary stats bar ────────────────────────────────────────────
function RaidStats({ entries }: { entries: ActivityEntry[] }) {
  const won  = entries.filter((e) => e.role === 'attacker' && e.success).length;
  const lost = entries.filter((e) => e.role === 'attacker' && !e.success).length;
  const totalStolen   = entries.filter((e) => e.role === 'attacker' && e.success).reduce((s, e) => s + e.amount, 0);
  const totalLost     = entries.filter((e) => e.role === 'defender' && e.success).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="grid grid-cols-4 gap-1.5 mx-5 mb-3">
      {[
        { label: 'Raids Won',  value: won,  color: 'text-green-400' },
        { label: 'Raids Lost', value: lost, color: 'text-red-400'   },
        { label: 'Stolen',     value: `${totalStolen.toFixed(0)}G`, color: 'text-amber-400' },
        { label: 'Lost',       value: `${totalLost.toFixed(0)}G`,   color: 'text-red-400'   },
      ].map(({ label, value, color }) => (
        <div key={label} className="glass rounded-xl p-2 text-center">
          <p className={`text-sm font-black ${color}`}>{value}</p>
          <p className="text-white/30 text-[9px] mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────
export function NotificationModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('inbox');
  const queryClient = useQueryClient();

  const { data: inbox, isLoading: inboxLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: api.getInbox,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const { data: activity = [], isLoading: activityLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: api.getActivity,
    staleTime: 20_000,
    enabled: tab === 'raids',
  });

  const { mutate: markRead } = useMutation({
    mutationFn: api.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox'] }),
  });

  const { mutate: clearAll, isPending: clearing } = useMutation({
    mutationFn: api.clearNotifications,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox'] }),
  });

  // Auto-mark all read after 1.5s of viewing inbox
  useEffect(() => {
    if (tab === 'inbox' && (inbox?.unreadCount ?? 0) > 0) {
      const t = setTimeout(() => markRead(), 1500);
      return () => clearTimeout(t);
    }
  }, [inbox?.unreadCount, tab]);

  const items  = inbox?.items ?? [];
  const unread = inbox?.unreadCount ?? 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up flex flex-col"
        style={{ maxHeight: '82vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-violet-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Activity</h2>
              <p className="text-white/40 text-xs">
                {tab === 'inbox'
                  ? unread > 0 ? `${unread} unread` : 'All caught up!'
                  : `${activity.length} recent raids`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'inbox' && unread > 0 && (
              <button
                onClick={() => markRead()}
                className="glass text-white/50 text-xs px-3 py-1.5 rounded-xl active:scale-95 transition-all"
              >
                Mark read
              </button>
            )}
            {tab === 'inbox' && items.length > 0 && (
              <button
                onClick={() => clearAll()}
                disabled={clearing}
                className="glass text-red-400/70 text-xs px-3 py-1.5 rounded-xl active:scale-95 transition-all disabled:opacity-40"
              >
                Clear all
              </button>
            )}
            <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex-shrink-0 px-5 mb-3">
          <div className="glass rounded-2xl flex p-1 gap-1">
            <button
              onClick={() => setTab('inbox')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                tab === 'inbox' ? 'bg-white/15 text-white' : 'text-white/40'
              }`}
            >
              <Bell size={12} />
              Inbox
              {unread > 0 && (
                <span className="bg-violet-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {unread}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('raids')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                tab === 'raids' ? 'bg-white/15 text-white' : 'text-white/40'
              }`}
            >
              <Swords size={12} />
              Raids
            </button>
          </div>
        </div>

        {/* Raids stats */}
        {tab === 'raids' && !activityLoading && activity.length > 0 && (
          <RaidStats entries={activity} />
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1 px-5 pb-8 flex flex-col gap-2.5">

          {/* ── Inbox tab ── */}
          {tab === 'inbox' && (
            <>
              {inboxLoading && <div className="text-center py-12 text-white/40 text-sm">Loading…</div>}
              {!inboxLoading && items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <BellOff size={36} className="text-white/20" />
                  <p className="text-white/30 text-sm">No notifications yet.</p>
                  <p className="text-white/20 text-xs">Play, harvest, and raid to get started!</p>
                </div>
              )}
              {items.map((item) => <NotifCard key={item.id} item={item} onClose={onClose} />)}
            </>
          )}

          {/* ── Raids tab ── */}
          {tab === 'raids' && (
            <>
              {activityLoading && <div className="text-center py-12 text-white/40 text-sm">Loading…</div>}
              {!activityLoading && activity.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <Swords size={36} className="text-white/20" />
                  <p className="text-white/30 text-sm">No raid history yet.</p>
                  <p className="text-white/20 text-xs">Go steal some crops! 🥷</p>
                </div>
              )}
              {activity.map((e) => <ActivityCard key={e.id} entry={e} />)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
