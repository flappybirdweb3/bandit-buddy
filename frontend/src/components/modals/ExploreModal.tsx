import { useState, useRef, useEffect } from 'react';
import { SEED_EMOJI } from '@/constants/seeds';
import {
  X, Crosshair, Search, Trophy, Loader2, Swords, Eye, ShieldAlert,
  ShieldCheck, Zap, Hand, HeartHandshake, Sparkles, ArrowLeft, RefreshCw,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import { useGame } from '@/providers/GameProvider';
import type { FarmPlot } from '@/types/game.types';

interface Props { onClose: () => void }

type Tab = 'targets' | 'search' | 'top';

// ── Pet definition & defense mapping ──────────────────────────────
export const PET_REGISTRY: Record<string, { emoji: string; name: string; defaultDef: number }> = {
  // NFT Breeds
  Chihuahua:    { emoji: '🐕', name: 'Chihuahua',       defaultDef: 10 },
  Corgi:        { emoji: '🦊', name: 'Corgi',           defaultDef: 25 },
  Husky:        { emoji: '🐺', name: 'Husky',           defaultDef: 40 },
  Rottweiler:   { emoji: '🦮', name: 'Rottweiler',      defaultDef: 60 },
  Doberman:     { emoji: '🐾', name: 'Doberman',        defaultDef: 70 },
  Pitbull:      { emoji: '💀', name: 'Pitbull',         defaultDef: 80 },
  // Legacy Keys
  dog_stray:    { emoji: '🐶', name: 'Stray Dog',       defaultDef: 10 },
  dog_beagle:   { emoji: '🐕', name: 'Beagle',          defaultDef: 25 },
  dog_husky:    { emoji: '🐺', name: 'Husky',           defaultDef: 40 },
  dog_shepherd: { emoji: '🦮', name: 'German Shepherd', defaultDef: 60 },
  elephant:     { emoji: '🐘', name: 'Elephant',        defaultDef: 80 },
  guard_pup:    { emoji: '🐕', name: 'Guard Pup',       defaultDef: 15 },
  guard_hound:  { emoji: '🐺', name: 'Guard Hound',     defaultDef: 30 },
};

function getPetData(type: string | null | undefined, customDef?: number) {
  if (!type || !PET_REGISTRY[type]) {
    return {
      emoji: '🐕',
      name: type ? type : 'Guard Pet',
      defense: customDef ?? 0,
    };
  }
  const reg = PET_REGISTRY[type];
  return {
    emoji: reg.emoji,
    name: reg.name,
    defense: customDef != null && customDef > 0 ? customDef : reg.defaultDef,
  };
}

// ── Target card ───────────────────────────────────────────────────
function TargetCard({
  userId,
  username,
  ripePlots,
  hasGuardDog,
  guardDogType,
  guardDogDefense,
  tag,
  onRaid,
  onPreview,
}: {
  userId: string;
  username: string;
  ripePlots?: number;
  hasGuardDog?: boolean;
  guardDogType?: string | null;
  guardDogDefense?: number;
  tag?: 'friend' | 'global';
  onRaid: () => void;
  onPreview: () => void;
}) {
  const initial = (username[0] ?? '?').toUpperCase();
  const pet = getPetData(guardDogType, guardDogDefense);
  const isRaidReady = (ripePlots ?? 0) > 0;

  return (
    <div className={`rounded-2xl p-3 flex items-center justify-between gap-3 border transition-all ${
      isRaidReady
        ? 'bg-red-500/10 border-red-400/30 hover:border-red-400/50'
        : 'bg-white/5 border-white/10 hover:border-white/20'
    }`}>
      {/* Avatar */}
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-md">
        {initial}
      </div>

      {/* Center metadata */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white font-bold text-sm truncate">@{username}</span>
          {tag && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
              tag === 'friend' ? 'bg-violet-500/25 text-violet-300 border border-violet-400/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
            }`}>
              {tag === 'friend' ? 'neighbor' : 'explorer'}
            </span>
          )}

          {/* Defense Badge */}
          {hasGuardDog && pet.defense > 0 ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30">
              <ShieldAlert size={9} />
              <span>{pet.emoji} {pet.name} ({pet.defense}%)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <ShieldCheck size={9} />
              <span>Open (0%)</span>
            </span>
          )}
        </div>

        <p className={`text-xs mt-0.5 font-medium ${isRaidReady ? 'text-red-300' : 'text-white/50'}`}>
          {isRaidReady
            ? `🌾 ${ripePlots} ripe plot${ripePlots! > 1 ? 's' : ''} · Ready to raid`
            : '🌱 Growing crops · Tap to scout or help'}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onPreview}
          className="p-2 rounded-xl glass hover:bg-white/15 active:scale-95 text-white/60 hover:text-white transition-all"
          title="Scout farm preview"
        >
          <Eye size={15} />
        </button>
        <button
          onClick={onRaid}
          className={`flex items-center gap-1 text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-all shadow-md ${
            isRaidReady
              ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white hover:brightness-110 shadow-red-500/20'
              : 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:brightness-110 shadow-emerald-500/20'
          }`}
        >
          {isRaidReady ? (
            <>
              <Swords size={12} />
              <span>Raid</span>
            </>
          ) : (
            <>
              <Zap size={12} />
              <span>Visit</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Sabotage Row (attack enemy plot) ──────────────────────────────
function SabotagePlotRow({
  plot,
  targetUserId,
  userEnergy,
}: {
  plot: FarmPlot;
  targetUserId: string;
  userEnergy: number;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const qc = useQueryClient();

  const attack = useMutation({
    mutationFn: (type: 'bugs' | 'weeds') => api.throwAttack(targetUserId, plot.id, type),
    onSuccess: (res) => {
      setToast(res.message);
      eventBus.emit('play-sound', 'attack');
      eventBus.emit('show-toast', { message: res.message, type: 'success' });
      qc.invalidateQueries({ queryKey: ['farmPreview', targetUserId] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      setTimeout(() => setToast(null), 2500);
    },
    onError: (err: Error) => {
      setToast(`❌ ${err.message}`);
      eventBus.emit('show-toast', { message: err.message, type: 'error' });
      setTimeout(() => setToast(null), 2500);
    },
  });

  const seedEmoji = SEED_EMOJI[plot.seed?.iconKey ?? ''] ?? '🌱';
  const hasEnoughEnergy = userEnergy >= 15;

  return (
    <div className="glass rounded-xl p-2.5 flex items-center justify-between gap-2 border border-white/10">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xl flex-shrink-0">{seedEmoji}</span>
        <div className="min-w-0">
          <p className="text-white font-bold text-xs truncate">Plot #{plot.plotIndex + 1}: {plot.seed?.name ?? 'Crop'}</p>
          {toast ? (
            <p className="text-[10px] text-green-400 font-semibold truncate">{toast}</p>
          ) : (
            <p className="text-white/40 text-[10px]">
              {plot.hasBugs ? '🐛 Has bugs' : plot.hasWeeds ? '🌿 Has weeds' : 'Healthy growing crop'}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => attack.mutate('bugs')}
          disabled={attack.isPending || plot.hasBugs || !hasEnoughEnergy}
          title="Throw Bag of Bugs (−20% yield, 15 ⚡)"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            plot.hasBugs || !hasEnoughEnergy
              ? 'opacity-30 cursor-not-allowed bg-white/5 text-white/40'
              : 'bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30 active:scale-95'
          }`}
        >
          <span>🐛 Bugs</span>
        </button>
        <button
          onClick={() => attack.mutate('weeds')}
          disabled={attack.isPending || plot.hasWeeds || !hasEnoughEnergy}
          title="Throw Bag of Weeds (−30% yield, 15 ⚡)"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
            plot.hasWeeds || !hasEnoughEnergy
              ? 'opacity-30 cursor-not-allowed bg-white/5 text-white/40'
              : 'bg-amber-500/20 text-amber-300 border border-amber-400/30 hover:bg-amber-500/30 active:scale-95'
          }`}
        >
          <span>🌿 Weeds</span>
        </button>
      </div>
    </div>
  );
}

// ── Cooperative Help Row (curing neighbor crops for reward) ─────────
function HelpPlotRow({
  plot,
  targetUserId,
  userEnergy,
}: {
  plot: FarmPlot;
  targetUserId: string;
  userEnergy: number;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const qc = useQueryClient();

  const helpAction = useMutation({
    mutationFn: async (action: 'spray' | 'weed' | 'water') => {
      if (action === 'spray') return api.bugSpray(plot.id);
      if (action === 'weed')  return api.weedKill(plot.id);
      return api.water(plot.id);
    },
    onSuccess: (res) => {
      setToast(res.message);
      eventBus.emit('play-sound', 'weed_kill');
      eventBus.emit('show-toast', { message: res.message, type: 'success' });
      qc.invalidateQueries({ queryKey: ['farmPreview', targetUserId] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      setTimeout(() => setToast(null), 2500);
    },
    onError: (err: Error) => {
      setToast(`❌ ${err.message}`);
      eventBus.emit('show-toast', { message: err.message, type: 'error' });
      setTimeout(() => setToast(null), 2500);
    },
  });

  const seedEmoji = SEED_EMOJI[plot.seed?.iconKey ?? ''] ?? '🌱';
  const hasEnoughEnergy = userEnergy >= 5;

  return (
    <div className="glass rounded-xl p-2.5 flex items-center justify-between gap-2 border border-emerald-400/20 bg-emerald-500/5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xl flex-shrink-0">{seedEmoji}</span>
        <div className="min-w-0">
          <p className="text-white font-bold text-xs truncate">Plot #{plot.plotIndex + 1}: {plot.seed?.name ?? 'Crop'}</p>
          {toast ? (
            <p className="text-[10px] text-green-400 font-semibold truncate">{toast}</p>
          ) : (
            <p className="text-emerald-300/80 text-[10px]">
              {plot.hasBugs ? '🐛 Infected by bugs' : plot.hasWeeds ? '🌾 Choked by weeds' : '💧 Needs water'}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {plot.hasBugs && (
          <button
            onClick={() => helpAction.mutate('spray')}
            disabled={helpAction.isPending || !hasEnoughEnergy}
            title="Spray bugs (+15G, +1 Trust, −5 ⚡)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/40 active:scale-95 transition-all shadow-sm"
          >
            <span>Spray (+15G)</span>
          </button>
        )}
        {plot.hasWeeds && (
          <button
            onClick={() => helpAction.mutate('weed')}
            disabled={helpAction.isPending || !hasEnoughEnergy}
            title="Pull weeds (+10G, +1 Trust, −5 ⚡)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/40 active:scale-95 transition-all shadow-sm"
          >
            <span>Weed (+10G)</span>
          </button>
        )}
        {plot.hasDrySoil && (
          <button
            onClick={() => helpAction.mutate('water')}
            disabled={helpAction.isPending || !hasEnoughEnergy}
            title="Water dry soil (+10G, +1 Trust, −5 ⚡)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-blue-500/25 text-blue-300 border border-blue-400/40 hover:bg-blue-500/40 active:scale-95 transition-all shadow-sm"
          >
            <span>Water (+10G)</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Full Farm Preview Sheet ───────────────────────────────────────
function FarmPreviewSheet({
  userId,
  username,
  onRaid,
  onBack,
}: {
  userId: string;
  username: string;
  onRaid: () => void;
  onBack: () => void;
}) {
  const { profile } = useGame();
  const { data: farm, isLoading, refetch } = useQuery({
    queryKey: ['farmPreview', userId],
    queryFn: () => api.getFarm(userId),
    staleTime: 15_000,
  });

  const ripePlots = farm?.plots.filter((p) => !p.isEmpty && p.isRipe && p.stealableRemaining > 0) ?? [];
  const totalLoot = ripePlots.reduce((s, p) => s + p.stealableRemaining, 0);
  const helpPlots = farm?.plots.filter((p) => !p.isEmpty && !p.isRipe && (p.hasBugs || p.hasWeeds || p.hasDrySoil)) ?? [];
  const healthyGrowing = farm?.plots.filter((p) => !p.isEmpty && !p.isRipe && !p.hasBugs && !p.hasWeeds) ?? [];

  const pet = getPetData(farm?.guardDogType, farm?.guardDogDefense);
  const userEnergy = profile?.energy ?? 100;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-white/70 text-xs font-bold hover:text-white active:scale-95 transition-all glass px-3 py-1.5 rounded-xl"
        >
          <ArrowLeft size={13} />
          <span>Back to List</span>
        </button>

        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-lg glass text-white/50 hover:text-white active:scale-95 transition-all"
          title="Refresh farm state"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Target Title & Energy Reminder */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-white font-black text-base leading-tight">@{username}'s Farm</h3>
          <p className="text-white/40 text-xs mt-0.5">Scouting report & tactical actions</p>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full glass border border-white/10 text-xs font-bold text-amber-300">
          <Zap size={12} className="text-amber-400" />
          <span>{userEnergy} ⚡</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-white/40 text-sm">
          <Loader2 size={18} className="animate-spin text-red-400" />
          <span>Scouting farm plots & defense…</span>
        </div>
      ) : (
        <>
          {/* Guard Pet Status Banner */}
          {farm?.hasGuardDog && pet.defense > 0 ? (
            <div className="rounded-2xl p-3 flex items-center gap-3 bg-amber-500/10 border border-amber-400/30">
              <span className="text-2xl flex-shrink-0">{pet.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-amber-300 font-bold text-xs">{pet.name} on patrol!</p>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/30 text-amber-200">
                    {pet.defense}% DEFENSE
                  </span>
                </div>
                <p className="text-amber-300/70 text-[11px] mt-0.5 font-medium">
                  {pet.defense >= 80
                    ? '💀 Theft impossible! Guard will catch 100% of thieves.'
                    : `🎯 ~${Math.max(0, 80 - pet.defense)}% steal chance. Dog may intercept!`}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-3 flex items-center gap-3 bg-emerald-500/10 border border-emerald-400/30">
              <span className="text-2xl flex-shrink-0">🛡️</span>
              <div className="flex-1 min-w-0">
                <p className="text-emerald-300 font-bold text-xs">Unguarded Farm</p>
                <p className="text-emerald-300/70 text-[11px] mt-0.5">
                  No guard dog detected. Base 80% steal success rate!
                </p>
              </div>
            </div>
          )}

          {/* Stealable Loot Banner */}
          {ripePlots.length > 0 ? (
            <div className="rounded-2xl p-3.5 flex items-center gap-3 bg-gradient-to-r from-red-600/20 to-rose-600/10 border border-red-400/40">
              <span className="text-2xl flex-shrink-0">🥷</span>
              <div className="flex-1">
                <p className="text-red-300 font-black text-sm">
                  {ripePlots.length} stealable plot{ripePlots.length > 1 ? 's' : ''} detected!
                </p>
                <p className="text-red-200/70 text-xs">
                  Estimated up to <strong className="text-amber-300 font-bold">{totalLoot.toFixed(1)}G</strong> loot available
                </p>
              </div>
            </div>
          ) : (
            <div className="glass rounded-2xl p-3.5 text-center">
              <p className="text-white/50 text-xs font-semibold">No ripe crops ready to steal at this moment.</p>
            </div>
          )}

          {/* 6-Plot Visual Grid Preview */}
          <div className="grid grid-cols-3 gap-2">
            {(farm?.plots ?? Array(6).fill(null)).map((p, i) => {
              const isStealable = p && !p.isEmpty && p.isRipe && p.stealableRemaining > 0;
              const hasTrouble = p && !p.isEmpty && (p.hasBugs || p.hasWeeds || p.hasDrySoil);
              const seedEmoji = p && !p.isEmpty ? (SEED_EMOJI[p.seed?.iconKey ?? ''] ?? '🌱') : '🟫';

              return (
                <div
                  key={p?.id ?? i}
                  className={`rounded-xl p-2.5 text-center flex flex-col items-center justify-center border transition-all ${
                    !p || p.isEmpty
                      ? 'bg-white/5 border-white/5'
                      : isStealable
                      ? 'bg-red-500/20 border-red-400/60 shadow-[0_0_10px_rgba(239,68,68,0.25)]'
                      : hasTrouble
                      ? 'bg-amber-500/15 border-amber-400/40'
                      : p.isRipe
                      ? 'bg-amber-900/20 border-amber-400/20'
                      : 'bg-emerald-900/15 border-emerald-400/20'
                  }`}
                >
                  <span className="text-2xl mb-1">{seedEmoji}</span>
                  <p className="text-white font-bold text-[10px] truncate max-w-full">
                    {!p || p.isEmpty ? 'Empty' : p.seed?.name}
                  </p>
                  {isStealable && (
                    <span className="mt-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-red-600 text-white tracking-wider animate-pulse">
                      STEAL
                    </span>
                  )}
                  {hasTrouble && !isStealable && (
                    <span className="mt-1 text-[9px] text-amber-300 font-bold">
                      {p.hasBugs ? '🐛 Bugs' : p.hasWeeds ? '🌾 Weeds' : '💧 Dry'}
                    </span>
                  )}
                  {!hasTrouble && !isStealable && p && !p.isEmpty && !p.isRipe && (
                    <span className="mt-1 text-[9px] text-emerald-300/80 font-medium">Growing</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Section 1: Help Neighbor (Earn Gold & Trust) */}
          {helpPlots.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <HeartHandshake size={13} className="text-emerald-400" />
                <span className="text-emerald-300 font-black text-xs uppercase tracking-wider">
                  Help Neighbor ({helpPlots.length} plot{helpPlots.length > 1 ? 's' : ''} need aid)
                </span>
                <span className="ml-auto text-[10px] text-emerald-300/60 font-bold">Earn Gold + Trust</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {helpPlots.map((p) => (
                  <HelpPlotRow key={p.id} plot={p} targetUserId={userId} userEnergy={userEnergy} />
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Sabotage Healthy Growing Crops */}
          {healthyGrowing.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <Sparkles size={13} className="text-red-400" />
                <span className="text-red-300 font-black text-xs uppercase tracking-wider">
                  Sabotage Crops ({healthyGrowing.length} healthy plot{healthyGrowing.length > 1 ? 's' : ''})
                </span>
                <span className="ml-auto text-[10px] text-white/40">15 ⚡ per attack</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {healthyGrowing.map((p) => (
                  <SabotagePlotRow key={p.id} plot={p} targetUserId={userId} userEnergy={userEnergy} />
                ))}
              </div>
            </div>
          )}

          {/* Bottom Primary Action */}
          <button
            onClick={onRaid}
            className={`w-full py-3.5 rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg ${
              ripePlots.length > 0
                ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-red-500/30 hover:brightness-110'
                : 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-emerald-500/30 hover:brightness-110'
            }`}
          >
            {ripePlots.length > 0 ? (
              <>
                <Swords size={16} />
                <span>Launch Raid on Farm</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Visit Farm in Live View</span>
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

// ── Targets Tab ───────────────────────────────────────────────────
function TargetsTab({ onVisit }: { onVisit: (id: string, name: string) => void }) {
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'raid' | 'friends'>('all');

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

  const friendIds = new Set(friends.map((f) => f.userId));
  const stealableFriends = friends.filter((f) => f.isStealable);
  const allGlobal = explore.filter((e) => !friendIds.has(e.userId));
  const stealableGlobal = allGlobal.filter((e) => Number(e.ripePlots) > 0);

  const totalRaidReady = stealableFriends.length + stealableGlobal.length;
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-14 text-white/40 text-sm">
        <Loader2 size={20} className="animate-spin text-red-400" />
        <span>Scouting farms around the world…</span>
      </div>
    );
  }

  // Filter lists
  const displayFriends = filter === 'raid' ? stealableFriends : friends;
  const displayGlobal  = filter === 'raid' ? stealableGlobal  : allGlobal;

  return (
    <div className="flex flex-col gap-3">
      {/* Header status banner */}
      {totalRaidReady > 0 ? (
        <div className="rounded-2xl p-3 flex items-center gap-3 bg-gradient-to-r from-red-600/25 to-rose-600/15 border border-red-400/30">
          <span className="text-3xl flex-shrink-0">🥷</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm">
              {totalRaidReady} farm{totalRaidReady > 1 ? 's' : ''} ready to raid!
            </p>
            <p className="text-red-200/80 text-xs mt-0.5">
              Strike before crops get harvested by their owners
            </p>
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl p-4 text-center border border-white/10">
          <span className="text-3xl mb-1 inline-block">🌱</span>
          <p className="text-white font-bold text-sm">Crops are growing</p>
          <p className="text-white/40 text-xs mt-0.5">
            Visit neighbors to help water and spray crops for Gold & Trust rewards!
          </p>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
            filter === 'all'
              ? 'bg-white/20 text-white border border-white/20'
              : 'glass text-white/40 hover:text-white/70'
          }`}
        >
          All Targets ({friends.length + allGlobal.length})
        </button>
        <button
          onClick={() => setFilter('raid')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
            filter === 'raid'
              ? 'bg-red-500/25 text-red-300 border border-red-400/40'
              : 'glass text-white/40 hover:text-white/70'
          }`}
        >
          Ready to Raid ({totalRaidReady})
        </button>
        <button
          onClick={() => setFilter('friends')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
            filter === 'friends'
              ? 'bg-violet-500/25 text-violet-300 border border-violet-400/40'
              : 'glass text-white/40 hover:text-white/70'
          }`}
        >
          Neighbors ({friends.length})
        </button>
      </div>

      {/* Neighbors List */}
      {filter !== 'raid' && displayFriends.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs">🏘️</span>
            <span className="text-white/50 text-[11px] font-black uppercase tracking-wider">
              Your Neighbors ({displayFriends.length})
            </span>
          </div>
          {displayFriends.map((f) => (
            <TargetCard
              key={f.userId}
              userId={f.userId}
              username={f.username}
              tag="friend"
              ripePlots={f.isStealable ? 1 : 0}
              onRaid={() => onVisit(f.userId, f.username)}
              onPreview={() => setPreview({ id: f.userId, name: f.username })}
            />
          ))}
        </div>
      )}

      {/* Global Explorer List */}
      {displayGlobal.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs">🌍</span>
            <span className="text-white/50 text-[11px] font-black uppercase tracking-wider">
              {filter === 'raid' ? 'Raid Targets' : 'Nearby Farms'} ({displayGlobal.length})
            </span>
          </div>
          {displayGlobal.map((e) => (
            <TargetCard
              key={e.userId}
              userId={e.userId}
              username={e.username}
              ripePlots={Number(e.ripePlots)}
              hasGuardDog={e.hasGuardDog}
              guardDogType={e.guardDogType}
              guardDogDefense={e.guardDogDefense}
              tag="global"
              onRaid={() => onVisit(e.userId, e.username)}
              onPreview={() => setPreview({ id: e.userId, name: e.username })}
            />
          ))}
        </div>
      ) : (
        filter === 'raid' && (
          <div className="glass rounded-2xl p-6 text-center text-white/40 text-xs">
            No farms have ripe crops right now. Switch to "All Targets" to visit and help crops!
          </div>
        )
      )}
    </div>
  );
}

// ── Search Tab ────────────────────────────────────────────────────
function SearchTab({ onVisit }: { onVisit: (id: string, name: string) => void }) {
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedQ(query.trim()), 350);
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
      {/* Search Input Box */}
      <div className="glass rounded-2xl flex items-center gap-2.5 px-3.5 border border-white/10">
        {isFetching ? (
          <Loader2 size={15} className="text-white/40 animate-spin flex-shrink-0" />
        ) : (
          <Search size={15} className="text-white/40 flex-shrink-0" />
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by player username…"
          className="flex-1 bg-transparent text-white text-sm py-3 outline-none placeholder:text-white/30"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="text-white/30 hover:text-white/70 active:scale-90 transition-all p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {debouncedQ.length < 2 && (
        <p className="text-white/30 text-xs text-center py-6">
          Type at least 2 letters to find players across the world
        </p>
      )}

      {debouncedQ.length >= 2 && !isFetching && results.length === 0 && (
        <div className="glass rounded-2xl p-6 text-center text-white/40 text-xs border border-white/10">
          No players found matching "{debouncedQ}"
        </div>
      )}

      {/* Results List */}
      <div className="flex flex-col gap-2">
        {results.map((u) => (
          <div key={u.userId} className="glass rounded-2xl flex items-center justify-between gap-3 p-3 border border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md">
                {(u.username[0] ?? '?').toUpperCase()}
              </div>
              <p className="text-white font-bold text-sm truncate">@{u.username}</p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setPreview({ id: u.userId, name: u.username })}
                className="p-2 rounded-xl glass hover:bg-white/15 active:scale-95 text-white/60 hover:text-white transition-all"
                title="Preview Farm"
              >
                <Eye size={14} />
              </button>
              <button
                onClick={() => onVisit(u.userId, u.username)}
                className="flex items-center gap-1 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-black px-3 py-2 rounded-xl active:scale-95 hover:brightness-110 transition-all shadow-md"
              >
                <Zap size={11} />
                <span>Visit</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top Players Tab ───────────────────────────────────────────────
function TopTab({ onVisit }: { onVisit: (id: string, name: string) => void }) {
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);
  const [subCategory, setSubCategory] = useState<'rich' | 'thieves'>('rich');

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', subCategory],
    queryFn: () => api.getLeaderboard(subCategory),
    staleTime: 45_000,
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

  const entries = data?.entries ?? [];

  const formatGold = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}MG`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}kG`;
    return `${val.toFixed(0)}G`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Category switcher */}
      <div className="glass rounded-xl flex p-1 gap-1 border border-white/10">
        <button
          onClick={() => setSubCategory('rich')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
            subCategory === 'rich' ? 'bg-amber-500/30 text-amber-300 border border-amber-400/30' : 'text-white/40'
          }`}
        >
          💰 Richest Farmers
        </button>
        <button
          onClick={() => setSubCategory('thieves')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
            subCategory === 'thieves' ? 'bg-red-500/30 text-red-300 border border-red-400/30' : 'text-white/40'
          }`}
        >
          🥷 Notorious Stealers
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-10 text-white/40 text-xs">
          <Loader2 size={16} className="animate-spin text-amber-400" />
          <span>Loading leaderboard ranks…</span>
        </div>
      )}

      {entries.length === 0 && !isLoading && (
        <div className="glass rounded-2xl p-6 text-center text-white/40 text-xs">
          No rankings recorded yet in this category
        </div>
      )}

      {/* Leaderboard rows */}
      <div className="flex flex-col gap-2">
        {entries.map((e, i) => {
          const MEDALS = ['🥇', '🥈', '🥉'];
          const rankLabel = MEDALS[i] ?? `#${i + 1}`;

          return (
            <div
              key={e.userId}
              className={`glass rounded-2xl flex items-center justify-between gap-2.5 p-3 border transition-all ${
                e.isMe
                  ? 'border-violet-400/40 bg-violet-500/15'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              {/* Rank & Avatar */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 text-center font-black text-sm flex-shrink-0">
                  {rankLabel}
                </span>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-black font-black text-xs flex-shrink-0 shadow">
                  {(e.username[0] ?? '?').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-black truncate ${e.isMe ? 'text-violet-200' : 'text-white'}`}>
                    @{e.username}
                    {e.isMe && <span className="ml-1 text-[9px] text-violet-400 font-bold">(you)</span>}
                  </p>
                  <p className="text-amber-300 text-[10px] font-bold">
                    {subCategory === 'rich' ? formatGold(e.goldBalance) : `${formatGold(e.goldStolen ?? 0)} stolen`}
                  </p>
                </div>
              </div>

              {/* Actions */}
              {!e.isMe && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setPreview({ id: e.userId, name: e.username })}
                    className="p-1.5 rounded-xl glass hover:bg-white/15 active:scale-95 text-white/60 hover:text-white transition-all"
                    title="Preview Farm"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => onVisit(e.userId, e.username)}
                    className="flex items-center gap-1 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-black px-2.5 py-1.5 rounded-xl active:scale-95 hover:brightness-110 transition-all shadow"
                  >
                    <Zap size={10} />
                    <span>Visit</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Explore Modal ─────────────────────────────────────────────
export function ExploreModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('targets');
  const { profile } = useGame();

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
    exploreFarms.filter((e) => Number(e.ripePlots) > 0 && !friends.some((f) => f.userId === e.userId)).length;

  const handleVisit = (userId: string, username: string) => {
    eventBus.emit('visit-farm', { userId, username });
    onClose();
  };

  const dailySteals = profile?.dailyStealCount ?? 0;
  const maxSteals = profile?.maxDailySteals ?? 5;
  const stealsLeft = Math.max(0, maxSteals - dailySteals);
  const userEnergy = profile?.energy ?? 100;
  const maxEnergy = profile?.maxEnergy ?? 100;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'targets', label: 'Targets', icon: <Crosshair size={13} />, badge: stealableCount > 0 ? stealableCount : undefined },
    { id: 'search',  label: 'Search',  icon: <Search size={13} /> },
    { id: 'top',     label: 'Top Ranks', icon: <Trophy size={13} /> },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Modal Card Drawer */}
      <div
        className="relative w-full max-w-xl glass mx-auto rounded-t-3xl overflow-hidden slide-up flex flex-col border-t border-white/20 shadow-2xl"
        style={{
          maxHeight: 'calc(var(--tg-viewport-stable-height, 100vh) - 24px)',
          paddingBottom: 'max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="w-12 h-1 bg-white/25 rounded-full mx-auto mt-3 flex-shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌍</span>
            <div>
              <h2 className="text-white font-black text-base leading-none">World Explore</h2>
              <p className="text-white/40 text-xs mt-0.5">Scout, raid & cooperate with global farms</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all border border-white/10"
          >
            <X size={15} />
          </button>
        </div>

        {/* Quick Player Stat Bar */}
        <div className="px-5 mb-2.5 flex-shrink-0">
          <div className="glass rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/10 text-[11px]">
            {/* Steals Left */}
            <div className="flex items-center gap-1.5">
              <Hand size={11} className={stealsLeft > 0 ? 'text-red-400' : 'text-white/30'} />
              <span className="text-white/50">Steals:</span>
              <span className={`font-black ${stealsLeft > 0 ? 'text-white' : 'text-red-400'}`}>
                {dailySteals}/{maxSteals} used
              </span>
            </div>

            {/* Energy */}
            <div className="flex items-center gap-1.5">
              <Zap size={11} className="text-amber-400" />
              <span className="text-white/50">Energy:</span>
              <span className="font-black text-amber-300">
                {userEnergy}/{maxEnergy}
              </span>
            </div>

            {/* Trust Score */}
            <div className="flex items-center gap-1.5">
              <span className="text-violet-300 font-black">★</span>
              <span className="text-white/50">Trust:</span>
              <span className="font-black text-violet-300">
                {profile?.trustScore ?? 50}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 mb-3 flex-shrink-0">
          <div className="glass rounded-2xl flex p-1 gap-1 border border-white/10">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all ${
                  tab === t.id
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
                {t.badge != null && (
                  <span className="absolute -top-1 -right-0.5 bg-red-500 text-white text-[8px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center px-0.5 shadow-sm">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Body (Scrollable) */}
        <div className="overflow-y-auto flex-1 px-5 pb-4 flex flex-col gap-3">
          {tab === 'targets' && <TargetsTab onVisit={handleVisit} />}
          {tab === 'search'  && <SearchTab  onVisit={handleVisit} />}
          {tab === 'top'     && <TopTab     onVisit={handleVisit} />}
        </div>
      </div>
    </div>
  );
}
