import { useState, useEffect, useRef } from 'react';
import { SEED_EMOJI } from "@/constants/seeds";
import {
  X, Wheat, UserPlus, ArrowLeft, Copy, Share2,
  Users, Coins, Search, Loader2, Sword, DoorOpen, Zap,
  ShieldAlert, ShieldCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import WebApp from '@twa-dev/sdk';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import { RaccoonMascot } from '@/components/mascot/RaccoonMascot';
import { ReferralScreen } from './ReferralScreen';
import type { FarmData } from '@/types/game.types';

interface Props { onClose: () => void }

type Tab = 'raid' | 'neighbors' | 'invite';

export function FriendsModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('raid');
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

  const stealableCount = friends.filter((f) => f.isStealable).length;

  const handleVisit = (userId: string, username: string, autoSteal = false) => {
    eventBus.emit('visit-farm', { userId, username });
    if (autoSteal) {
      eventBus.emit('tool-changed', 'steal');
    }
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
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referral.inviteLink)}&text=${encodeURIComponent(referral.shareText)}`;
    try {
      WebApp.openTelegramLink(shareUrl);
    } catch {
      navigator.clipboard.writeText(`${referral.shareText}\n${referral.inviteLink}`);
    }
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
 <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            {selected && (
              <button onClick={() => setSelected(null)} className="glass rounded-full p-1.5 text-white/60 hover:text-white active:scale-90 mr-1">
                <ArrowLeft size={15} />
              </button>
            )}
            <div>
              <h2 className="text-white font-black text-base leading-none flex items-center gap-2">
                {selected ? `@${selected.name}'s Farm` : (
                  <>
                    <span>Neighbors</span>
                    {stealableCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                        {stealableCount} ready to raid 🦝
                      </span>
                    )}
                  </>
                )}
              </h2>
              <p className="text-white/40 text-xs mt-0.5">
                {selected ? 'Preview crops & launch raid' : 'Raid neighbors · steal gold · grow rich'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {!selected ? (
          <>
            {/* Tab bar */}
 <div className="flex-shrink-0 px-5 mb-3">
              <div className="glass rounded-2xl flex p-1">
                <TabBtn active={tab === 'raid'} onClick={() => setTab('raid')} red={stealableCount > 0}>
                  <Sword size={12} />
                  <span>Raid</span>
                  {stealableCount > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {stealableCount}
                    </span>
                  )}
                </TabBtn>
                <TabBtn active={tab === 'neighbors'} onClick={() => setTab('neighbors')}>
                  <Users size={12} /> Neighbors
                </TabBtn>
                <TabBtn active={tab === 'invite'} onClick={() => setTab('invite')}>
                  <UserPlus size={12} /> Invite
                </TabBtn>
              </div>
            </div>

 <div className="overflow-y-auto flex-1 px-5 pb-8">
              {tab === 'raid' && (
                <RaidTab
                  friends={friends}
                  loading={loadingFriends}
                  onSelect={(id, name) => setSelected({ id, name })}
                  onVisit={handleVisit}
                  onInvite={() => setTab('invite')}
                />
              )}
              {tab === 'neighbors' && (
                <NeighborsList
                  friends={friends}
                  loading={loadingFriends}
                  onSelect={(id, name) => setSelected({ id, name })}
                  onVisit={handleVisit}
                  onInvite={() => setTab('invite')}
                />
              )}
              {tab === 'invite' && (
                <ReferralScreen
                  referral={referral}
                  isLoading={loadingReferral}
                  copied={copied}
                  onCopy={handleCopy}
                  onShare={handleShare}
                />
              )}
            </div>
          </>
        ) : (
 <div className="overflow-y-auto flex-1 px-5 pb-8">
            <FarmPreview
              farm={farm}
              loading={loadingFarm}
              username={selected.name}
              onVisit={(autoSteal) => handleVisit(selected.id, selected.name, autoSteal)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children, red }: {
  active: boolean; onClick: () => void; children: React.ReactNode; red?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
        active
          ? red ? 'bg-red-500/30 text-red-300' : 'bg-white/15 text-white'
          : 'text-white/40',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ─── RAID TAB — hero feature ─────────────────────────────────────
function RaidTab({ friends, loading, onSelect, onVisit, onInvite }: {
  friends: { userId: string; username: string; hasRipeCrops: boolean; isStealable: boolean; connection: 'invited' | 'invited_by' }[];
  loading: boolean;
  onSelect: (id: string, name: string) => void;
  onVisit: (id: string, name: string, autoSteal?: boolean) => void;
  onInvite: () => void;
}) {
  const { data: exploreFarms = [], isLoading: loadingExplore } = useQuery({
    queryKey: ['exploreFarms'],
    queryFn: api.getExploreFarms,
    staleTime: 30_000,
  });

  const stealableNeighbors = friends.filter((f) => f.isStealable);
  const stealableExplore = exploreFarms.filter((f) => !friends.some((fr) => fr.userId === f.userId));

  if (loading || loadingExplore) return <Loading text="Scouting farms…" />;

  const totalTargets = stealableNeighbors.length + stealableExplore.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Hero banner */}
      {totalTargets > 0 ? (
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(185,28,28,0.15))', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <RaccoonMascot size={48} className="flex-shrink-0" />
          <div>
            <p className="text-white font-black text-sm">{totalTargets} farm{totalTargets > 1 ? 's' : ''} ready to raid!</p>
            <p className="text-red-300/70 text-xs mt-0.5">Strike before others do — crops won't last long</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-4 text-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-3xl mb-2">😴</div>
          <p className="text-white/50 text-sm font-semibold">All neighbors are sleeping</p>
          <p className="text-white/25 text-xs mt-1">Check back when their crops ripen</p>
        </div>
      )}

      {/* Neighbor targets */}
      {stealableNeighbors.length > 0 && (
        <>
          <SectionLabel icon="🏘️" text="Your neighbors" />
          {stealableNeighbors.map((f) => (
            <RaidCard
              key={f.userId}
              userId={f.userId}
              username={f.username}
              tag="neighbor"
              onPreview={() => onSelect(f.userId, f.username)}
              onRaid={() => onVisit(f.userId, f.username, true)}
            />
          ))}
        </>
      )}

      {/* Global targets */}
      {stealableExplore.length > 0 && (
        <>
          <SectionLabel icon="🌍" text="Nearby farms" />
          {stealableExplore.map((f) => (
            <RaidCard
              key={f.userId}
              userId={f.userId}
              username={f.username}
              ripePlots={f.ripePlots}
              tag="farm"
              onPreview={() => onSelect(f.userId, f.username)}
              onRaid={() => onVisit(f.userId, f.username, true)}
            />
          ))}
        </>
      )}

      {/* CTA to invite more */}
      {totalTargets === 0 && (
        <button
          onClick={onInvite}
          className="glass rounded-2xl flex items-center justify-center gap-2 p-4 text-violet-300 border border-violet-400/20 active:scale-95 transition-all"
        >
          <UserPlus size={16} />
          <span className="text-sm font-bold">Invite neighbors to raid</span>
        </button>
      )}
    </div>
  );
}

function SectionLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{icon}</span>
      <span className="text-white/40 text-[11px] font-bold uppercase tracking-wider">{text}</span>
    </div>
  );
}

function RaidCard({ userId, username, ripePlots, tag, onPreview, onRaid }: {
  userId: string; username: string; ripePlots?: number;
  tag: 'neighbor' | 'farm';
  onPreview: () => void; onRaid: () => void;
}) {
  const initial = (username[0] ?? '?').toUpperCase();

  return (
    <div
      className="rounded-2xl p-3 flex items-center gap-3"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
    >
      {/* Avatar */}
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-[0_0_12px_rgba(239,68,68,0.35)]">
        {initial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm">@{username}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
            tag === 'neighbor'
              ? 'bg-violet-500/20 text-violet-300'
              : 'bg-amber-500/20 text-amber-300'
          }`}>
            {tag === 'neighbor' ? 'neighbor' : 'nearby'}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-red-300 text-[10px] font-semibold">
            {ripePlots != null ? `${ripePlots} ripe plot${ripePlots > 1 ? 's' : ''}` : 'Ripe crops ready'} — steal now!
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          onClick={onRaid}
          className="flex items-center gap-1 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[11px] font-black px-3 py-2 rounded-xl active:scale-90 transition-all shadow-[0_2px_12px_rgba(239,68,68,0.4)]"
        >
          <Sword size={11} /> Raid
        </button>
        <button
          onClick={onPreview}
          className="text-white/40 text-[10px] font-semibold text-center hover:text-white/60 transition-all"
        >
          Preview
        </button>
      </div>
    </div>
  );
}

// ─── Neighbors list ──────────────────────────────────────────────
function NeighborsList({ friends, loading, onSelect, onVisit, onInvite }: {
  friends: { userId: string; username: string; hasRipeCrops: boolean; isStealable: boolean; connection: 'invited' | 'invited_by' }[];
  loading: boolean;
  onSelect: (id: string, name: string) => void;
  onVisit: (id: string, name: string, autoSteal?: boolean) => void;
  onInvite: () => void;
}) {
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleInput = (val: string) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQ(val.trim()), 400);
  };
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const isSearching = debouncedQ.length >= 2;

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['userSearch', debouncedQ],
    queryFn: () => api.searchUsers(debouncedQ),
    enabled: isSearching,
    staleTime: 15_000,
  });

  if (loading) return <Loading text="Loading neighbors…" />;

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="glass rounded-2xl flex items-center gap-2 px-3">
        {searching ? <Loader2 size={15} className="text-white/40 animate-spin flex-shrink-0" />
          : <Search size={15} className="text-white/40 flex-shrink-0" />}
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="Find player by username…"
          className="flex-1 bg-transparent text-white text-sm py-3 outline-none placeholder:text-white/30"
        />
        {query && (
          <button onClick={() => { setQuery(''); setDebouncedQ(''); }} className="text-white/30 hover:text-white/60">
            <X size={14} />
          </button>
        )}
      </div>

      {isSearching ? (
        <div className="flex flex-col gap-2">
          {searching && <Loading text="Searching…" />}
          {!searching && searchResults.length === 0 && (
            <p className="text-center text-white/30 text-sm py-4">No players found for "{debouncedQ}"</p>
          )}
          {searchResults.map((u) => (
            <NeighborRow key={u.userId} userId={u.userId} username={u.username}
              hasRipeCrops={false} isStealable={false} connection={null}
              onView={() => onSelect(u.userId, u.username)}
              onVisit={(autoSteal) => onVisit(u.userId, u.username, autoSteal)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {friends.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🏚️</div>
              <p className="text-white/40 text-sm">No neighbors yet</p>
              <p className="text-white/25 text-xs mt-1">Invite friends to grow your neighborhood</p>
            </div>
          ) : (
            friends.map((f) => (
              <NeighborRow key={f.userId} userId={f.userId} username={f.username}
                hasRipeCrops={f.hasRipeCrops} isStealable={f.isStealable}
                connection={f.connection}
                onView={() => onSelect(f.userId, f.username)}
                onVisit={(autoSteal) => onVisit(f.userId, f.username, autoSteal)} />
            ))
          )}
          <button
            onClick={onInvite}
            className="glass rounded-2xl flex items-center justify-center gap-2 p-3 text-white/40 hover:text-white/60 active:scale-95 transition-all border border-dashed border-white/10 mt-1"
          >
            <UserPlus size={16} />
            <span className="text-sm font-semibold">Invite more neighbors</span>
          </button>
        </div>
      )}
    </div>
  );
}

function NeighborRow({ userId, username, hasRipeCrops, isStealable, connection, onView, onVisit }: {
  userId: string; username: string; hasRipeCrops: boolean; isStealable: boolean;
  connection: 'invited' | 'invited_by' | null;
  onView: () => void; onVisit: (autoSteal?: boolean) => void;
}) {
  const initial = (username[0] ?? '?').toUpperCase();
  return (
    <div className={`glass rounded-2xl flex items-center gap-3 p-3 ${isStealable ? 'border border-red-400/25' : ''}`}>
      <div className={[
        'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0',
        isStealable
          ? 'bg-gradient-to-br from-red-500 to-rose-700 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
          : 'bg-gradient-to-br from-violet-500 to-purple-700',
      ].join(' ')} style={{ marginLeft: '10px' }}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm">@{username}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {connection && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              connection === 'invited_by' ? 'bg-violet-500/20 text-violet-300' : 'bg-green-500/20 text-green-300'
            }`}>
              {connection === 'invited_by' ? '👑 Invited you' : '✉️ You invited'}
            </span>
          )}
          {connection ? (
            isStealable
              ? <span className="text-red-300 text-[10px] font-semibold flex items-center gap-0.5"><Wheat size={9} /> Stealable crops!</span>
              : hasRipeCrops
                ? <span className="text-amber-400 text-[10px]">Ripe (no steal cap left)</span>
                : <span className="text-white/25 text-[10px]">Nothing to steal</span>
          ) : (
            <span className="text-white/40 text-[10px]">Tap View to scout crops</span>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 flex-shrink-0" style={{ marginRight: '10px' }}>
        <button onClick={onView} className="glass text-white/60 text-xs font-semibold px-2.5 py-1.5 rounded-xl active:scale-90 transition-all">
          View
        </button>
        <button
          onClick={() => onVisit(isStealable)}
          className={`text-xs font-black px-2.5 py-1.5 rounded-xl active:scale-90 transition-all ${
            isStealable
              ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-[0_2px_8px_rgba(239,68,68,0.35)]'
              : 'glass text-white/60'
          }`}
        >
          {isStealable ? '🦝 Raid' : '🚪 Visit'}
        </button>
      </div>
    </div>
  );
}

// ─── Invite tab ──────────────────────────────────────────────────
function InviteTab({ referral, loading, copied, onCopy, onShare }: {
  referral?: { referralCount: number; bonusEarned: number; bonusPerReferral: number; inviteLink: string; shareText: string };
  loading: boolean; copied: boolean; onCopy: () => void; onShare: () => void;
}) {
  if (loading) return <Loading text="Loading…" />;

  const bonus = referral?.bonusPerReferral ?? 120;

  return (
    <div className="flex flex-col gap-3">
      {/* Viral hook */}
      <div className="rounded-2xl p-4 text-center"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.1))', border: '1px solid rgba(139,92,246,0.3)' }}>
        <RaccoonMascot size={72} className="mx-auto mb-1" />
        <p className="text-white font-black text-sm">More neighbors = more farms to raid</p>
        <p className="text-white/50 text-xs mt-1">Invite friends — they plant crops, you steal them 😈</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-gold rounded-2xl p-3 text-center">
          <div className="text-amber-300 font-black text-2xl">{referral?.referralCount ?? 0}</div>
          <div className="text-white/40 text-[10px] mt-1">Neighbors Recruited</div>
        </div>
        <div className="glass-purple rounded-2xl p-3 text-center">
          <div className="text-violet-300 font-black text-2xl flex items-center justify-center gap-1">
            <Coins size={16} className="text-amber-400" />
            {referral?.bonusEarned ?? 0}
          </div>
          <div className="text-white/40 text-[10px] mt-1">GOLD Earned</div>
        </div>
      </div>

      <div className="glass rounded-2xl p-3 text-center text-sm text-white/60">
        You earn <span className="text-amber-300 font-bold">{bonus}G</span> · friend gets <span className="text-green-300 font-bold">{bonus}G</span> welcome bonus
      </div>

      {/* Link */}
      <div className="glass rounded-2xl flex items-center overflow-hidden">
        <div className="flex-1 px-3 py-3 text-white/50 text-xs truncate font-mono">
          {referral?.inviteLink ?? '…'}
        </div>
        <button
          onClick={onCopy}
          className={`flex items-center gap-1.5 px-3 py-3 border-l border-white/10 text-xs font-bold transition-all active:scale-95 ${copied ? 'text-green-400' : 'text-violet-300'}`}
        >
          <Copy size={13} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <button
        onClick={onShare}
        className="w-full py-4 rounded-2xl text-white font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}
      >
        <Share2 size={16} /> Share Invite Link
      </button>

      <p className="text-white/20 text-[10px] text-center">
        🦝 Friends who join via your link become your neighbors — you can raid their farms anytime!
      </p>
    </div>
  );
}

// ─── Farm preview (when player is selected) ──────────────────────
function FarmPreview({ farm, loading, username, onVisit }: {
  farm?: FarmData; loading: boolean; username: string; onVisit: (autoSteal?: boolean) => void;
}) {
  if (loading) return <Loading text={`Scouting @${username}'s farm…`} />;

  const ripePlots = farm?.plots.filter((p) => !p.isEmpty && p.isRipe && p.stealableRemaining > 0) ?? [];
  const totalStealable = ripePlots.reduce((s, p) => s + p.stealableRemaining, 0);
  const hasTarget = ripePlots.length > 0;

  return (
    <div className="flex flex-col gap-3.5">
      {/* Intel banner */}
      {hasTarget ? (
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,28,28,0.1))', border: '1px solid rgba(239,68,68,0.35)' }}>
          <RaccoonMascot size={48} className="animate-bounce" />
          <div>
            <p className="text-red-300 font-black text-sm">
              {ripePlots.length} ripe plot{ripePlots.length > 1 ? 's' : ''} detected!
            </p>
            <p className="text-red-300/70 text-xs mt-0.5">
              Up to <span className="text-white font-bold">{totalStealable.toFixed(1)}G</span> available to steal
            </p>
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl p-4 text-center">
          <div className="text-2xl mb-1">😴</div>
          <p className="text-white/50 text-sm">No stealable crops right now</p>
          <p className="text-white/25 text-xs mt-0.5">Come back when their crops ripen</p>
        </div>
      )}

      {/* Guard Dog Defense Intel */}
      {farm?.hasGuardDog ? (
        <div className="rounded-2xl p-3 flex items-center gap-3 bg-amber-500/10 border border-amber-500/25">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
            <ShieldAlert size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-amber-300 font-bold text-xs">
              🐕 {farm.guardDogType ?? 'Guard Dog'} on Duty ({farm.guardDogDefense}% DEF)
            </p>
            <p className="text-white/40 text-[10px] mt-0.5">
              Guard dogs reduce steal success chance
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-3 flex items-center gap-3 bg-green-500/10 border border-green-500/20">
          <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400 flex-shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-green-300 font-bold text-xs">
              🛡️ No Guard Dog Active
            </p>
            <p className="text-white/40 text-[10px] mt-0.5">
              Unprotected farm — highest raid success chance
            </p>
          </div>
        </div>
      )}

      {/* Plot grid */}
      <div className="grid grid-cols-3 gap-2">
        {(farm?.plots ?? Array(6).fill(null)).map((p, i) => (
          <div
            key={p?.id ?? i}
            className={`rounded-xl p-2.5 text-center ${
              !p || p.isEmpty
                ? 'bg-amber-900/20'
                : p.isRipe && p.stealableRemaining > 0
                  ? 'border border-red-400/50 bg-red-900/20'
                  : p.isRipe
                    ? 'bg-amber-400/10 border border-amber-400/20'
                    : 'bg-green-900/20'
            }`}
          >
            <div className="text-2xl mb-1">
              {!p || p.isEmpty ? '🟫'
                : p.isRipe && p.stealableRemaining > 0 ? (SEED_EMOJI[p.seed?.iconKey ?? ''] ?? '✨')
                : p.isRipe ? (SEED_EMOJI[p.seed?.iconKey ?? ''] ?? '✨')
                : '🌱'}
            </div>
            <div className="text-white/50 text-[10px] truncate">
              {!p || p.isEmpty ? 'Empty' : p.seed?.name}
            </div>
            {p && !p.isEmpty && p.isRipe && p.stealableRemaining > 0 && (
              <div className="text-red-400 text-[9px] font-black">STEAL</div>
            )}
            {p && !p.isEmpty && p.isRipe && !p.stealableRemaining && (
              <div className="text-amber-400 text-[9px] font-bold">RIPE</div>
            )}
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => onVisit(hasTarget)}
        className={`w-full py-3.5 rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2 ${
          hasTarget
            ? 'text-white shadow-[0_4px_24px_rgba(220,38,38,0.45)]'
            : 'glass text-white/70 hover:text-white'
        }`}
        style={hasTarget ? {
          background: 'linear-gradient(135deg, #dc2626 0%, #e11d48 100%)',
        } : {}}
      >
        {hasTarget
          ? <><Zap size={16} fill="currentColor" /> Launch Raid on @{username}</>
          : <><DoorOpen size={16} /> Visit @{username}'s Farm</>
        }
      </button>

      {hasTarget && (
        <p className="text-white/30 text-[10px] text-center -mt-1">
          Auto-equips 🦝 Steal tool — tap ripe plots to raid
        </p>
      )}
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-white/40 text-sm">
      <Loader2 size={16} className="animate-spin" /> {text}
    </div>
  );
}

