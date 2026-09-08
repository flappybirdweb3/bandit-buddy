import { useState } from 'react';
import { X, Wheat, UserPlus, ArrowLeft, Hand, DoorOpen, Copy, Share2, Users, Coins } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import WebApp from '@twa-dev/sdk';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { FarmData } from '@/types/game.types';

interface Props { onClose: () => void }

const SEED_EMOJI: Record<string, string> = {
  wheat: '🌾', carrot: '🥕', corn: '🌽', tomato: '🍅', pumpkin: '🎃',
};

type Tab = 'friends' | 'invite';

export function FriendsModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('friends');
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ['friends'],
    queryFn: api.getFriends,
    staleTime: 30_000,
  });

  const { data: referral, isLoading: loadingReferral } = useQuery({
    queryKey: ['referral'],
    queryFn: api.getReferral,
    staleTime: 60_000,
  });

  const { data: farm, isLoading: loadingFarm } = useQuery({
    queryKey: ['friendFarm', selected?.id],
    queryFn: () => api.getFarm(selected!.id),
    enabled: !!selected,
  });

  const handleVisit = (userId: string, username: string) => {
    eventBus.emit('visit-farm', { userId, username });
    onClose();
  };

  const handleCopy = () => {
    if (!referral) return;
    navigator.clipboard.writeText(referral.inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (!referral) return;
    const url = encodeURIComponent(referral.inviteLink);
    const text = encodeURIComponent(referral.shareText);
    WebApp.openTelegramLink(`https://t.me/share/url?url=${url}&text=${text}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {selected && (
              <button onClick={() => setSelected(null)} className="glass rounded-full p-1.5 text-white/60 hover:text-white active:scale-90 mr-1">
                <ArrowLeft size={15} />
              </button>
            )}
            <div>
              <h2 className="text-white font-black text-base leading-none">
                {selected ? `@${selected.name}'s Farm` : 'Friends'}
              </h2>
              <p className="text-white/40 text-xs">
                {selected ? 'Preview & raid' : 'Invite & raid together'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {!selected ? (
          <>
            {/* Tabs */}
            <div className="glass rounded-2xl flex p-1 mb-4">
              <button
                onClick={() => setTab('friends')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'friends' ? 'bg-white/15 text-white' : 'text-white/40'}`}
              >
                <Users size={14} /> Friends ({friends.length})
              </button>
              <button
                onClick={() => setTab('invite')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'invite' ? 'bg-white/15 text-white' : 'text-white/40'}`}
              >
                <UserPlus size={14} /> Invite
              </button>
            </div>

            {tab === 'friends' ? (
              <FriendsList
                friends={friends}
                loading={loadingFriends}
                onSelect={(id, name) => setSelected({ id, name })}
                onVisit={handleVisit}
                onInvite={() => setTab('invite')}
              />
            ) : (
              <InviteTab
                referral={referral}
                loading={loadingReferral}
                copied={copied}
                onCopy={handleCopy}
                onShare={handleShare}
              />
            )}
          </>
        ) : (
          <FarmPreview
            farm={farm}
            loading={loadingFarm}
            username={selected.name}
            onVisit={() => handleVisit(selected.id, selected.name)}
          />
        )}
      </div>
    </div>
  );
}

function FriendsList({ friends, loading, onSelect, onVisit, onInvite }: {
  friends: { userId: string; username: string; hasRipeCrops: boolean; isStealable: boolean }[];
  loading: boolean;
  onSelect: (id: string, name: string) => void;
  onVisit: (id: string, name: string) => void;
  onInvite: () => void;
}) {
  if (loading) {
    return <div className="text-center py-10 text-white/40 text-sm">Loading friends…</div>;
  }

  return (
    <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
      {friends.length === 0 && (
        <div className="text-center py-6 text-white/30 text-sm">
          No friends yet. Invite someone!
        </div>
      )}

      {friends.map((f) => (
        <div
          key={f.userId}
          className={`glass rounded-2xl flex items-center gap-3 p-3 ${f.hasRipeCrops ? 'border border-amber-400/30' : ''}`}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold flex-shrink-0">
            {f.username[0].toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm">@{f.username}</div>
            {f.hasRipeCrops
              ? <div className="text-amber-400 text-[10px] flex items-center gap-1 mt-0.5"><Wheat size={9} /> Ripe crops!</div>
              : <div className="text-white/30 text-[10px] mt-0.5">Nothing to steal</div>}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onSelect(f.userId, f.username)}
              className="glass text-white/60 text-xs font-semibold px-2.5 py-1.5 rounded-xl active:scale-90 transition-all"
            >
              View
            </button>
            <button
              onClick={() => onVisit(f.userId, f.username)}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-xl active:scale-90 transition-all ${
                f.isStealable ? 'glass-red text-red-300' : 'glass-green text-green-300'
              }`}
            >
              {f.isStealable ? '🥷 Steal' : '🚪 Visit'}
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={onInvite}
        className="glass rounded-2xl flex items-center justify-center gap-2 p-3 text-white/40 hover:text-white/60 active:scale-95 transition-all border border-dashed border-white/10"
      >
        <UserPlus size={16} />
        <span className="text-sm font-semibold">Invite more friends</span>
      </button>
    </div>
  );
}

function InviteTab({ referral, loading, copied, onCopy, onShare }: {
  referral?: { referralCount: number; bonusEarned: number; bonusPerReferral: number; inviteLink: string; shareText: string };
  loading: boolean;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
}) {
  if (loading) {
    return <div className="text-center py-10 text-white/40 text-sm">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-gold rounded-2xl p-3 text-center">
          <div className="text-amber-300 font-black text-2xl">{referral?.referralCount ?? 0}</div>
          <div className="text-white/40 text-[10px] mt-1">Friends Invited</div>
        </div>
        <div className="glass-purple rounded-2xl p-3 text-center">
          <div className="text-violet-300 font-black text-2xl flex items-center justify-center gap-1">
            <Coins size={16} className="text-amber-400" />
            {referral?.bonusEarned ?? 0}
          </div>
          <div className="text-white/40 text-[10px] mt-1">GOLD Earned</div>
        </div>
      </div>

      {/* Reward info */}
      <div className="glass rounded-2xl p-3 text-center text-sm text-white/60">
        Each friend you invite earns you <span className="text-amber-300 font-bold">{referral?.bonusPerReferral ?? 25}G</span> and gives them a <span className="text-green-300 font-bold">50G</span> head start!
      </div>

      {/* Invite link */}
      <div className="glass rounded-2xl flex items-center overflow-hidden">
        <div className="flex-1 px-3 py-3 text-white/50 text-xs truncate font-mono">
          {referral?.inviteLink ?? '…'}
        </div>
        <button
          onClick={onCopy}
          className={`flex items-center gap-1.5 px-3 py-3 border-l border-white/10 text-xs font-bold transition-all active:scale-95 ${
            copied ? 'text-green-400' : 'text-violet-300'
          }`}
        >
          <Copy size={13} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Share button */}
      <button
        onClick={onShare}
        className="w-full bg-gradient-to-r from-violet-600 to-purple-500 py-4 rounded-2xl text-white font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        <Share2 size={16} />
        Share Invite Link
      </button>

      <p className="text-white/20 text-[10px] text-center">
        Friends who join via your link appear in your Friends list and you can raid their farms!
      </p>
    </div>
  );
}

function FarmPreview({ farm, loading, username, onVisit }: {
  farm?: FarmData; loading: boolean; username: string; onVisit: () => void;
}) {
  if (loading) {
    return <div className="text-center py-10 text-white/40 text-sm">Loading {username}'s farm…</div>;
  }

  const ripePlots = farm?.plots.filter((p) => !p.isEmpty && p.isRipe && p.stealableRemaining > 0) ?? [];
  const totalStealable = ripePlots.reduce((s, p) => s + p.stealableRemaining, 0);

  return (
    <div>
      {ripePlots.length > 0 ? (
        <div className="glass-red rounded-2xl p-3 mb-4 flex items-center gap-2">
          <Hand size={16} className="text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">
            <strong>{ripePlots.length} ripe plot{ripePlots.length > 1 ? 's' : ''}</strong> — up to <strong>{totalStealable.toFixed(1)}G</strong> stealable
          </span>
        </div>
      ) : (
        <div className="glass rounded-2xl p-3 mb-4 text-white/40 text-sm text-center">
          No crops to steal right now.
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-5">
        {(farm?.plots ?? Array(6).fill(null)).map((p, i) => (
          <div
            key={p?.id ?? i}
            className={`rounded-xl p-2.5 text-center ${
              !p || p.isEmpty ? 'bg-amber-900/30' :
              p.isRipe ? 'bg-amber-400/15 border border-amber-400/40' :
              'bg-green-900/30'
            }`}
          >
            <div className="text-2xl mb-1">
              {!p || p.isEmpty ? '🟫' : p.isRipe ? SEED_EMOJI[p.seed?.iconKey ?? ''] ?? '✨' : '🌱'}
            </div>
            <div className="text-white/50 text-[10px]">
              {!p || p.isEmpty ? 'Empty' : p.seed?.name}
            </div>
            {p && !p.isEmpty && p.isRipe && (
              <div className="text-amber-400 text-[9px] font-bold">RIPE</div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onVisit}
        className={`w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2 ${
          ripePlots.length > 0
            ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white tool-steal-glow'
            : 'glass text-white'
        }`}
      >
        {ripePlots.length > 0
          ? <><Hand size={16} /> Enter & Steal</>
          : <><DoorOpen size={16} /> Visit Farm</>}
      </button>
    </div>
  );
}
