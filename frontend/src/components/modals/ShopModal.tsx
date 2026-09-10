import { useState } from 'react';
import { SEED_EMOJI } from "@/constants/seeds";
import {
  X, Coins, Clock, TrendingUp, ShieldAlert, Sprout,
  Zap, Shield, Leaf, ShoppingBag, CheckCircle2, Loader2, Lock, ArrowUpCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useGame } from '@/providers/GameProvider';
import { eventBus } from '@/game/EventBus';
import { soundManager } from '@/sounds/SoundManager';
import type { ShopItemData, SeedConfig, NftBreed } from '@/types/game.types';

interface Props { onClose: () => void }

type Tab = 'seeds' | 'energy' | 'defense' | 'boost' | 'upgrades';

const ITEM_EMOJI: Record<string, string> = {
  energy_sm:           '⚡',
  energy_lg:           '🔋',
  energy_tank:         '🧃',
  energy_tank_2:       '🫙',
  energy_tank_3:       '⚗️',
  // legacy
  dog_pup:             '🐕',
  dog_hound:           '🐺',
  // new 5-tier guard pets
  pet_stray:           '🐶',
  pet_beagle:          '🐕',
  pet_husky:           '🐺',
  pet_shepherd:        '🦮',
  pet_elephant:        '🐘',
  fertilizer_normal:   '🌿',
  fertilizer_super:    '🚀',
  fertilizer_advanced: '💎',
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
  seeds:    <Sprout size={13} />,
  energy:   <Zap size={13} />,
  defense:  <Shield size={13} />,
  boost:    <Leaf size={13} />,
  upgrades: <ArrowUpCircle size={13} />,
};

function fmtTime(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${(sec / 3600).toFixed(0)}h`;
}

function TabBtn({ id, active, label, icon, badge, onClick }: {
  id: string; active: boolean; label: string; icon: React.ReactNode;
  badge?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition-all ${
        active ? 'bg-white/15 text-white' : 'text-white/40'
      }`}
    >
      {icon} {label}
      {badge != null && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full text-[9px] font-black text-black flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Seed tab ──────────────────────────────────────────────────────
function SeedsTab({ seeds, gold, playerLevel, onClose }: {
  seeds: SeedConfig[]; gold: number; playerLevel: number; onClose: () => void;
}) {
  const handleSelect = (seedId: string, seedName: string) => {
    eventBus.emit('seed-preselected', { seedId, seedName });
    eventBus.emit('tool-changed', 'seed');
    onClose();
  };

  return (
    <div className="flex flex-col gap-2.5">
      {seeds.map((seed) => {
        const locked     = playerLevel < (seed.levelRequired ?? 0);
        const canAfford  = !locked && gold >= seed.costGold;
        const roi        = Math.round((seed.baseYield - seed.costGold) / seed.costGold * 100);
        const stealCap   = (seed.baseYield * 0.2).toFixed(0);
        const fmtHours   = (h: number) => h >= 1 ? `${h}h` : `${h * 60}m`;

        return (
          <button
            key={seed.id}
            disabled={locked || !canAfford}
            onClick={() => !locked && canAfford && handleSelect(seed.id, seed.name)}
            className={[
              'flex items-center gap-4 rounded-2xl p-3.5 text-left transition-all active:scale-[0.98]',
              locked
                ? 'glass opacity-40 cursor-not-allowed'
                : canAfford
                  ? 'glass hover:bg-white/10 border border-white/10 hover:border-green-500/40'
                  : 'glass opacity-50 cursor-not-allowed',
            ].join(' ')}
          >
            <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
              <span className={`text-4xl leading-none ${locked ? 'opacity-30' : ''}`}>{SEED_EMOJI[seed.iconKey] ?? '🌿'}</span>
              {locked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                    <Lock size={12} className="text-white/60" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-white font-black text-sm">{seed.name}</span>
                {locked ? (
                  <span className="text-[10px] font-bold text-red-300 bg-red-400/15 border border-red-400/30 rounded-full px-1.5 py-0.5">
                    Lv {seed.levelRequired}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-400/15 border border-amber-400/30 rounded-full px-1.5 py-0.5">
                    +{roi}% ROI
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <StatRow icon={<Coins size={10} className="text-amber-400" />} label={`${seed.costGold}G`} />
                <StatRow icon={<TrendingUp size={10} className="text-green-400" />} label={`${seed.baseYield}G yield`} />
                <StatRow icon={<Clock size={10} className="text-blue-400" />} label={fmtHours(Number(seed.growTimeHours))} />
                <StatRow icon={<ShieldAlert size={10} className="text-red-400" />} label={`${stealCap}G cap`} />
              </div>
            </div>
            <div className={[
              'flex-shrink-0 px-3 py-2 rounded-xl text-xs font-black',
              locked
                ? 'bg-white/5 text-white/30'
                : canAfford
                  ? 'bg-green-500/25 text-green-300 border border-green-500/40'
                  : 'bg-red-500/20 text-red-400',
            ].join(' ')}>
              {locked ? `Lv ${seed.levelRequired}` : canAfford ? 'Select' : 'No gold'}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Guard pet tier card ───────────────────────────────────────────
function GuardPetCard({ item, gold, currentPetType, onBuy, buying }: {
  item: ShopItemData; gold: number; currentPetType: string | null;
  onBuy: () => void; buying: boolean;
}) {
  const isActive    = item.effectType === currentPetType;
  const currentRank = currentPetType ? (GUARD_PET_TIER[currentPetType] ?? -1) : -1;
  const itemRank    = GUARD_PET_TIER[item.effectType] ?? 0;
  const isDowngrade = currentRank > itemRank;
  const isUpgrade   = currentRank !== -1 && itemRank > currentRank;
  const canAfford   = gold >= item.costGold;
  const stealChance = Math.max(0, 80 - item.effectValue);

  const tierLabels = ['Basic', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  const tierColors = [
    'text-gray-300',
    'text-blue-300',
    'text-purple-300',
    'text-amber-300',
    'text-rose-300',
  ];
  const tierLabel = tierLabels[itemRank] ?? 'Basic';
  const tierColor = tierColors[itemRank] ?? 'text-white/60';

  return (
    <div className={[
      'glass rounded-2xl p-3.5 flex items-center gap-3 transition-all',
      isActive ? 'border border-green-400/40 bg-green-500/10' :
      isDowngrade ? 'opacity-40' : '',
    ].join(' ')}>
      {/* Emoji + tier */}
      <div className="relative flex-shrink-0 w-12 h-12 flex items-center justify-center">
        <span className="text-3xl leading-none">{ITEM_EMOJI[item.iconKey] ?? '🐕'}</span>
        {isActive && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full flex items-center justify-center">
            <CheckCircle2 size={10} className="text-black" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-black text-sm">{item.name}</span>
          <span className={`text-[10px] font-bold ${tierColor}`}>{tierLabel}</span>
          {isActive && <span className="text-[10px] font-bold text-green-400 bg-green-400/15 px-1.5 py-0.5 rounded-full">Active</span>}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-white/40 text-[10px]">
            <span className="text-amber-300 font-bold">{stealChance}%</span> steal chance
          </span>
          <span className="text-white/40 text-[10px]">
            Defense <span className="text-violet-300 font-bold">{item.effectValue}%</span>
          </span>
        </div>
        {stealChance === 0 && (
          <p className="text-rose-300 text-[10px] font-bold mt-0.5">🛡️ Immune to theft!</p>
        )}
      </div>

      {/* Buy/Upgrade button */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <Coins size={10} className="text-amber-400" />
          <span className="text-amber-300 font-bold text-xs">
            {item.costGold >= 1000 ? `${(item.costGold / 1000).toFixed(0)}k` : item.costGold}G
          </span>
        </div>
        {isActive ? (
          <div className="px-2.5 py-1 rounded-xl text-[10px] font-bold text-green-400 bg-green-400/10 border border-green-400/30">
            Active ✓
          </div>
        ) : isDowngrade ? (
          <div className="px-2.5 py-1 rounded-xl text-[10px] font-bold text-white/20 bg-white/5">
            Weaker
          </div>
        ) : (
          <button
            onClick={onBuy}
            disabled={!canAfford || buying}
            className={[
              'px-2.5 py-1 rounded-xl text-[10px] font-black active:scale-90 transition-all',
              canAfford && !buying
                ? isUpgrade
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black'
                  : 'bg-gradient-to-r from-violet-600 to-purple-500 text-white'
                : 'glass text-white/30 cursor-not-allowed',
            ].join(' ')}
          >
            {buying ? <Loader2 size={10} className="animate-spin" /> : isUpgrade ? 'Upgrade' : 'Buy'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Shop item card (energy / boost) ──────────────────────────────
function ItemCard({ item, gold, onBuy, buying }: {
  item: ShopItemData; gold: number; onBuy: () => void; buying: boolean;
}) {
  const canAfford = gold >= item.costGold;
  const isSoldOut = item.soldOut;

  return (
    <div className={`glass rounded-2xl p-4 flex items-center gap-3 transition-all ${
      isSoldOut ? 'opacity-60' : ''
    }`}>
      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
        {ITEM_EMOJI[item.iconKey] ?? '📦'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white font-bold text-sm">{item.name}</p>
          {isSoldOut && <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />}
        </div>
        <p className="text-white/40 text-[11px] mt-0.5 leading-tight">{item.description}</p>
        {item.maxOwned != null && !isSoldOut && (
          <p className="text-white/25 text-[10px] mt-1">Owned: {item.owned}/{item.maxOwned}</p>
        )}
        {(item.effectType === 'fertilizer_normal' || item.effectType === 'fertilizer_super' || item.effectType === 'fertilizer_advanced') && item.owned > 0 && (
          <p className="text-green-400 text-[10px] mt-1 font-semibold">
            {ITEM_EMOJI[item.iconKey] ?? '🌿'} {item.owned} charge{item.owned !== 1 ? 's' : ''} ready
          </p>
        )}
      </div>

      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1">
          <Coins size={11} className="text-amber-400" />
          <span className="text-amber-300 font-bold text-sm">{item.costGold}G</span>
        </div>
        {isSoldOut ? (
          <div className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-green-400 bg-green-400/10 border border-green-400/30">
            Owned
          </div>
        ) : (
          <button
            onClick={onBuy}
            disabled={!canAfford || buying}
            className={[
              'px-3 py-1.5 rounded-xl text-[11px] font-black active:scale-90 transition-all',
              canAfford && !buying
                ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white'
                : 'glass text-white/30 cursor-not-allowed',
            ].join(' ')}
          >
            {buying ? <Loader2 size={12} className="animate-spin" /> : 'Buy'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────
export function ShopModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('seeds');
  const [toast, setToast] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const { seeds, profile } = useGame();
  const queryClient = useQueryClient();

  const { data: catalog } = useQuery({
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

  const gold = catalog?.goldBalance ?? profile?.goldBalance ?? 0;
  const fertCharges = catalog?.fertilizerCharges ?? 0;
  const normalCharges   = catalog?.normalFertCharges ?? 0;
  const superCharges    = catalog?.superFertCharges ?? 0;
  const advancedCharges = catalog?.advancedFertCharges ?? 0;
  const playerLevel = Math.max(0, Math.floor((profile?.trustScore ?? 0) / 10));

  const { mutate: buyItem } = useMutation({
    mutationFn: (itemId: string) => api.buyShopItem(itemId),
    onMutate: (itemId) => setBuyingId(itemId),
    onSettled: () => setBuyingId(null),
    onSuccess: (result) => {
      soundManager.play('coin');
      setToast(result.message);
      setTimeout(() => setToast(null), 3000);
      queryClient.invalidateQueries({ queryKey: ['shopItems'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => {
      setToast(`❌ ${err.message}`);
      setTimeout(() => setToast(null), 3000);
    },
  });

  const itemsByCategory = (cat: ShopCategory) =>
    catalog?.items.filter((i) => i.category === cat) ?? [];

  const currentPetType = catalog?.currentPetType ?? null;
  const hasActivePet   = currentPetType !== null;
  const defenseDogs    = hasActivePet ? 1 : 0;

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
            <ShoppingBag size={18} className="text-violet-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Shop</h2>
              <p className="text-white/40 text-xs">Spend your GOLD wisely</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fertCharges > 0 && (
              <div className="glass rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                {normalCharges > 0 && <span className="text-green-300 font-bold text-xs">🌿{normalCharges}</span>}
                {superCharges > 0  && <span className="text-blue-300 font-bold text-xs">🚀{superCharges}</span>}
                {advancedCharges > 0 && <span className="text-violet-300 font-bold text-xs">💎{advancedCharges}</span>}
              </div>
            )}
            <div className="glass-gold rounded-xl px-3 py-1.5 flex items-center gap-1.5">
              <Coins size={13} className="text-amber-400" />
              <span className="text-amber-300 font-bold text-sm">{gold.toFixed(0)}G</span>
            </div>
            <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="glass rounded-2xl flex p-1 mx-5 mb-3 flex-shrink-0">
          {(['seeds', 'energy', 'defense', 'boost', 'upgrades'] as Tab[]).map((t) => (
            <TabBtn
              key={t}
              id={t}
              active={tab === t}
              label={t.charAt(0).toUpperCase() + t.slice(1)}
              icon={CAT_ICON[t]}
              badge={t === 'defense' ? defenseDogs : undefined}
              onClick={() => setTab(t)}
            />
          ))}
        </div>

        {/* Toast */}
        {toast && (
          <div className={`mx-5 mb-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-center flex-shrink-0 ${
            toast.startsWith('❌')
              ? 'bg-red-500/20 border border-red-400/40 text-red-300'
              : 'bg-green-500/20 border border-green-400/40 text-green-300'
          }`}>
            {toast}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 pb-8 flex flex-col gap-3">
          {tab === 'seeds' && (
            <SeedsTab seeds={seeds} gold={gold} playerLevel={playerLevel} onClose={onClose} />
          )}

          {/* Defense tab — guard pet tier list */}
          {tab === 'defense' && (
            <>
              {hasActivePet && (
                <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 border border-green-400/25">
                  <span className="text-green-400 text-xs font-bold">🛡️ Active Guard:</span>
                  <span className="text-white/70 text-xs">
                    {ITEM_EMOJI[catalog?.items.find(i => i.effectType === currentPetType)?.iconKey ?? ''] ?? '🐕'} {' '}
                    {catalog?.items.find(i => i.effectType === currentPetType)?.name ?? currentPetType}
                    {' '}— {catalog?.currentPetDefense ?? 0}% defense
                  </span>
                </div>
              )}
              {itemsByCategory('defense').map((item) => (
                <GuardPetCard
                  key={item.id}
                  item={item}
                  gold={gold}
                  currentPetType={currentPetType}
                  onBuy={() => buyItem(item.id)}
                  buying={buyingId === item.id}
                />
              ))}
              <p className="text-white/20 text-[10px] text-center mt-1">
                Buying a higher tier auto-replaces current guard pet
              </p>

              {/* NFT Guard Dogs section */}
              {nftStatus && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-white/25 text-[9px] font-bold uppercase tracking-widest">NFT Dogs</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  {nftStatus.breedCount > 0 ? (
                    <>
                      {nftStatus.ownedBreeds.map((breed) => (
                        <ShopNftDogRow key={breed.tokenId} breed={breed} />
                      ))}
                      <div className="glass rounded-xl px-3 py-2 flex items-center justify-between mt-2">
                        <span className="text-white/40 text-[11px]">NFT defense bonus</span>
                        <span className="text-violet-300 font-bold text-sm">+{nftStatus.totalNftDefense}%</span>
                      </div>
                    </>
                  ) : (
                    <div className="glass rounded-xl px-3 py-3 text-center">
                      <p className="text-white/25 text-xs">No NFT guard dogs — sync in Settings</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Energy / Boost / Upgrades tabs */}
          {(tab === 'energy' || tab === 'boost' || tab === 'upgrades') && itemsByCategory(tab).map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              gold={gold}
              onBuy={() => buyItem(item.id)}
              buying={buyingId === item.id}
            />
          ))}

          {/* Upgrades tab description */}
          {tab === 'upgrades' && (
            <p className="text-white/20 text-[10px] text-center mt-1">
              Permanent upgrades · Max energy cap: 250⚡
            </p>
          )}

          {/* Attack items — free, shown in boost tab */}
          {tab === 'boost' && (
            <div className="mt-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/25 text-[9px] font-bold uppercase tracking-widest">Attack Items</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { emoji: '🐛', name: 'Bag of Bugs', effect: '−20% harvest yield', color: 'border-red-400/30 bg-red-500/8' },
                  { emoji: '🌿', name: 'Bag of Weeds', effect: '−30% harvest yield', color: 'border-lime-500/30 bg-lime-500/8' },
                ].map((a) => (
                  <div key={a.name} className={`glass rounded-2xl p-3 flex flex-col items-center gap-1.5 border ${a.color}`}>
                    <span className="text-3xl leading-none">{a.emoji}</span>
                    <p className="text-white font-bold text-xs text-center">{a.name}</p>
                    <p className="text-red-300/80 text-[10px] text-center">{a.effect}</p>
                    <div className="flex items-center gap-1 mt-0.5 bg-amber-400/15 border border-amber-400/30 rounded-full px-2 py-0.5">
                      <Zap size={9} className="text-amber-400" />
                      <span className="text-amber-300 text-[10px] font-bold">15 energy · Free</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-white/20 text-[10px] text-center mt-2">
                Visit a friend's farm → tap a growing crop to attack
              </p>
            </div>
          )}

          {tab !== 'seeds' && itemsByCategory(tab as ShopCategory).length === 0 && (
            <div className="text-center py-12 text-white/30 text-sm">Loading…</div>
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

type ShopCategory = 'energy' | 'defense' | 'boost' | 'upgrades';

const NFT_DOG_EMOJI: Record<string, string> = {
  Chihuahua: '🐕', Corgi: '🦊', Husky: '🐺',
  Rottweiler: '🦮', Doberman: '🐾', Pitbull: '💀',
};

function ShopNftDogRow({ breed }: { breed: NftBreed }) {
  return (
    <div className="glass rounded-xl px-3 py-2 flex items-center gap-3 mb-2">
      <span className="text-lg flex-shrink-0">{NFT_DOG_EMOJI[breed.dogType] ?? '🐕'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white/70 text-sm font-semibold leading-tight">{breed.dogType}</p>
        <p className="text-violet-300/60 text-[10px]">NFT · Token #{breed.tokenId}</p>
      </div>
      <span className="text-violet-300 font-bold text-sm flex-shrink-0">{breed.defensePower}%</span>
    </div>
  );
}
