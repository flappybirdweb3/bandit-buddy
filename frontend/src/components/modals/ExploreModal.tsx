import { useState, useRef, useEffect } from 'react';
import { SEED_EMOJI } from "@/constants/seeds";
import { X, Crosshair, Search, Trophy, Loader2, Swords, Eye, Shield, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { FarmPlot } from '@/types/game.types';

interface Props { onClose: () => void }

type Tab = 'targets' | 'search' | 'top';

// ── Farm target card ─────────────────────────────────────────────
function TargetCard({ userId, username, ripePlots, hasGuardDog, guardDogType, tag, onRaid, onPreview }: {
  userId: string; username: string; ripePlots?: number;
  hasGuardDog?: boolean; guardDogType?: string | null;
  tag?: 'friend' | 'global';
  onRaid: () => void; onPreview: () => void;
}) {
  const initial = (username[0] ?? '?').toUpperCase();
  const PET_EMOJI_MAP: Record<string, string> = {
    dog_stray: '🐶', dog_beagle: '🐕', dog_husky: '🐺', dog_shepherd: '🦮', elephant: '🐘',
    guard_pup: '🐕', guard_hound: '🐺',
  };
  const dogEmoji = PET_EMOJI_MAP[guardDogType ?? ''] ?? '🐕';
  return (
    <div className="rounded-2xl p-3.5 flex items-center gap-3 bg-red-500/8 border border-red-400/25">
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-[0_0_14px_rgba(239,68,68,0.4)]">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-bold text-sm">@{username}</span>
          {tag && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              tag === 'friend' ? 'bg-violet-500/25 text-violet-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {tag === 'friend' ? 'friend' : 'nearby'}
            </span>
          )}
          {hasGuardDog && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
              {dogEmoji} guarded
            </span>
          )}
        </div>
        <p className="text-red-300/80 text-[10px] mt-0.5 font-semibold">
          {ripePlots != null
            ? `${ripePlots} ripe plot${ripePlots > 1 ? 's' : ''} · steal now`
            : 'Ripe crops ready'}
        </p>
      </div>
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          onClick={onRaid}
          className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-rose-500 text-white text-xs font-black px-3 py-2 rounded-xl active:scale-90 transition-all shadow-[0_2px_10px_rgba(239,68,68,0.4)]"
        >
          <Swords size={11} /> Raid
        </button>
        <button
          onClick={onPreview}
          className="text-white/35 text-[10px] font-semibold text-center hover:text-white/60 active:scale-90 transition-all flex items-center justify-center gap-1"
        >
          <Eye size={9} /> Preview
        </button>
      </div>
    </div>
  );
}

// ── Attack row for a single growing plot ────────────────────────
function AttackPlotRow({ plot, targetUserId }: { plot: FarmPlot; targetUserId: string }) {
  const [toast, setToast] = useState<string | null>(null);
  const qc = useQueryClient();

  const attack = useMutation({
    mutationFn: (type: 'bugs' | 'weeds') => api.throwAttack(targetUserId, plot.id, type),
    onSuccess: (res) => {
      setToast(res.message);
      qc.invalidateQueries({ queryKey: ['farmPreview', targetUserId] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      setTimeout(() => setToast(null), 2000);
    },
    onError: (err: Error) => {
      setToast(`❌ ${err.message}`);
      setTimeout(() => setToast(null), 2000);
    },
  });

  const seedEmoji = SEED_EMOJI[plot.seed?.iconKey ?? ''] ?? '🌱';

  return (
    <div className="glass rounded-xl p-2.5 flex items-center gap-2">
      <span className="text-base flex-shrink-0">{seedEmoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white/70 text-[11px] font-semibold truncate">{plot.seed?.name ?? 'Growing'}</p>
        {toast && <p className="text-[10px] text-green-400 truncate">{toast}</p>}
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <button
          onClick={() => attack.mutate('bugs')}
          disabled={attack.isPending || plot.hasBugs}
          title="Throw Bag of Bugs"
          className={`text-lg leading-none active:scale-90 transition-all ${plot.hasBugs ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'}`}
        >🐛</button>
        <button
          onClick={() => attack.mutate('weeds')}
          disabled={attack.isPending || plot.hasWeeds}
          title="Throw Bag of Weeds"
          className={`text-lg leading-none active:scale-90 transition-all ${plot.hasWeeds ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'}`}
        >🌿</button>
      </div>
    </div>
  );
}

// ── Preview sheet ────────────────────────────────────────────────
function FarmPreviewSheet({ userId, username, onRaid, onBack }: {
  userId: string; username: string; onRaid: () => void; onBack: () => void;
}) {
  const { data: farm, isLoading } = useQuery({
    queryKey: ['farmPreview', userId],
    queryFn: () => api.getFarm(userId),
    staleTime: 30_000,
  });

  const ripePlots = farm?.plots.filter((p) => !p.isEmpty && p.isRipe && p.stealableRemaining > 0) ?? [];
  const totalLoot = ripePlots.reduce((s, p) => s + p.stealableRemaining, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-white/50 text-xs font-semibold hover:text-white/80 active:scale-95 transition-all self-start">
        ← Back to list
      </button>

      <p className="text-white font-black text-sm">@{username}'s Farm</p>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-white/40 text-sm">
          <Loader2 size={16} className="animate-spin" /> Scouting farm…
        </div>
      ) : (
        <>
          {farm?.hasGuardDog && (
            <div className="rounded-2xl p-3 flex items-center gap-2.5 bg-amber-500/10 border border-amber-400/30">
              {(() => {
                const PET_E: Record<string, string> = {
                  dog_stray: '🐶', dog_beagle: '🐕', dog_husky: '🐺', dog_shepherd: '🦮', elephant: '🐘',
                  guard_pup: '🐕', guard_hound: '🐺',
                };
                const PET_N: Record<string, string> = {
                  dog_stray: 'Stray Dog', dog_beagle: 'Beagle', dog_husky: 'Husky',
                  dog_shepherd: 'German Shepherd', elephant: 'Elephant',
                  guard_pup: 'Guard Pup', guard_hound: 'Guard Hound',
                };
                const PET_DEF: Record<string, number> = {
                  dog_stray: 10, dog_beagle: 25, dog_husky: 40, dog_shepherd: 60, elephant: 80,
                  guard_pup: 15, guard_hound: 30,
                };
                const dtype = farm.guardDogType ?? '';
                const defense = PET_DEF[dtype] ?? 0;
                return (
                  <>
                    <span className="text-xl">{PET_E[dtype] ?? '🐕'}</span>
                    <div>
                      <p className="text-amber-300 font-bold text-xs">{PET_N[dtype] ?? 'Guard Pet'} on patrol!</p>
                      <p className="text-amber-300/60 text-[10px] mt-0.5">
                        {defense >= 80 ? 'Theft impossible!' : `${Math.max(0, 80 - defense)}% steal success rate`}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {ripePlots.length > 0 ? (
            <div className="rounded-2xl p-3.5 flex items-center gap-3 bg-red-500/12 border border-red-400/30">
              <span className="text-2xl">🥷</span>
              <div>
                <p className="text-red-300 font-black text-sm">{ripePlots.length} stealable plot{ripePlots.length > 1 ? 's' : ''}</p>
                <p className="text-red-300/60 text-xs">Up to {totalLoot.toFixed(1)}G available</p>
              </div>
            </div>
          ) : (
            <div className="glass rounded-2xl p-4 text-center">
              <p className="text-white/40 text-sm">No stealable crops right now</p>
            </div>
          )}

          {/* Plot grid */}
          <div className="grid grid-cols-3 gap-2">
            {(farm?.plots ?? Array(6).fill(null)).map((p, i) => (
              <div key={p?.id ?? i} className={`rounded-xl p-2.5 text-center ${
                !p || p.isEmpty ? 'bg-white/4' :
                p.isRipe && p.stealableRemaining > 0 ? 'bg-red-900/25 border border-red-400/40' :
                p.isRipe ? 'bg-amber-900/15' : 'bg-green-900/15'
              }`}>
                <div className="text-xl mb-1">
                  {!p || p.isEmpty ? '🟫'
                    : SEED_EMOJI[p.seed?.iconKey ?? ''] ?? '🌱'}
                </div>
                <div className="text-white/40 text-[9px] truncate">{!p || p.isEmpty ? 'Empty' : p.seed?.name}</div>
                {p && !p.isEmpty && p.isRipe && p.stealableRemaining > 0 && (
                  <div className="text-red-400 text-[8px] font-black mt-0.5">STEAL</div>
                )}
              </div>
            ))}
          </div>

          {/* Attack section for growing (non-ripe) crops */}
          {(() => {
            const growingPlots = (farm?.plots ?? []).filter((p) => !p.isEmpty && !p.isRipe);
            if (growingPlots.length === 0) return null;
            return (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/30 text-[9px] font-bold uppercase tracking-widest">Sabotage Growing Crops</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <div className="flex flex-col gap-1.5">
                  {growingPlots.map((p) => (
                    <AttackPlotRow key={p.id} plot={p} targetUserId={userId} />
                  ))}
                </div>
                <p className="text-white/20 text-[10px] text-center mt-1.5">
                  🐛 −20% yield · 🌿 −30% yield · each costs 15 ⚡
                </p>
              </div>
            );
          })()}

          <button
            onClick={onRaid}
            disabled={ripePlots.length === 0}
            className={`w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2 ${
              ripePlots.length > 0
                ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-[0_4px_20px_rgba(220,38,38,0.4)]'
                : 'glass text-white/40'
            }`}
          >
            {ripePlots.length > 0 ? <><Swords size={15} /> Launch Raid</> : '😴 Nothing to steal'}
          </button>
        </>
      )}
    </div>
  );
}

// ── Targets tab ──────────────────────────────────────────────────
function TargetsTab({ onVisit }: { onVisit: (id: string, name: string) => void }) {
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ['friends'],
    queryFn: api.getFriends,
    staleTime: 30_000,
  });

  const { data: explore = [], isLoading: loadingExplore } = useQuery({
    queryKey: ['exploreFarms'],
    queryFn: api.getExploreFarms,
    staleTime: 30_000,
  });

  const stealableFriends = friends.filter((f) => f.isStealable);
  const friendIds = new Set(friends.map((f) => f.userId));
  const stealableGlobal = explore.filter((e) => !friendIds.has(e.userId));
  const total = stealableFriends.length + stealableGlobal.length;

  const isLoading = loadingFriends || loadingExplore;

  if (preview) {
    return (
      <FarmPreviewSheet
        userId={preview.id}
        username={preview.name}
        onRaid={() => onVisit(preview.id, preview.name)}
        onBack={() => setPreview(null)}
      />
    );
  }

  if (isLoading) return (
    <div className="flex items-center justify-center gap-2 py-12 text-white/40 text-sm">
      <Loader2 size={16} className="animate-spin" /> Scouting farms…
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header count */}
      {total > 0 ? (
        <div className="rounded-2xl p-3.5 flex items-center gap-3 bg-gradient-to-r from-red-600/20 to-rose-600/10 border border-red-400/30">
          <span className="text-3xl">🥷</span>
          <div>
            <p className="text-white font-black text-sm">{total} farm{total > 1 ? 's' : ''} ready to raid</p>
            <p className="text-red-300/70 text-xs mt-0.5">Strike before crops get harvested</p>
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl p-5 text-center">
          <div className="text-3xl mb-2">😴</div>
          <p className="text-white/50 text-sm font-semibold">All farms are sleeping</p>
          <p className="text-white/25 text-xs mt-1">No stealable crops right now — check back soon</p>
        </div>
      )}

      {/* Friend targets */}
      {stealableFriends.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm">🏘️</span>
            <span className="text-white/40 text-[11px] font-bold uppercase tracking-wider">Your neighbors</span>
          </div>
          {stealableFriends.map((f) => (
            <TargetCard key={f.userId} userId={f.userId} username={f.username} tag="friend"
              onRaid={() => onVisit(f.userId, f.username)}
              onPreview={() => setPreview({ id: f.userId, name: f.username })} />
          ))}
        </>
      )}

      {/* Global targets */}
      {stealableGlobal.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm">🌍</span>
            <span className="text-white/40 text-[11px] font-bold uppercase tracking-wider">Nearby farms</span>
          </div>
          {stealableGlobal.map((f) => (
            <TargetCard key={f.userId} userId={f.userId} username={f.username} ripePlots={f.ripePlots}
              hasGuardDog={f.hasGuardDog} guardDogType={f.guardDogType} tag="global"
              onRaid={() => onVisit(f.userId, f.username)}
              onPreview={() => setPreview({ id: f.userId, name: f.username })} />
          ))}
        </>
      )}
    </div>
  );
}

// ── Search tab ───────────────────────────────────────────────────
function SearchTab({ onVisit }: { onVisit: (id: string, name: string) => void }) {
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedQ(query.trim()), 400);
    return () => clearTimeout(timer.current);
  }, [query]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['userSearch', debouncedQ],
    queryFn: () => api.searchUsers(debouncedQ),
    enabled: debouncedQ.length >= 2,
    staleTime: 15_000,
  });

  if (preview) {
    return (
      <FarmPreviewSheet
        userId={preview.id}
        username={preview.name}
        onRaid={() => onVisit(preview.id, preview.name)}
        onBack={() => setPreview(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search box */}
      <div className="glass rounded-2xl flex items-center gap-2 px-3.5">
        {isFetching
          ? <Loader2 size={15} className="text-white/40 animate-spin flex-shrink-0" />
          : <Search size={15} className="text-white/40 flex-shrink-0" />}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username…"
          className="flex-1 bg-transparent text-white text-sm py-3.5 outline-none placeholder:text-white/30"
          autoFocus
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-white/30 hover:text-white/60 active:scale-90 transition-all">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Hint */}
      {debouncedQ.length < 2 && (
        <p className="text-white/25 text-xs text-center py-4">Type at least 2 characters to search</p>
      )}

      {/* No results */}
      {debouncedQ.length >= 2 && !isFetching && results.length === 0 && (
        <p className="text-white/30 text-sm text-center py-4">No players found for "{debouncedQ}"</p>
      )}

      {/* Results */}
      {results.map((u) => (
        <div key={u.userId} className="glass rounded-2xl flex items-center gap-3 p-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold flex-shrink-0">
            {(u.username[0] ?? '?').toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">@{u.username}</p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPreview({ id: u.userId, name: u.username })}
              className="glass text-white/60 text-xs font-semibold px-2.5 py-1.5 rounded-xl active:scale-90 transition-all"
            >
              Preview
            </button>
            <button
              onClick={() => onVisit(u.userId, u.username)}
              className="glass text-white/60 text-xs font-semibold px-2.5 py-1.5 rounded-xl active:scale-90 transition-all"
            >
              Visit
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Top Players tab ──────────────────────────────────────────────
function TopTab({ onVisit }: { onVisit: (id: string, name: string) => void }) {
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'rich'],
    queryFn: () => api.getLeaderboard('rich'),
    staleTime: 60_000,
  });

  if (preview) {
    return (
      <FarmPreviewSheet
        userId={preview.id}
        username={preview.name}
        onRaid={() => onVisit(preview.id, preview.name)}
        onBack={() => setPreview(null)}
      />
    );
  }

  if (isLoading) return (
    <div className="flex items-center justify-center gap-2 py-12 text-white/40 text-sm">
      <Loader2 size={16} className="animate-spin" /> Loading top farms…
    </div>
  );

  const entries = data?.entries ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="glass rounded-2xl p-3 flex items-center gap-2.5 mb-1">
        <Shield size={14} className="text-amber-400 flex-shrink-0" />
        <p className="text-white/50 text-[11px]">High-gold players may have strong guard dogs — raid at your own risk!</p>
      </div>

      {entries.map((e, i) => {
        const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
        const medal = MEDAL[i + 1] ?? `#${i + 1}`;
        return (
          <div key={e.userId} className={`glass rounded-2xl flex items-center gap-3 p-3 ${e.isMe ? 'border border-violet-400/30 bg-violet-500/8' : ''}`}>
            <div className="w-8 text-center flex-shrink-0 text-sm">{medal}</div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-yellow-700 flex items-center justify-center text-black font-bold flex-shrink-0">
              {(e.username[0] ?? '?').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${e.isMe ? 'text-violet-300' : 'text-white'}`}>
                @{e.username}
                {e.isMe && <span className="ml-1 text-[10px] text-violet-400/70">(you)</span>}
              </p>
              <p className="text-amber-300 text-[10px] font-bold">{e.goldBalance >= 1000 ? `${(e.goldBalance/1000).toFixed(1)}k` : e.goldBalance.toFixed(0)}G</p>
            </div>
            {!e.isMe && (
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setPreview({ id: e.userId, name: e.username })}
                  className="glass text-white/50 text-[10px] font-semibold px-2 py-1.5 rounded-xl active:scale-90 transition-all"
                >
                  <Eye size={11} />
                </button>
                <button
                  onClick={() => onVisit(e.userId, e.username)}
                  className="glass text-white/60 text-[10px] font-semibold px-2.5 py-1.5 rounded-xl active:scale-90 transition-all flex items-center gap-1"
                >
                  <Zap size={10} /> Visit
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────
export function ExploreModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('targets');

  const { data: exploreFarms = [] } = useQuery({
    queryKey: ['exploreFarms'],
    queryFn: api.getExploreFarms,
    staleTime: 30_000,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: api.getFriends,
    staleTime: 30_000,
  });

  const stealableCount =
    friends.filter((f) => f.isStealable).length +
    exploreFarms.filter((e) => !friends.some((f) => f.userId === e.userId)).length;

  const handleVisit = (userId: string, username: string) => {
    eventBus.emit('visit-farm', { userId, username });
    onClose();
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'targets', label: 'Targets', icon: <Crosshair size={12} />, badge: stealableCount > 0 ? stealableCount : undefined },
    { id: 'search',  label: 'Search',  icon: <Search size={12} /> },
    { id: 'top',     label: 'Top',     icon: <Trophy size={12} /> },
  ];

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
            <span className="text-xl">🌍</span>
            <div>
              <h2 className="text-white font-black text-base leading-none">World Explore</h2>
              <p className="text-white/40 text-xs mt-0.5">Find farms to raid</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex-shrink-0 px-5 mb-3">
          <div className="glass rounded-2xl flex p-1 gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  tab === t.id ? 'bg-white/15 text-white' : 'text-white/40'
                }`}
              >
                {t.icon} {t.label}
                {t.badge != null && (
                  <span className="absolute -top-1 -right-0.5 bg-red-500 text-white text-[8px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center px-0.5">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 pb-8 flex flex-col gap-3">
          {tab === 'targets' && <TargetsTab onVisit={handleVisit} />}
          {tab === 'search'  && <SearchTab  onVisit={handleVisit} />}
          {tab === 'top'     && <TopTab     onVisit={handleVisit} />}
        </div>
      </div>
    </div>
  );
}
