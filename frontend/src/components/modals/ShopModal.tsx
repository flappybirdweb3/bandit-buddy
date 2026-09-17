import { useState, useMemo } from 'react';
import { SEED_EMOJI } from "@/constants/seeds";
import {
  X, Coins, Clock, TrendingUp, ShieldAlert, Sprout,
  Zap, Shield, Leaf, ShoppingBag, CheckCircle2, Loader2, Lock,
  ArrowUpCircle, Bot, Sparkles, AlertTriangle, Check
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useGame } from '@/providers/GameProvider';
import { eventBus } from '@/game/EventBus';
import { soundManager } from '@/sounds/SoundManager';
import type { ShopItemData, SeedConfig, NftBreed, ShopCategory } from '@/types/game.types';

interface Props {
  initialTab?: Tab;
  onClose: () => void;
}

type Tab = 'seeds' | 'energy' | 'defense' | 'boost' | 'upgrades';

const ITEM_EMOJI: Record<string, string> = {
  energy_sm:           '⚡',
  energy_lg:           '🔋',
  energy_tank:         '🧃',
  energy_tank_2:       '🫙',
  energy_tank_3:       '⚗️',
  pet_stray:           '🐶',
  pet_beagle:          '🐕',
  pet_husky:           '🐺',
  pet_shepherd:        '🦮',
  pet_elephant:        '🐘',
  fertilizer_normal:   '🌿',
  fertilizer_super:    '🚀',
  fertilizer_advanced: '💎',
  compost_basic:       '🌱',
  compost_premium:     '✨',
  butler:              '🤖',
  butler_7d:           '🤖',
  butler_30d:          '🤖',
  crop_insurance_7d:   '🛡️',
  insurance:           '🛡️',
};

// Tier order for guard pets (lowest → highest)
const GUARD_PET_TIER: Record<string, number> = {
  dog_stray: 0, dog_beagle: 1, dog_husky: 2, dog_shepherd: 3, elephant: 4,
  guard_pup: 0, guard_hound: 1,  // legacy
};

function isGuardPet(effectType: string) {
  return effectType in GUARD_PET_TIER;
}

const CAT_ICON: Record<Tab, React.ReactNode> = {
  seeds:    <Sprout size={14} />,
  energy:   <Zap size={14} />,
  defense:  <Shield size={14} />,
  boost:    <Leaf size={14} />,
  upgrades: <ArrowUpCircle size={14} />,
};

function fmtTime(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${(sec / 3600).toFixed(0)}h`;
}

function timeUntil(dateStr: string | Date) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

// ── Tab 1: Seeds ──────────────────────────────────────────────────
function SeedsTab({ seeds, gold, playerLevel, onClose }: {
  seeds: SeedConfig[]; gold: number; playerLevel: number; onClose: () => void;
}) {
  const handleSelect = (seedId: string, seedName: string) => {
    eventBus.emit('seed-preselected', { seedId, seedName });
    eventBus.emit('tool-changed', 'seed');
    onClose();
  };

  const uniqueSeeds = useMemo(() => {
    return seeds.filter((seed, index, self) =>
      index === self.findIndex((s) => s.id === seed.id || s.name === seed.name)
    );
  }, [seeds]);

  return (
    <div className="flex flex-col gap-3">
      {/* Global player explanation banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-start gap-2.5">
        <span className="text-xl">💡</span>
        <div className="flex-1 min-w-0">
          <p className="text-amber-300 text-xs font-bold leading-tight">Seed Planting System</p>
          <p className="text-white/60 text-[11px] mt-0.5 leading-snug">
            In BarnBuddy, seed gold cost is paid automatically upon planting on empty plots.
            Tap any unlocked seed to equip your planting tool!
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {uniqueSeeds.map((seed) => {
          const locked     = playerLevel < (seed.levelRequired ?? 0);
          const canAfford  = !locked && gold >= seed.costGold;
          const roi        = Math.round((seed.baseYield - seed.costGold) / Math.max(1, seed.costGold) * 100);
          const stealCap   = (seed.baseYield * 0.2).toFixed(0);
          const fmtHours   = (h: number) => h >= 1 ? `${h}h` : `${h * 60}m`;

          return (
            <button
              key={seed.id}
              disabled={locked || !canAfford}
              onClick={() => !locked && canAfford && handleSelect(seed.id, seed.name)}
              className={[
                'flex items-center justify-between gap-3 rounded-2xl p-3.5 text-left transition-all active:scale-[0.98]',
                locked
                  ? 'glass opacity-40 cursor-not-allowed'
                  : seed.isSeasonal
                  ? 'border-purple-500/40 bg-purple-950/20 shadow-[0_0_12px_rgba(168,85,247,0.15)] hover:border-purple-400/60'
                  : canAfford
                    ? 'glass hover:bg-white/10 border border-white/10 hover:border-green-500/40 shadow-sm'
                    : 'glass opacity-50 cursor-not-allowed',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex-shrink-0 flex items-center justify-center">
                  <span className={`text-3xl leading-none ${locked ? 'opacity-30' : ''}`}>
                    {SEED_EMOJI[seed.iconKey] ?? '🌿'}
                  </span>
                  {locked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                      <Lock size={13} className="text-white/70" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-white font-bold text-sm truncate">{seed.name}</span>
                    {seed.isSeasonal && (
                      <span className="text-[9px] font-black text-purple-200 bg-purple-500/30 border border-purple-400/50 rounded-full px-2 py-0.2 uppercase tracking-wider">
                        🍁 Seasonal
                      </span>
                    )}
                    {locked ? (
                      <span className="text-[10px] font-black text-red-300 bg-red-400/15 border border-red-400/30 rounded-full px-2 py-0.2">
                        Lv {seed.levelRequired}
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-amber-300 bg-amber-400/15 border border-amber-400/30 rounded-full px-2 py-0.2">
                        +{roi}% ROI
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <StatRow icon={<Coins size={11} className="text-amber-400" />} label={`${seed.costGold}G`} />
                    <StatRow icon={<TrendingUp size={11} className="text-green-400" />} label={`${seed.baseYield}G yield`} />
                    <StatRow icon={<Clock size={11} className="text-blue-400" />} label={fmtHours(Number(seed.growTimeHours))} />
                    <StatRow icon={<ShieldAlert size={11} className="text-red-400" />} label={`${stealCap}G cap`} />
                  </div>
                </div>
              </div>

              <div
                className={[
                  'flex-shrink-0 px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center',
                  locked
                    ? 'bg-white/5 text-white/30'
                    : canAfford
                      ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30',
                ].join(' ')}
              >
                {locked ? `Lv ${seed.levelRequired}` : canAfford ? 'Equip' : 'No gold'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab 2: Energy ─────────────────────────────────────────────────
function EnergyTab({
  items, gold, currentEnergy, maxEnergy, onBuy, buyingId
}: {
  items: ShopItemData[];
  gold: number;
  currentEnergy: number;
  maxEnergy: number;
  onBuy: (id: string) => void;
  buyingId: string | null;
}) {
  const energyPct = Math.min(100, Math.round((currentEnergy / Math.max(1, maxEnergy)) * 100));
  const isFull = currentEnergy >= maxEnergy;

  return (
    <div className="flex flex-col gap-3">
      {/* Current Energy Status Card */}
      <div className="glass rounded-2xl p-3.5 flex flex-col gap-2 border border-blue-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap size={16} className="text-blue-400" />
            <span className="text-white font-bold text-xs">Current Energy Reservoir</span>
          </div>
          <span className="text-blue-300 font-mono font-black text-sm">
            {currentEnergy} / {maxEnergy}⚡
          </span>
        </div>
        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isFull ? 'bg-green-400' : 'bg-gradient-to-r from-blue-500 to-cyan-400'
            }`}
            style={{ width: `${energyPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-white/40">
          <span>{isFull ? '⚡ Energy is full!' : `${maxEnergy - currentEnergy}⚡ needed to cap`}</span>
          <span>{energyPct}% Full</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const canAfford = gold >= item.costGold;
          const isBuying = buyingId === item.id;
          const willWaste = isFull;
          const actualGain = Math.min(item.effectValue, maxEnergy - currentEnergy);

          return (
            <div key={item.id} className="glass rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-2xl flex-shrink-0">
                  {ITEM_EMOJI[item.iconKey] ?? '⚡'}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm leading-tight">{item.name}</p>
                  <p className="text-white/40 text-[11px] mt-0.5 leading-snug">{item.description}</p>
                  {!isFull && actualGain < item.effectValue && (
                    <p className="text-cyan-300 text-[10px] mt-0.5">
                      Will restore +{actualGain}⚡ (capped at max)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1">
                  <Coins size={11} className="text-amber-400" />
                  <span className="text-amber-300 font-bold text-sm">{item.costGold}G</span>
                </div>
                {willWaste ? (
                  <button
                    disabled
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 text-white/30 cursor-not-allowed border border-white/5"
                  >
                    Full ⚡
                  </button>
                ) : (
                  <button
                    onClick={() => onBuy(item.id)}
                    disabled={!canAfford || isBuying}
                    className={[
                      'px-3.5 py-1.5 rounded-xl text-xs font-black active:scale-95 transition-all flex items-center gap-1',
                      canAfford && !isBuying
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-black shadow-sm'
                        : 'bg-white/10 text-white/30 cursor-not-allowed',
                    ].join(' ')}
                  >
                    {isBuying ? <Loader2 size={12} className="animate-spin" /> : 'Buy'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab 3: Defense ────────────────────────────────────────────────
function DefenseTab({
  items, gold, currentPetType, currentPetDefense, nftStatus, onBuy, buyingId
}: {
  items: ShopItemData[];
  gold: number;
  currentPetType: string | null;
  currentPetDefense: number;
  nftStatus?: { breedCount: number; ownedBreeds: NftBreed[]; totalNftDefense: number };
  onBuy: (id: string) => void;
  buyingId: string | null;
}) {
  const hasActivePet = currentPetType !== null;
  const tierLabels = ['Basic', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  const tierColors = ['text-gray-300', 'text-blue-300', 'text-purple-300', 'text-amber-300', 'text-rose-300'];

  return (
    <div className="flex flex-col gap-3">
      {/* Active Guard Status Banner */}
      {hasActivePet && (
        <div className="glass rounded-2xl p-3 flex items-center justify-between gap-3 border border-emerald-500/30 bg-emerald-500/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl">🛡️</span>
            <div className="min-w-0">
              <p className="text-emerald-300 text-xs font-black truncate">Active Guard Pet Deployed</p>
              <p className="text-white/60 text-[11px] mt-0.5 truncate">
                {items.find(i => i.effectType === currentPetType)?.name ?? currentPetType} · −{currentPetDefense}% steal rate
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex-shrink-0">
            Active ✓
          </span>
        </div>
      )}

      {/* Pet Tier List */}
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const isActive    = item.effectType === currentPetType;
          const currentRank = currentPetType ? (GUARD_PET_TIER[currentPetType] ?? -1) : -1;
          const itemRank    = GUARD_PET_TIER[item.effectType] ?? 0;
          const isDowngrade = currentRank > itemRank;
          const isUpgrade   = currentRank !== -1 && itemRank > currentRank;
          const canAfford   = gold >= item.costGold;
          const stealChance = Math.max(0, 80 - item.effectValue);
          const tierLabel   = tierLabels[itemRank] ?? 'Basic';
          const tierColor   = tierColors[itemRank] ?? 'text-white/60';
          const isBuying    = buyingId === item.id;

          return (
            <div
              key={item.id}
              className={[
                'glass rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all',
                isActive ? 'border border-emerald-500/40 bg-emerald-500/10' : isDowngrade ? 'opacity-40' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex-shrink-0 w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                  {ITEM_EMOJI[item.iconKey] ?? '🐕'}
                  {isActive && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={10} className="text-black" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white font-bold text-sm leading-tight">{item.name}</span>
                    <span className={`text-[10px] font-bold ${tierColor}`}>{tierLabel}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-white/40 text-[10px]">
                      Thief chance: <span className="text-amber-300 font-bold">{stealChance}%</span>
                    </span>
                    <span className="text-white/40 text-[10px]">
                      Def <span className="text-violet-300 font-bold">+{item.effectValue}%</span>
                    </span>
                  </div>
                  {stealChance === 0 && (
                    <p className="text-rose-300 text-[10px] font-bold mt-0.5">🛡️ Immune to theft!</p>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1">
                  <Coins size={11} className="text-amber-400" />
                  <span className="text-amber-300 font-bold text-xs">{item.costGold.toLocaleString()}G</span>
                </div>
                {isActive ? (
                  <div className="px-2.5 py-1 rounded-xl text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30">
                    Active ✓
                  </div>
                ) : isDowngrade ? (
                  <div className="px-2.5 py-1 rounded-xl text-[10px] font-bold text-white/30 bg-white/5">
                    Weaker
                  </div>
                ) : (
                  <button
                    onClick={() => onBuy(item.id)}
                    disabled={!canAfford || isBuying}
                    className={[
                      'px-3 py-1.5 rounded-xl text-xs font-black active:scale-95 transition-all flex items-center gap-1',
                      canAfford && !isBuying
                        ? isUpgrade
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-sm'
                          : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm'
                        : 'bg-white/10 text-white/30 cursor-not-allowed',
                    ].join(' ')}
                  >
                    {isBuying ? <Loader2 size={11} className="animate-spin" /> : isUpgrade ? 'Upgrade' : 'Buy'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-white/30 text-[10px] text-center">
        Note: Purchasing a higher tier Web2 guard pet replaces your current shop dog while keeping your on-chain NFT dogs intact.
      </p>

      {/* NFT Dogs Section */}
      {nftStatus && (
        <div className="mt-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-purple-300 text-[10px] font-black uppercase tracking-widest">
              On-Chain NFT Dogs
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {nftStatus.breedCount > 0 ? (
            <>
              {nftStatus.ownedBreeds.map((breed) => (
                <div key={breed.tokenId} className="glass rounded-xl px-3 py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl">🐕</span>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-xs">{breed.dogType}</p>
                      <p className="text-purple-300/60 text-[10px]">Token #{breed.tokenId}</p>
                    </div>
                  </div>
                  <span className="text-purple-300 font-bold text-xs">+{breed.defensePower}% Def</span>
                </div>
              ))}
              <div className="glass rounded-xl px-3 py-2 flex items-center justify-between border border-purple-400/20">
                <span className="text-white/60 text-xs">Total NFT Defense Bonus</span>
                <span className="text-purple-300 font-black text-xs">+{nftStatus.totalNftDefense}%</span>
              </div>
            </>
          ) : (
            <div className="glass rounded-xl p-3 text-center text-white/30 text-xs">
              No NFT guard dogs detected. Mint or sync in Kennel &amp; Settings!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Boost & Soil ───────────────────────────────────────────
function BoostTab({
  soilItems, boostItems, gold, onBuy, buyingId
}: {
  soilItems: ShopItemData[];
  boostItems: ShopItemData[];
  gold: number;
  onBuy: (id: string) => void;
  buyingId: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Soil Compost Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-base">🌱</span>
            <span className="text-white font-bold text-xs">Soil Care &amp; Compost</span>
          </div>
          <span className="text-emerald-400 text-[10px] font-bold">Restore depleted plots to 100%</span>
        </div>
        <div className="flex flex-col gap-2">
          {soilItems.map((item) => (
            <ShopItemRow
              key={item.id}
              item={item}
              gold={gold}
              onBuy={() => onBuy(item.id)}
              buying={buyingId === item.id}
            />
          ))}
        </div>
      </div>

      {/* Growth Fertilizers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-base">⚡</span>
            <span className="text-white font-bold text-xs">Growth Fertilizers</span>
          </div>
          <span className="text-amber-400 text-[10px] font-bold">−1h to −5h grow time</span>
        </div>
        <div className="flex flex-col gap-2">
          {boostItems.map((item) => (
            <ShopItemRow
              key={item.id}
              item={item}
              gold={gold}
              onBuy={() => onBuy(item.id)}
              buying={buyingId === item.id}
            />
          ))}
        </div>
      </div>

      {/* Attack Items info */}
      <div className="pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-[9px] font-extrabold uppercase tracking-widest">
            Neighbor Raid Tools
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { emoji: '🐛', name: 'Bag of Bugs', effect: '−20% harvest yield', color: 'border-red-400/30 bg-red-500/10' },
            { emoji: '🌿', name: 'Bag of Weeds', effect: '−30% harvest yield', color: 'border-lime-500/30 bg-lime-500/10' },
          ].map((a) => (
            <div key={a.name} className={`glass rounded-2xl p-3 flex flex-col items-center gap-1 border ${a.color}`}>
              <span className="text-3xl leading-none">{a.emoji}</span>
              <p className="text-white font-bold text-xs text-center mt-1">{a.name}</p>
              <p className="text-red-300 text-[10px] text-center">{a.effect}</p>
              <span className="text-[10px] text-amber-300 font-bold mt-1 bg-amber-400/15 border border-amber-400/25 px-2 py-0.2 rounded-full">
                15⚡ Energy · Free
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab 5: Upgrades & Subscriptions ───────────────────────────────
function UpgradesTab({
  subscriptionItems, upgradeItems, subscriptions, gold, seeds, playerLevel, onBuy, buyingId
}: {
  subscriptionItems: ShopItemData[];
  upgradeItems: ShopItemData[];
  subscriptions?: { type: string; expiresAt: string | Date }[];
  gold: number;
  seeds: SeedConfig[];
  playerLevel: number;
  onBuy: (id: string) => void;
  buyingId: string | null;
}) {
  const queryClient = useQueryClient();

  const { data: subStatus } = useQuery({
    queryKey: ['subscriptionStatus'],
    queryFn: api.getSubscriptionStatus,
    staleTime: 10_000,
  });

  const { mutate: updatePreferredSeed, isPending: isUpdatingSeed } = useMutation({
    mutationFn: (seedId: string | null) => api.setButlerPreferredSeed(seedId),
    onSuccess: (res) => {
      soundManager.play('click');
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
    },
  });

  const getSubExpiry = (effectType: string) => {
    const type = effectType.startsWith('butler') ? 'butler' : 'crop_insurance';
    const match = subscriptions?.find((s) => s.type === type);
    return match ? timeUntil(match.expiresAt) : null;
  };

  const hasButler = subStatus?.hasButler ?? subscriptions?.some((s) => s.type === 'butler');
  const preferredSeedId = subStatus?.butlerPreferredSeedId ?? null;
  const unlockedSeeds = useMemo(() => {
    return (seeds || []).filter((s) => (s.levelRequired ?? 0) <= playerLevel);
  }, [seeds, playerLevel]);

  return (
    <div className="flex flex-col gap-4">
      {/* Subscriptions / Automation */}
      {subscriptionItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Bot size={15} className="text-amber-400" />
              <span className="text-white font-bold text-xs">Farm Automation &amp; Insurance</span>
            </div>
            <span className="text-amber-400 text-[10px] font-bold">Auto-harvest &amp; protection</span>
          </div>

          <div className="flex flex-col gap-2">
            {subscriptionItems.map((item) => {
              const activeTimer = getSubExpiry(item.effectType);
              const isActive = activeTimer !== null;
              const canAfford = gold >= item.costGold;
              const isBuying = buyingId === item.id;

              return (
                <div key={item.id} className="glass rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-2xl flex-shrink-0">
                      {ITEM_EMOJI[item.iconKey] ?? '🤖'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-bold text-sm leading-tight">{item.name}</p>
                        {isActive && (
                          <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.2 rounded-full">
                            Active ({activeTimer})
                          </span>
                        )}
                      </div>
                      <p className="text-white/40 text-[11px] mt-0.5 leading-snug">{item.description}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1">
                      <Coins size={11} className="text-amber-400" />
                      <span className="text-amber-300 font-bold text-xs">{item.costGold.toLocaleString()}G</span>
                    </div>
                    <button
                      onClick={() => onBuy(item.id)}
                      disabled={!canAfford || isBuying}
                      className={[
                        'px-3 py-1.5 rounded-xl text-xs font-black active:scale-95 transition-all flex items-center gap-1',
                        canAfford && !isBuying
                          ? isActive
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 hover:bg-amber-400/30'
                            : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-sm'
                          : 'bg-white/10 text-white/30 cursor-not-allowed',
                      ].join(' ')}
                    >
                      {isBuying ? <Loader2 size={11} className="animate-spin" /> : isActive ? 'Extend' : 'Activate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barn Butler Priority Replanting Selector */}
          {hasButler && (
            <div className="mt-3 glass rounded-2xl p-3.5 border border-amber-400/25 bg-amber-500/10">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Bot size={14} className="text-amber-400" />
                  <span className="text-white font-black text-xs">Priority Replanting Crop</span>
                </div>
                {isUpdatingSeed && <Loader2 size={12} className="animate-spin text-amber-400" />}
              </div>
              <p className="text-white/50 text-[10px] mb-2.5 leading-snug">
                Barn Butler will automatically replant this chosen crop when empty plots become available. If gold falls below cost + 100G, it automatically falls back to Turnip.
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => updatePreferredSeed(null)}
                  disabled={isUpdatingSeed}
                  className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-0.5 active:scale-95 ${
                    !preferredSeedId
                      ? 'bg-amber-400/25 border-amber-400 text-amber-300 font-bold'
                      : 'border-white/10 glass text-white/60 hover:text-white'
                  }`}
                >
                  <span className="text-base">🔄</span>
                  <span className="text-[10px] font-bold truncate max-w-[65px]">Auto (Turnip)</span>
                </button>
                {unlockedSeeds.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updatePreferredSeed(s.id)}
                    disabled={isUpdatingSeed}
                    className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-0.5 active:scale-95 ${
                      preferredSeedId === s.id
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 font-bold'
                        : 'border-white/10 glass text-white/60 hover:text-white'
                    }`}
                  >
                    <span className="text-base">{SEED_EMOJI[s.name] ?? '🌱'}</span>
                    <span className="text-[10px] font-bold truncate max-w-[65px]">{s.name}</span>
                    <span className="text-[9px] text-white/40 font-mono">{s.costGold}G</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Permanent Upgrades */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ArrowUpCircle size={15} className="text-cyan-400" />
            <span className="text-white font-bold text-xs">Permanent Tank Upgrades</span>
          </div>
          <span className="text-cyan-300 text-[10px] font-bold">Max energy cap: 250⚡</span>
        </div>

        <div className="flex flex-col gap-2">
          {upgradeItems.map((item) => (
            <ShopItemRow
              key={item.id}
              item={item}
              gold={gold}
              onBuy={() => onBuy(item.id)}
              buying={buyingId === item.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Generic Shop Item Row ─────────────────────────────────────────
function ShopItemRow({
  item, gold, onBuy, buying
}: {
  item: ShopItemData; gold: number; onBuy: () => void; buying: boolean;
}) {
  const canAfford = gold >= item.costGold;
  const isSoldOut = item.soldOut;

  return (
    <div className={`glass rounded-2xl p-3.5 flex items-center justify-between gap-3 ${
      isSoldOut ? 'opacity-60' : ''
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
          {ITEM_EMOJI[item.iconKey] ?? '📦'}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-bold text-sm leading-tight">{item.name}</p>
            {isSoldOut && <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />}
          </div>
          <p className="text-white/40 text-[11px] mt-0.5 leading-snug">{item.description}</p>
          {item.maxOwned != null && !isSoldOut && (
            <p className="text-white/30 text-[10px] mt-0.5">Capacity: {item.owned}/{item.maxOwned}</p>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1">
          <Coins size={11} className="text-amber-400" />
          <span className="text-amber-300 font-bold text-xs">{item.costGold.toLocaleString()}G</span>
        </div>
        {isSoldOut ? (
          <div className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30">
            Maxed ✓
          </div>
        ) : (
          <button
            onClick={onBuy}
            disabled={!canAfford || buying}
            className={[
              'px-3.5 py-1.5 rounded-xl text-xs font-black active:scale-95 transition-all flex items-center gap-1',
              canAfford && !buying
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm'
                : 'bg-white/10 text-white/30 cursor-not-allowed',
            ].join(' ')}
          >
            {buying ? <Loader2 size={11} className="animate-spin" /> : 'Buy'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Shop Modal ───────────────────────────────────────────────
export function ShopModal({ initialTab = 'seeds', onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const { seeds, profile } = useGame();
  const queryClient = useQueryClient();

  const { data: catalog, isLoading } = useQuery({
    queryKey: ['shopItems'],
    queryFn: api.getShopItems,
    staleTime: 30_000,
  });

  const { data: nftStatus } = useQuery({
    queryKey: ['nftStatus'],
    queryFn: api.getNftStatus,
    enabled: !!profile?.walletAddress,
    staleTime: 5 * 60_000,
  });

  const gold            = catalog?.goldBalance ?? profile?.goldBalance ?? 0;
  const currentEnergy   = catalog?.energy ?? profile?.energy ?? 0;
  const maxEnergy       = catalog?.maxEnergy ?? profile?.maxEnergy ?? 100;
  const fertCharges     = catalog?.fertilizerCharges ?? 0;
  const playerLevel     = Math.max(0, Math.floor((profile?.trustScore ?? 0) / 10));

  const { mutate: buyItem } = useMutation({
    mutationFn: (itemId: string) => api.buyShopItem(itemId),
    onMutate: (itemId) => setBuyingId(itemId),
    onSettled: () => setBuyingId(null),
    onSuccess: (result) => {
      soundManager.play('coin');
      setToast({ text: result.message, type: 'success' });
      setTimeout(() => setToast(null), 3500);
      queryClient.invalidateQueries({ queryKey: ['shopItems'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['myFarm'] });
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['nftStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dailyQuests'] });
    },
    onError: (err: Error) => {
      setToast({ text: `❌ ${err.message}`, type: 'error' });
      setTimeout(() => setToast(null), 3500);
    },
  });

  const itemsByCategory = (cat: ShopCategory) => {
    return catalog?.items.filter((i) => i.category === cat) ?? [];
  };

  const currentPetType   = catalog?.currentPetType ?? null;
  const currentPetDefense = catalog?.currentPetDefense ?? 0;
  const defenseDogsBadge = currentPetType !== null ? 1 : undefined;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-zinc-950/95 border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden mx-auto slide-up"
        style={{
          maxHeight: 'calc(var(--tg-viewport-stable-height, 100vh) - 40px)',
          paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)) + 80px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer drag pill */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-300">
              <ShoppingBag size={19} />
            </div>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Shop &amp; Supplies</h2>
              <p className="text-white/40 text-xs">Spend GOLD to boost your farm</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Energy Pill */}
            <div className="glass rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 border border-blue-500/30">
              <Zap size={13} className="text-blue-400" />
              <span className="text-blue-300 font-mono font-black text-xs">
                {currentEnergy}/{maxEnergy}
              </span>
            </div>

            {/* Live Gold Pill */}
            <div className="glass-gold rounded-xl px-3 py-1.5 flex items-center gap-1.5 border border-amber-400/40">
              <Coins size={13} className="text-amber-400" />
              <span className="text-amber-300 font-black text-xs">{gold.toFixed(0)}G</span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-90"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-1 pb-3 flex-shrink-0">
          <div className="flex p-1 rounded-2xl bg-white/5 border border-white/10 gap-1">
            {(['seeds', 'energy', 'defense', 'boost', 'upgrades'] as Tab[]).map((t) => {
              const isActive = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 ${
                    isActive
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <span>{CAT_ICON[t]}</span>
                  <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                  {t === 'defense' && defenseDogsBadge && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-black' : 'bg-emerald-400'}`} />
                  )}
                  {t === 'boost' && fertCharges > 0 && (
                    <span className={`text-[10px] px-1 rounded-full font-bold ${isActive ? 'bg-black text-amber-300' : 'text-emerald-400'}`}>
                      {fertCharges}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toast Alert */}
        {toast && (
          <div
            className={`mx-5 mb-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 border shadow-md flex-shrink-0 transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                : 'bg-red-500/20 border-red-400/40 text-red-200'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={15} className="flex-shrink-0" /> : <AlertTriangle size={15} className="flex-shrink-0" />}
            <span className="truncate">{toast.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 px-5 pb-6">
          {isLoading && (
            <div className="flex items-center justify-center py-20 gap-2 text-white/40">
              <Loader2 size={18} className="animate-spin text-amber-400" />
              <span className="text-sm font-semibold">Loading shop supplies…</span>
            </div>
          )}

          {!isLoading && tab === 'seeds' && (
            <SeedsTab seeds={seeds} gold={gold} playerLevel={playerLevel} onClose={onClose} />
          )}

          {!isLoading && tab === 'energy' && (
            <EnergyTab
              items={itemsByCategory('energy')}
              gold={gold}
              currentEnergy={currentEnergy}
              maxEnergy={maxEnergy}
              onBuy={buyItem}
              buyingId={buyingId}
            />
          )}

          {!isLoading && tab === 'defense' && (
            <DefenseTab
              items={itemsByCategory('defense')}
              gold={gold}
              currentPetType={currentPetType}
              currentPetDefense={currentPetDefense}
              nftStatus={nftStatus}
              onBuy={buyItem}
              buyingId={buyingId}
            />
          )}

          {!isLoading && tab === 'boost' && (
            <BoostTab
              soilItems={itemsByCategory('soil')}
              boostItems={itemsByCategory('boost')}
              gold={gold}
              onBuy={buyItem}
              buyingId={buyingId}
            />
          )}

          {!isLoading && tab === 'upgrades' && (
            <UpgradesTab
              subscriptionItems={itemsByCategory('subscription')}
              upgradeItems={itemsByCategory('upgrades')}
              subscriptions={catalog?.subscriptions}
              gold={gold}
              seeds={seeds}
              playerLevel={playerLevel}
              onBuy={buyItem}
              buyingId={buyingId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {icon}
      <span className="text-white/50 text-[10px]">{label}</span>
    </div>
  );
}
