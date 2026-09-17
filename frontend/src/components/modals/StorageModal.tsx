import { useState, useMemo } from 'react';
import {
  X, Warehouse, Loader2, CheckCircle2, RefreshCw, ShoppingBag,
  ExternalLink, Sparkles, AlertTriangle, Package, Shield,
  Coins, ArrowRight, Store, Drumstick
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createWalletClient, createPublicClient, http, parseAbi,
} from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { getStoredWalletPk } from '@/hooks/useAutoWallet';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { BarnData, BarnDog, InventoryItem, MarketplaceListing } from '@/types/game.types';

interface Props {
  onClose: () => void;
}

type Tab = 'crops' | 'consumables' | 'dogs';

const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const GACHA_ADDRESS = (import.meta.env.VITE_GACHA_CONTRACT_ADDRESS || '0x8fdD78C87793084384257fe14Fe448E12220e9d6') as `0x${string}`;
const FARM_ADDRESS  = (import.meta.env.VITE_FARM_TOKEN_ADDRESS     || '0xB10067A034078E3FC8335Fb003eEF7334C44952f') as `0x${string}`;

const FUSION_ABI = parseAbi([
  'function tokenizeDog(uint256 count, uint256 nonce, bytes calldata sig) external payable',
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 value) external returns (bool)',
]);

// ── Display constants ─────────────────────────────────────────────────────────

const ITEM_ICONS: Record<string, string> = {
  crop_turnip: '🌱', crop_carrot: '🥕', crop_corn: '🌽', crop_potato: '🥔',
  crop_eggplant: '🍆', crop_tomato: '🍅', crop_pea: '🫛', crop_watermelon: '🍉',
  crop_strawberry: '🍓', crop_pumpkin: '🎃', crop_grape: '🍇', crop_sunflower: '🌻',
  crop_rose: '🌹', crop_wheat: '🌾', crop_pumpkin_demon: '👺', crop_lucky_peach: '🍑',
  crate_turnip: '📦', crate_carrot: '📦', crate_corn: '📦', crate_potato: '📦',
  crate_eggplant: '📦', crate_tomato: '📦', crate_pea: '📦', crate_watermelon: '📦',
  crate_strawberry: '📦', crate_pumpkin: '📦', crate_grape: '📦', crate_sunflower: '📦',
  crate_rose: '📦', crate_wheat: '📦', crate_pumpkin_demon: '📦', crate_lucky_peach: '📦',
  seed_rose: '🌱', seed_sunflower: '🌱', seed_pumpkin_demon: '🌱', seed_lucky_peach: '🌱',
  magnifying_glass: '🔍', master_key: '🗝️', soul_shard: '💎',
};

const ITEM_LABELS: Record<string, string> = {
  crop_turnip: 'Turnip', crop_carrot: 'Carrot', crop_corn: 'Corn',
  crop_potato: 'Potato', crop_eggplant: 'Eggplant', crop_tomato: 'Tomato',
  crop_pea: 'Pea', crop_watermelon: 'Watermelon', crop_strawberry: 'Strawberry',
  crop_pumpkin: 'Pumpkin', crop_grape: 'Grape', crop_sunflower: 'Sunflower',
  crop_rose: 'Rose', crop_wheat: 'Wheat',
  crop_pumpkin_demon: 'Demon Pumpkin', crop_lucky_peach: 'Lucky Peach',
  crate_turnip: 'Turnip Crate', crate_carrot: 'Carrot Crate', crate_corn: 'Corn Crate',
  crate_potato: 'Potato Crate', crate_eggplant: 'Eggplant Crate', crate_tomato: 'Tomato Crate',
  crate_pea: 'Pea Crate', crate_watermelon: 'Watermelon Crate', crate_strawberry: 'Strawberry Crate',
  crate_pumpkin: 'Pumpkin Crate', crate_grape: 'Grape Crate', crate_sunflower: 'Sunflower Crate',
  crate_rose: 'Rose Crate', crate_wheat: 'Wheat Crate',
  crate_pumpkin_demon: 'Demon Pumpkin Crate', crate_lucky_peach: 'Lucky Peach Crate',
  seed_rose: 'Rose Seed', seed_sunflower: 'Sunflower Seed',
  seed_pumpkin_demon: 'Demon Pumpkin Seed', seed_lucky_peach: 'Lucky Peach Seed',
  magnifying_glass: 'Magnifying Glass', master_key: 'Master Key', soul_shard: 'Soul Shard',
};

const CROP_PACK_SIZE: Record<string, number> = {
  turnip: 100, carrot: 200, corn: 100, potato: 100, eggplant: 100, tomato: 100,
  pea: 100, watermelon: 50, strawberry: 50, pumpkin: 50, grape: 50,
  sunflower: 20, rose: 20, wheat: 500, pumpkin_demon: 20, lucky_peach: 20,
};

const DOG_NAMES: Record<number, string> = {
  1: 'Chihuahua', 2: 'Corgi', 3: 'Husky',
  4: 'Rottweiler', 5: 'Doberman', 6: 'Pitbull',
};
const DOG_EMOJIS: Record<number, string> = {
  1: '🐶', 2: '🐕', 3: '🐺', 4: '🦮', 5: '🐩', 6: '💪',
};

const DEADLINE_OPTIONS = [
  { label: '6h',     days: 0.25 },
  { label: '1 day',  days: 1 },
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
];

function itemIcon(t: string)  { return ITEM_ICONS[t]  ?? '📦'; }
function itemLabel(t: string) { return ITEM_LABELS[t] ?? t; }
function cropKey(t: string)   { return t.replace(/^(crate_|crop_)/, ''); }

function timeUntil(dateStr: string | Date) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

// ── Dog Hunger Helper ─────────────────────────────────────────────────────────
function getDogHunger(lastFedAt: string | Date | null | undefined) {
  if (!lastFedAt) {
    return { status: 'hungry' as const, mult: 0.5, label: 'Hungry (-50% Def)', hoursLeft: 0, canFeed: true };
  }
  const fedTime = new Date(lastFedAt).getTime();
  if (isNaN(fedTime) || fedTime <= 0) {
    return { status: 'hungry' as const, mult: 0.5, label: 'Hungry (-50% Def)', hoursLeft: 0, canFeed: true };
  }
  const hoursSince = (Date.now() - fedTime) / 3_600_000;
  if (hoursSince < 23) {
    const hoursLeft = Math.max(1, Math.ceil(23 - hoursSince));
    return { status: 'fed' as const, mult: 1.0, label: 'Well Fed', hoursLeft, canFeed: false };
  }
  if (hoursSince < 48) {
    return { status: 'hungry' as const, mult: 0.5, label: 'Hungry (-50% Def)', hoursLeft: 0, canFeed: true };
  }
  return { status: 'starving' as const, mult: 0.0, label: 'Starving (0% Def)', hoursLeft: 0, canFeed: true };
}

// ── Active Listing Badge ──────────────────────────────────────────────────────
function ActiveListingBadge({
  listing,
  onCancel,
  canceling,
}: {
  listing: MarketplaceListing;
  onCancel: () => void;
  canceling: boolean;
}) {
  return (
    <div className="mt-2 rounded-xl p-2.5 bg-amber-500/15 border border-amber-400/40 flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] bg-amber-400/30 text-amber-200 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
            🏷️ Listed on Market
          </span>
          <span className="text-amber-200 text-xs font-bold">
            x{listing.quantity} · {Number(listing.priceFarm).toLocaleString()} GOLD
          </span>
        </div>
        <p className="text-white/50 text-[10px] mt-0.5">
          Expires in: {timeUntil(listing.deadline)}
        </p>
      </div>
      <button
        disabled={canceling}
        onClick={onCancel}
        className="px-3 py-1.5 rounded-lg bg-red-500/25 hover:bg-red-500/35 text-red-300 border border-red-500/40 text-xs font-bold active:scale-95 transition-all flex items-center gap-1 flex-shrink-0 disabled:opacity-40"
      >
        {canceling ? <Loader2 size={11} className="animate-spin" /> : null}
        Cancel
      </button>
    </div>
  );
}

// ── Inline listing form ───────────────────────────────────────────────────────
function InlineListingForm({
  itemType, maxQty, onClose,
}: { itemType: string; maxQty: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [qty, setQty]         = useState(maxQty > 0 ? '1' : '0');
  const [price, setPrice]     = useState('');
  const [deadline, setDeadline] = useState(1);

  const listMut = useMutation({
    mutationFn: (data: { itemType: string; quantity: number; priceFarm: number; deadline: string }) =>
      api.createItemListing(data),
    onSuccess: () => {
      eventBus.emit('play-sound', 'quest');
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['crop-market-listings'] });
      queryClient.invalidateQueries({ queryKey: ['tool-market-listings'] });
      onClose();
    },
  });

  const numQty = parseInt(qty, 10);
  const isValidQty = !isNaN(numQty) && numQty >= 1 && numQty <= maxQty;
  const numPrice = Number(price);
  const isValidPrice = !isNaN(numPrice) && numPrice > 0;
  const canSubmit = maxQty > 0 && isValidQty && isValidPrice && !listMut.isPending;

  return (
    <div className="mt-2 border-t border-white/10 pt-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between pb-1 border-b border-white/5">
        <span className="text-white/80 text-xs font-bold flex items-center gap-1.5">
          <span>{itemIcon(itemType)}</span>
          <span>{itemLabel(itemType)}</span>
        </span>
        <span className={`text-[10px] font-mono font-bold ${maxQty > 0 ? 'text-amber-300' : 'text-red-400'}`}>
          {maxQty > 0 ? `${maxQty} available to sell` : '0 available (out of stock)'}
        </span>
      </div>

      {maxQty <= 0 && (
        <p className="text-red-400 text-[10px] bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          ⚠️ You do not have any unlocked {itemLabel(itemType)} available to list.
        </p>
      )}

      {listMut.error && (
        <p className="text-red-400 text-[10px]">❌ {(listMut.error as Error).message}</p>
      )}
      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-white/30 text-[9px] mb-1">Quantity (max {maxQty})</p>
          <div className="glass rounded-lg flex items-center px-2 gap-1">
            <input
              type="number"
              min={1}
              max={maxQty}
              value={qty}
              disabled={maxQty <= 0}
              onChange={e => setQty(e.target.value)}
              className="flex-1 bg-transparent text-white text-xs py-1.5 outline-none w-0 disabled:opacity-40"
            />
          </div>
          {qty && !isValidQty && maxQty > 0 && (
            <p className="text-red-400 text-[8px] mt-0.5">Must be 1 to {maxQty}</p>
          )}
        </div>
        <div className="flex-1">
          <p className="text-white/30 text-[9px] mb-1">Price (GOLD)</p>
          <div className="glass rounded-lg flex items-center px-2 gap-1">
            <input
              type="number"
              min={1}
              value={price}
              disabled={maxQty <= 0}
              onChange={e => setPrice(e.target.value)}
              placeholder="0"
              className="flex-1 bg-transparent text-white text-xs py-1.5 outline-none w-0 placeholder:text-white/20 disabled:opacity-40"
            />
            <span className="text-white/30 text-[9px]">G</span>
          </div>
          {price && !isValidPrice && (
            <p className="text-red-400 text-[8px] mt-0.5">Price must be &gt; 0</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {DEADLINE_OPTIONS.map(opt => (
          <button
            key={opt.days}
            onClick={() => setDeadline(opt.days)}
            disabled={maxQty <= 0}
            className={`py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${
              deadline === opt.days
                ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40'
                : 'glass text-white/40'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        disabled={!canSubmit}
        onClick={() => listMut.mutate({
          itemType,
          quantity: numQty,
          priceFarm: numPrice,
          deadline: new Date(Date.now() + deadline * 86_400_000).toISOString(),
        })}
        className="py-2 rounded-xl font-bold text-xs active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-600/30"
      >
        {listMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <ShoppingBag size={11} />}
        Create Listing
      </button>
    </div>
  );
}

// ── Tab 1: Crops & Seeds ──────────────────────────────────────────────────────
function CropsAndSeedsTab({ barnData }: { barnData: BarnData }) {
  const queryClient = useQueryClient();
  const [packCounts, setPackCounts] = useState<Record<string, number>>({});
  const [listingItem, setListingItem] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const { data: myListings = [] } = useQuery({
    queryKey: ['my-marketplace-listings'],
    queryFn: api.getMyMarketplaceListings,
    staleTime: 15_000,
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => {
      setCancelingId(id);
      return api.cancelMarketplaceListing(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['crop-market-listings'] });
      setCancelingId(null);
      setFeedbackMsg({ text: 'Listing cancelled! Items returned to storage.', type: 'success' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
    onError: (err: any) => {
      setCancelingId(null);
      setFeedbackMsg({ text: `Failed to cancel: ${err?.message || 'Unknown error'}`, type: 'error' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
  });

  const sellMut = useMutation({
    mutationFn: ({ itemType, quantity }: { itemType: string; quantity: number }) =>
      api.sellCrops(itemType, quantity),
    onSuccess: (data) => {
      eventBus.emit('play-sound', 'coin');
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setFeedbackMsg({ text: data.message, type: 'success' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
    onError: (err: any) => {
      setFeedbackMsg({ text: `❌ ${err?.message || 'Failed to sell crops'}`, type: 'error' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
  });

  const sellAllMut = useMutation({
    mutationFn: () => api.sellAllCrops(),
    onSuccess: (data) => {
      eventBus.emit('play-sound', 'coin');
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setFeedbackMsg({ text: data.message, type: 'success' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
    onError: (err: any) => {
      setFeedbackMsg({ text: `❌ ${err?.message || 'Failed to sell all crops'}`, type: 'error' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
  });

  const packMut = useMutation({
    mutationFn: ({ cropKey: ck, crateCount }: { cropKey: string; crateCount: number }) =>
      api.packCrate(ck, crateCount),
    onSuccess: (data) => {
      eventBus.emit('play-sound', 'quest');
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      setFeedbackMsg({ text: data.message ?? 'Packed crates successfully!', type: 'success' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
    onError: (err: any) => {
      setFeedbackMsg({ text: `❌ ${err?.message || 'Failed to pack crate'}`, type: 'error' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
  });

  const unpackMut = useMutation({
    mutationFn: ({ crateItemType, quantity }: { crateItemType: string; quantity: number }) =>
      api.unpackCrate(crateItemType, quantity),
    onSuccess: (data) => {
      eventBus.emit('play-sound', 'quest');
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      setFeedbackMsg({
        text: data.message ?? `🎉 Unpacked crate! Restored +${data.unitsGained} crops`,
        type: 'success',
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
    onError: (err: any) => {
      setFeedbackMsg({ text: `❌ Failed to unpack crate: ${err?.message || 'Unknown error'}`, type: 'error' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
  });

  const visibleCrops  = barnData.crops.filter(i => i.quantity > 0);
  const visibleCrates = barnData.crates.filter(i => i.quantity > 0);
  const visibleSeeds  = barnData.seeds.filter(i => i.quantity > 0);
  const totalAvailableCrops = visibleCrops.reduce((acc, item) => acc + item.available, 0);

  const isEmpty = visibleCrops.length + visibleCrates.length + visibleSeeds.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-center">
        <span className="text-5xl opacity-20">🌾</span>
        <p className="text-white/40 text-sm font-bold">Storage is empty</p>
        <p className="text-white/20 text-xs">Harvest crops from your farm to fill up your storage</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Help info banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-start gap-2.5">
        <span className="text-xl">💡</span>
        <div className="flex-1 min-w-0">
          <p className="text-amber-300 text-xs font-bold leading-tight">Crops &amp; Crates Storage</p>
          <p className="text-white/60 text-[11px] mt-0.5 leading-normal">
            • <b>Raw Crops</b>: Sell directly for <b>1:1 GOLD</b> or bundle into Crates.<br />
            • <b>Crates</b>: Bundled crops (e.g. 1 Turnip Crate = 100 Turnips) tradeable on the <b>P2P Marketplace</b>.
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`rounded-xl px-3.5 py-2.5 flex items-center gap-2 border text-xs font-bold transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border-red-500/30 text-red-300'
          }`}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={15} className="flex-shrink-0" /> : <AlertTriangle size={15} className="flex-shrink-0" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Quick Sell All Banner */}
      {totalAvailableCrops > 0 && (
        <div className="rounded-2xl p-3.5 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-amber-400/40 shadow-sm">
          <div className="min-w-0">
            <p className="text-amber-300 text-xs font-black flex items-center gap-1.5">
              <span>🌾</span>
              <span>{totalAvailableCrops.toLocaleString()} Crops ready to sell</span>
            </p>
            <p className="text-white/40 text-[10px] mt-0.5">Instant 1:1 conversion to GOLD</p>
          </div>
          <button
            disabled={sellAllMut.isPending}
            onClick={() => sellAllMut.mutate()}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black text-xs font-black active:scale-95 transition-all shadow-md flex items-center gap-1.5 flex-shrink-0 disabled:opacity-40"
          >
            {sellAllMut.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <span>⚡ Sell All (+{totalAvailableCrops.toLocaleString()}G)</span>
            )}
          </button>
        </div>
      )}

      {/* Raw crops */}
      {visibleCrops.length > 0 && (
        <>
          <p className="text-green-400 text-[10px] font-extrabold uppercase tracking-widest px-1">Raw Crops</p>
          <div className="flex flex-col gap-2">
            {visibleCrops.map((item) => {
              const key = cropKey(item.itemType);
              const packSize = CROP_PACK_SIZE[key] ?? 100;
              const maxCrates = Math.floor(item.available / packSize);
              const count = packCounts[key] ?? 1;
              const canPack = item.available >= packSize;
              return (
                <div key={item.itemType} className="glass rounded-2xl p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                        {itemIcon(item.itemType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm leading-tight truncate">
                          {itemLabel(item.itemType)}
                        </p>
                        <p className="text-white/40 text-[11px] mt-0.5">
                          x{item.available.toLocaleString()} units · 1 crate = {packSize}
                        </p>
                      </div>
                    </div>
                    <button
                      disabled={sellMut.isPending || item.available === 0}
                      onClick={() => sellMut.mutate({ itemType: item.itemType, quantity: item.available })}
                      className="px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 font-black text-xs hover:bg-amber-400/25 active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1 flex-shrink-0"
                    >
                      <Coins size={12} /> Sell {item.available.toLocaleString()}G
                    </button>
                  </div>

                  {canPack && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/40 text-[11px]">Pack:</span>
                        <button
                          onClick={() => setPackCounts(p => ({ ...p, [key]: Math.max(1, (p[key] ?? 1) - 1) }))}
                          className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs flex items-center justify-center active:scale-90"
                        >
                          −
                        </button>
                        <span className="text-white font-mono text-xs min-w-[24px] text-center">{count}</span>
                        <button
                          onClick={() => setPackCounts(p => ({ ...p, [key]: Math.min(maxCrates, (p[key] ?? 1) + 1) }))}
                          className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs flex items-center justify-center active:scale-90"
                        >
                          +
                        </button>
                        <span className="text-white/30 text-[10px] ml-1">
                          (uses {count * packSize})
                        </span>
                      </div>
                      <button
                        disabled={packMut.isPending}
                        onClick={() => packMut.mutate({ cropKey: key, crateCount: count })}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-xs active:scale-95 disabled:opacity-40 transition-all shadow-sm flex items-center gap-1 flex-shrink-0"
                      >
                        {packMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
                        <span>Pack Crate</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Crates */}
      {visibleCrates.length > 0 && (
        <>
          <p className="text-amber-400 text-[10px] font-extrabold uppercase tracking-widest px-1 mt-2">Crates</p>
          <div className="flex flex-col gap-2">
            {visibleCrates.map((item) => {
              const key = cropKey(item.itemType);
              const isListing = listingItem === item.itemType;
              const activeListing = myListings.find(l => l.status === 'active' && l.itemType === item.itemType);
              return (
                <div key={item.itemType} className="glass rounded-2xl p-3 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/20 flex items-center justify-center text-2xl flex-shrink-0">
                      {itemIcon(item.itemType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm leading-tight truncate">
                        {itemLabel(item.itemType)}
                      </p>
                      <p className="text-white/40 text-[11px] mt-0.5">
                        x{item.available} crate(s) available ({CROP_PACK_SIZE[key] ?? 100} crops/crate)
                        {item.lockedQuantity > 0 ? ` · ${item.lockedQuantity} listed on market` : ''}
                      </p>
                    </div>
                  </div>

                  {activeListing && (
                    <ActiveListingBadge
                      listing={activeListing}
                      canceling={cancelingId === activeListing.id}
                      onCancel={() => cancelMut.mutate(activeListing.id)}
                    />
                  )}

                  <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    <button
                      disabled={item.available === 0 || unpackMut.isPending}
                      onClick={() => unpackMut.mutate({ crateItemType: item.itemType, quantity: 1 })}
                      className="flex-1 text-xs py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white/80 font-bold active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-1.5"
                    >
                      {unpackMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
                      <span>Open Crate</span>
                    </button>
                    {activeListing ? (
                      <button
                        onClick={() => cancelMut.mutate(activeListing.id)}
                        disabled={cancelingId === activeListing.id}
                        className="flex-1 text-xs py-2 rounded-xl font-bold active:scale-95 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 flex items-center justify-center gap-1 transition-all"
                      >
                        {cancelingId === activeListing.id ? <Loader2 size={11} className="animate-spin" /> : null}
                        Cancel ({Number(activeListing.priceFarm).toLocaleString()}G)
                      </button>
                    ) : (
                      <button
                        disabled={item.available === 0}
                        onClick={() => setListingItem(isListing ? null : item.itemType)}
                        className={`flex-1 text-xs py-2 rounded-xl font-bold active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-1.5 ${
                          isListing
                            ? 'bg-white/10 text-white/60'
                            : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm'
                        }`}
                      >
                        {isListing ? 'Cancel' : <><ShoppingBag size={12} /> Sell on Market</>}
                      </button>
                    )}
                  </div>

                  {isListing && (
                    <InlineListingForm
                      itemType={item.itemType}
                      maxQty={item.available}
                      onClose={() => setListingItem(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Seeds */}
      {visibleSeeds.length > 0 && (
        <>
          <p className="text-pink-400 text-[10px] font-extrabold uppercase tracking-widest px-1 mt-2">Special Seeds</p>
          <div className="flex flex-col gap-2">
            {visibleSeeds.map((item) => {
              const isListing = listingItem === item.itemType;
              const activeListing = myListings.find(l => l.status === 'active' && l.itemType === item.itemType);
              return (
                <div key={item.itemType} className="glass rounded-2xl p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-400/20 flex items-center justify-center text-2xl flex-shrink-0">
                        {itemIcon(item.itemType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm leading-tight truncate">{itemLabel(item.itemType)}</p>
                        <p className="text-white/40 text-[11px] mt-0.5">
                          x{item.available} available {item.lockedQuantity > 0 ? `· ${item.lockedQuantity} listed` : ''}
                        </p>
                      </div>
                    </div>
                    {activeListing ? (
                      <button
                        onClick={() => cancelMut.mutate(activeListing.id)}
                        disabled={cancelingId === activeListing.id}
                        className="text-xs px-3 py-1.5 rounded-xl font-bold active:scale-95 bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1 flex-shrink-0 transition-all"
                      >
                        {cancelingId === activeListing.id ? <Loader2 size={11} className="animate-spin" /> : null}
                        Cancel
                      </button>
                    ) : (
                      <button
                        disabled={item.available === 0}
                        onClick={() => setListingItem(isListing ? null : item.itemType)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold active:scale-95 disabled:opacity-30 flex-shrink-0 transition-all ${
                          isListing ? 'bg-white/10 text-white/50' : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'
                        }`}
                      >
                        {isListing ? 'Close' : 'Sell'}
                      </button>
                    )}
                  </div>
                  {activeListing && (
                    <ActiveListingBadge
                      listing={activeListing}
                      canceling={cancelingId === activeListing.id}
                      onCancel={() => cancelMut.mutate(activeListing.id)}
                    />
                  )}
                  {isListing && (
                    <InlineListingForm
                      itemType={item.itemType}
                      maxQty={item.available}
                      onClose={() => setListingItem(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab 2: Consumables ────────────────────────────────────────────────────────
const SELLABLE_TOOLS = ['magnifying_glass', 'master_key', 'soul_shard'];

function ConsumablesTab({ barnData }: { barnData: BarnData }) {
  const queryClient = useQueryClient();
  const { fertilizer, tools } = barnData;
  const [listingItem, setListingItem] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const { data: myListings = [] } = useQuery({
    queryKey: ['my-marketplace-listings'],
    queryFn: api.getMyMarketplaceListings,
    staleTime: 15_000,
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => {
      setCancelingId(id);
      return api.cancelMarketplaceListing(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['tool-market-listings'] });
      setCancelingId(null);
      setActionMsg('Listing cancelled! Items returned to your storage.');
      setTimeout(() => setActionMsg(null), 3500);
    },
    onError: (err: any) => {
      setCancelingId(null);
      setActionMsg(`Failed to cancel: ${err?.message || 'Unknown error'}`);
      setTimeout(() => setActionMsg(null), 3500);
    },
  });

  const toolItems = tools.filter(i => i.quantity > 0);
  const sellableTools = toolItems.filter(i => SELLABLE_TOOLS.includes(i.itemType));
  const otherTools = toolItems.filter(i => !SELLABLE_TOOLS.includes(i.itemType));

  const hasFert = fertilizer.total > 0;
  const isEmpty = !hasFert && toolItems.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-center">
        <span className="text-5xl opacity-20">🧰</span>
        <p className="text-white/40 text-sm font-bold">No consumables yet</p>
        <p className="text-white/20 text-xs">Buy fertilizers &amp; tools from the Shop</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {actionMsg && (
        <div className="glass rounded-xl px-3.5 py-2.5 flex items-center gap-2 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          <CheckCircle2 size={14} className="flex-shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Fertilizer */}
      {hasFert && (
        <>
          <p className="text-green-400 text-[10px] font-extrabold uppercase tracking-widest px-1">Fertilizers</p>
          <div className="glass rounded-2xl p-3.5 flex gap-3">
            {fertilizer.normal > 0 && (
              <div className="text-center flex-1 bg-white/5 rounded-xl py-2">
                <p className="text-green-300 font-black text-lg leading-none">×{fertilizer.normal}</p>
                <p className="text-white/40 text-[10px] mt-1 font-semibold">🌿 Basic</p>
              </div>
            )}
            {fertilizer.super > 0 && (
              <div className="text-center flex-1 bg-white/5 rounded-xl py-2">
                <p className="text-blue-300 font-black text-lg leading-none">×{fertilizer.super}</p>
                <p className="text-white/40 text-[10px] mt-1 font-semibold">🚀 Super</p>
              </div>
            )}
            {fertilizer.advanced > 0 && (
              <div className="text-center flex-1 bg-white/5 rounded-xl py-2">
                <p className="text-purple-300 font-black text-lg leading-none">×{fertilizer.advanced}</p>
                <p className="text-white/40 text-[10px] mt-1 font-semibold">💎 Premium</p>
              </div>
            )}
          </div>
          <p className="text-white/30 text-[10px] text-center">
            Select Spray tool on crops → auto-applies best fertilizer
          </p>
        </>
      )}

      {sellableTools.length > 0 && (
        <>
          <p className="text-blue-400 text-[10px] font-extrabold uppercase tracking-widest px-1 mt-1">Tools &amp; Soul Shards</p>
          <div className="flex flex-col gap-2">
            {sellableTools.map((item) => {
              const isListing = listingItem === item.itemType;
              const isShard = item.itemType === 'soul_shard';
              const activeListing = myListings.find(l => l.status === 'active' && l.itemType === item.itemType);

              if (isShard) {
                return (
                  <div key={item.itemType} className="rounded-2xl p-3 bg-gradient-to-r from-purple-500/15 via-amber-500/10 to-purple-500/15 border border-purple-400/30 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-2xl flex-shrink-0">
                          💎
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-white font-bold text-sm leading-tight">Soul Shard</p>
                            <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">Soul Forge</span>
                          </div>
                          <p className="text-white/50 text-[11px] mt-0.5">
                            x{item.available} available {item.lockedQuantity > 0 ? `· ${item.lockedQuantity} listed` : ''} · Collect 100 to forge Tier 3-5 Dogs
                          </p>
                        </div>
                      </div>
                      {activeListing ? (
                        <button
                          disabled={cancelingId === activeListing.id}
                          onClick={() => cancelMut.mutate(activeListing.id)}
                          className="text-xs px-3 py-1.5 rounded-xl font-bold active:scale-95 bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1 flex-shrink-0 transition-all"
                        >
                          {cancelingId === activeListing.id ? <Loader2 size={11} className="animate-spin" /> : null}
                          Cancel
                        </button>
                      ) : (
                        <button
                          disabled={item.available === 0}
                          onClick={() => setListingItem(isListing ? null : item.itemType)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold active:scale-95 disabled:opacity-30 flex-shrink-0 flex items-center gap-1 transition-all ${
                            isListing ? 'bg-white/10 text-white/50' : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'
                          }`}
                        >
                          {isListing ? 'Close' : <><ShoppingBag size={11} /> Sell</>}
                        </button>
                      )}
                    </div>
                    {activeListing && (
                      <ActiveListingBadge
                        listing={activeListing}
                        canceling={cancelingId === activeListing.id}
                        onCancel={() => cancelMut.mutate(activeListing.id)}
                      />
                    )}
                    {isListing && (
                      <InlineListingForm
                        itemType={item.itemType}
                        maxQty={item.available}
                        onClose={() => setListingItem(null)}
                      />
                    )}
                  </div>
                );
              }

              return (
                <div key={item.itemType} className="glass rounded-2xl p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-2xl flex-shrink-0">
                        {itemIcon(item.itemType)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm leading-tight truncate">{itemLabel(item.itemType)}</p>
                        <p className="text-white/40 text-[11px] mt-0.5">
                          x{item.available} available {item.lockedQuantity > 0 ? `· ${item.lockedQuantity} listed` : ''}
                        </p>
                      </div>
                    </div>
                    {activeListing ? (
                      <button
                        disabled={cancelingId === activeListing.id}
                        onClick={() => cancelMut.mutate(activeListing.id)}
                        className="text-xs px-3 py-1.5 rounded-xl font-bold active:scale-95 bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1 flex-shrink-0 transition-all"
                      >
                        {cancelingId === activeListing.id ? <Loader2 size={11} className="animate-spin" /> : null}
                        Cancel
                      </button>
                    ) : (
                      <button
                        disabled={item.available === 0}
                        onClick={() => setListingItem(isListing ? null : item.itemType)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold active:scale-95 disabled:opacity-30 flex-shrink-0 flex items-center gap-1 transition-all ${
                          isListing ? 'bg-white/10 text-white/50' : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'
                        }`}
                      >
                        {isListing ? 'Close' : <><ShoppingBag size={11} /> Sell</>}
                      </button>
                    )}
                  </div>
                  {activeListing && (
                    <ActiveListingBadge
                      listing={activeListing}
                      canceling={cancelingId === activeListing.id}
                      onCancel={() => cancelMut.mutate(activeListing.id)}
                    />
                  )}
                  {isListing && (
                    <InlineListingForm
                      itemType={item.itemType}
                      maxQty={item.available}
                      onClose={() => setListingItem(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Other tools */}
      {otherTools.length > 0 && (
        <>
          <p className="text-white/30 text-[10px] font-extrabold uppercase tracking-widest px-1 mt-1">Other Items</p>
          <div className="flex flex-col gap-1.5">
            {otherTools.map((item) => (
              <div key={item.itemType} className="glass rounded-xl px-3 py-2.5 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{itemIcon(item.itemType)}</span>
                  <p className="text-white/80 text-xs font-semibold truncate">{itemLabel(item.itemType)}</p>
                </div>
                <p className="text-white font-mono font-black text-xs">{item.quantity.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab 3: Dog Kennel ─────────────────────────────────────────────────────────
function DogsTab({
  barnData,
  refetch,
  onOpenShop,
}: {
  barnData: BarnData;
  refetch: () => void;
  onOpenShop: () => void;
}) {
  const queryClient = useQueryClient();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [tokenizeCount, setTokenizeCount] = useState<1 | 3>(1);
  const [feedingDogId, setFeedingDogId] = useState<string | null>(null);
  const [cancelingListingId, setCancelingListingId] = useState<string | null>(null);

  const toggleMut = useMutation({
    mutationFn: ({ dogId, isGuarding }: { dogId: string; isGuarding: boolean }) =>
      api.setDogGuardingById(dogId, isGuarding),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['nftStatus'] });
      queryClient.invalidateQueries({ queryKey: ['myFarm'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      refetch();
    },
    onError: (err: any) => {
      setSyncMsg(`❌ ${err?.message || 'Failed to update dog status'}`);
      setTimeout(() => setSyncMsg(null), 4000);
    },
  });

  const feedMut = useMutation({
    mutationFn: (dogId: string) => {
      setFeedingDogId(dogId);
      return api.feedDog(dogId);
    },
    onSuccess: (data) => {
      setFeedingDogId(null);
      eventBus.emit('play-sound', 'coin');
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['nftStatus'] });
      setSyncMsg(`🍖 ${data.message} (-10G)`);
      setTimeout(() => setSyncMsg(null), 4500);
    },
    onError: (err: any) => {
      setFeedingDogId(null);
      setSyncMsg(`❌ ${err?.message || 'Feeding failed'}`);
      setTimeout(() => setSyncMsg(null), 4000);
    },
  });

  const cancelListingMut = useMutation({
    mutationFn: (listingId: string) => {
      setCancelingListingId(listingId);
      return api.cancelMarketplaceListing(listingId);
    },
    onSuccess: () => {
      setCancelingListingId(null);
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['nftStatus'] });
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['myFarm'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setSyncMsg('Listing cancelled! Dog returned to storage.');
      setTimeout(() => setSyncMsg(null), 4000);
    },
    onError: (err: any) => {
      setCancelingListingId(null);
      setSyncMsg(`❌ Failed to cancel: ${err?.message || 'Unknown error'}`);
      setTimeout(() => setSyncMsg(null), 4000);
    },
  });

  const syncMut = useMutation({
    mutationFn: api.syncNft,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['nftStatus'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['myFarm'] });
      setSyncMsg(`Synced ${data.synced} dogs. Total defense: ${data.totalNftDefense}%`);
      setTimeout(() => setSyncMsg(null), 4000);
    },
  });

  type TokenizeStep = 'idle' | 'authorizing' | 'approving' | 'minting' | 'syncing' | 'success' | 'error';
  const [tokStep, setTokStep] = useState<TokenizeStep>('idle');
  const [tokTxHash, setTokTxHash] = useState<string | null>(null);
  const [tokError, setTokError] = useState<string | null>(null);

  const handleTokenize = async (count: 1 | 3) => {
    const pk = getStoredWalletPk();
    if (!pk) {
      setTokError('Web3 wallet not found. Please connect or check Settings.');
      setTokStep('error');
      return;
    }

    setTokError(null);
    setTokTxHash(null);

    const account = privateKeyToAccount(pk);
    const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });
    const publicClient = createPublicClient({ chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });

    const costWei = count === 3 ? 40n * 10n ** 18n : 15n * 10n ** 18n;
    const requiredFarm = count === 3 ? 40 : 15;
    const costBnbWei = count === 3 ? 5000000000000000n : 2000000000000000n;
    const requiredBnb = count === 3 ? '0.005' : '0.002';

    // 0. Pre-flight check: ensure wallet has enough $FARM and BNB before burning in-game dog
    try {
      const [farmBalance, bnbBalance] = await Promise.all([
        publicClient.readContract({
          address: FARM_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [account.address],
        }) as Promise<bigint>,
        publicClient.getBalance({ address: account.address }),
      ]);

      if (farmBalance < costWei) {
        const currentFarm = Number(farmBalance / (10n ** 16n)) / 100;
        setTokError(`Insufficient $FARM in wallet (requires ${requiredFarm} $FARM, you have ${currentFarm.toFixed(2)} $FARM). Please buy $FARM from DEX first.`);
        setTokStep('error');
        return;
      }

      if (bnbBalance < costBnbWei + 500000000000000n) {
        setTokError(`Insufficient BNB in wallet for Oracle Service Fee (requires ${requiredBnb} BNB for Treasury Vault).`);
        setTokStep('error');
        return;
      }
    } catch (checkErr) {
      console.warn('Pre-flight balance check warning:', checkErr);
    }

    let authRes: { walletAddress: string; count: number; nonce: number; signature: string; contractAddress: string } | null = null;

    try {
      setTokStep('authorizing');
      authRes = await api.tokenizeDog(count);

      setTokStep('approving');
      const allowance = await publicClient.readContract({
        address: FARM_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account.address, GACHA_ADDRESS],
      }) as bigint;

      if (allowance < costWei) {
        const appTx = await walletClient.writeContract({
          address: FARM_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [GACHA_ADDRESS, costWei],
        });
        await publicClient.waitForTransactionReceipt({ hash: appTx });
      }

      setTokStep('minting');
      const mintTx = await walletClient.writeContract({
        address: GACHA_ADDRESS,
        abi: FUSION_ABI,
        functionName: 'tokenizeDog',
        args: [BigInt(count), BigInt(authRes.nonce), authRes.signature as `0x${string}`],
        value: costBnbWei,
      });
      setTokTxHash(mintTx);
      await publicClient.waitForTransactionReceipt({ hash: mintTx });

      setTokStep('syncing');
      await api.syncNft().catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['nftStatus'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['myFarm'] });

      setTokStep('success');
      setSyncMsg(`Successfully minted ${count} On-Chain Dog NFT(s)!`);
      setTimeout(() => { setSyncMsg(null); setTokStep('idle'); }, 6000);
    } catch (err) {
      // Automated compensation: rollback deleted dog in DB if on-chain mint failed
      if (authRes && typeof authRes.nonce === 'number') {
        try {
          await api.rollbackTokenizeDog(authRes.nonce, count);
          queryClient.invalidateQueries({ queryKey: ['barnData'] });
        } catch (rbErr) {
          console.error('Failed to rollback dog:', rbErr);
        }
      }

      const msg = err instanceof Error ? err.message : String(err);
      if (/insufficient funds|gas.*balance/i.test(msg)) {
        setTokError('Insufficient BNB for gas fees.');
      } else if (/ERC20InsufficientBalance|transfer amount exceeds balance|0xe450d38c/i.test(msg)) {
        setTokError(`Insufficient $FARM in wallet (requires ${count === 3 ? 40 : 15} $FARM). Your shop dog was preserved.`);
      } else {
        setTokError(msg.length > 100 ? msg.slice(0, 100) + '…' : msg);
      }
      setTokStep('error');
    }
  };

  const isTokPending = ['authorizing', 'approving', 'minting', 'syncing'].includes(tokStep);

  const dogs = barnData.dogs;
  const shopDogs = dogs.filter(d => d.source === 'shop');
  const nftDogs  = dogs.filter(d => d.source === 'nft');

  const guardingCount = dogs.filter(d => d.isGuarding).length;
  const listedCount   = dogs.filter(d => d.isListed).length;
  const storedCount   = dogs.filter(d => !d.isGuarding && !d.isListed).length;

  // Calculate hunger-adjusted defense
  const totalDefense = dogs.filter(d => d.isGuarding).reduce((sum, d) => {
    const hunger = getDogHunger(d.lastFedAt);
    return sum + Math.floor(d.defensePower * hunger.mult);
  }, 0);

  if (dogs.length === 0) {
    return (
      <div className="flex flex-col gap-4 py-8 items-center text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-3xl">
          🐕
        </div>
        <div>
          <p className="text-white font-bold text-base">No Guard Dogs in Kennel</p>
          <p className="text-white/40 text-xs mt-1 max-w-xs leading-relaxed">
            Guard dogs reduce neighbor crop theft chances and defend your farm!
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onOpenShop}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-xs flex items-center gap-1.5 active:scale-95 shadow-md"
          >
            <Store size={14} /> Buy Dogs in Shop
          </button>
          <button
            disabled={syncMut.isPending}
            onClick={() => syncMut.mutate()}
            className="glass px-4 py-2 rounded-xl text-white/70 text-xs font-bold flex items-center gap-1.5 active:scale-95"
          >
            <RefreshCw size={13} className={syncMut.isPending ? 'animate-spin' : ''} />
            Sync Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Top bar & sync */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          disabled={syncMut.isPending}
          onClick={() => syncMut.mutate()}
          className="glass flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/70 hover:text-white active:scale-95 disabled:opacity-40 transition-all border border-white/10"
        >
          <RefreshCw size={11} className={syncMut.isPending ? 'animate-spin' : ''} />
          Sync Wallet
        </button>
        {syncMsg && (
          <span className="text-emerald-400 text-xs font-bold flex-1 text-right truncate">
            {syncMsg}
          </span>
        )}
      </div>

      {/* Kennel Stats */}
      <div className="glass rounded-2xl p-3 flex items-center gap-2 border border-white/10">
        <div className="text-center flex-1">
          <p className="text-white font-black text-base leading-none">{dogs.length}</p>
          <p className="text-white/40 text-[9px] uppercase font-bold mt-1">Total</p>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <div className="text-center flex-1">
          <p className="text-emerald-400 font-black text-base leading-none">{guardingCount}</p>
          <p className="text-white/40 text-[9px] uppercase font-bold mt-1">Guarding</p>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <div className="text-center flex-1">
          <p className="text-purple-300 font-black text-base leading-none">{listedCount}</p>
          <p className="text-white/40 text-[9px] uppercase font-bold mt-1">Listed</p>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <div className="text-center flex-1">
          <p className="text-amber-400 font-black text-base leading-none">{storedCount}</p>
          <p className="text-white/40 text-[9px] uppercase font-bold mt-1">Storage</p>
        </div>
        <div className="w-px h-6 bg-white/10" />
        <div className="text-center flex-1">
          <p className="text-emerald-300 font-black text-base leading-none">{totalDefense}%</p>
          <p className="text-white/40 text-[9px] uppercase font-bold mt-1">Active Def</p>
        </div>
      </div>

      {/* Web2 shop dogs */}
      {shopDogs.length > 0 && (
        <>
          <p className="text-amber-400 text-[10px] font-extrabold uppercase tracking-widest px-1">Shop Dogs (Web2)</p>

          {/* Tokenize section */}
          <div className="glass rounded-2xl p-3.5 flex flex-col gap-2.5 border border-purple-400/20">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-white font-black text-xs">Tokenize Dogs to On-Chain NFT</p>
                <p className="text-white/40 text-[10px]">Convert Shop Dogs to NFTs to trade on Marketplace or fuse in Soul Forge</p>
              </div>
              <span className="text-[10px] text-amber-300 font-bold font-mono flex-shrink-0">
                {tokenizeCount === 3 ? '40 $FARM (save 5)' : '15 $FARM'}
              </span>
            </div>

            {/* Stepper Status Bar */}
            {isTokPending && (
              <div className="bg-purple-950/40 rounded-xl p-3 border border-purple-400/30 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-purple-400" />
                  <span className="text-purple-200 text-xs font-bold">
                    {tokStep === 'authorizing' && '1/3: Authorizing & burning Web2 dog…'}
                    {tokStep === 'approving' && '2/3: Approving $FARM spend…'}
                    {tokStep === 'minting' && '3/3: Minting Dog NFT on BSC Testnet…'}
                    {tokStep === 'syncing' && 'Syncing wallet data…'}
                  </span>
                </div>
                {tokTxHash && (
                  <a href={`https://testnet.bscscan.com/tx/${tokTxHash}`} target="_blank" rel="noreferrer"
                    className="text-blue-300 text-[10px] underline flex items-center gap-1 font-mono">
                    View mint tx on BSCScan <ExternalLink size={9} />
                  </a>
                )}
              </div>
            )}

            {tokStep === 'error' && tokError && (
              <div className="bg-red-500/15 rounded-xl p-2.5 border border-red-400/30 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-red-300 text-xs">{tokError}</p>
                  <button onClick={() => setTokStep('idle')} className="text-white/50 hover:text-white text-[10px] underline mt-1">
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {([1, 3] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setTokenizeCount(n)}
                    disabled={isTokPending}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      tokenizeCount === n
                        ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40'
                        : 'glass text-white/40'
                    }`}
                  >
                    ×{n} {n === 3 ? '(bulk)' : ''}
                  </button>
                ))}
              </div>
              <button
                disabled={isTokPending || shopDogs.length < tokenizeCount}
                onClick={() => handleTokenize(tokenizeCount)}
                className="flex-1 py-2 rounded-xl font-bold text-xs active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30"
              >
                {isTokPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>🔮 Tokenize ({tokenizeCount === 3 ? '40 FARM + 0.005 BNB' : '15 FARM + 0.002 BNB'})</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {shopDogs.map((dog) => {
              const isBusy = toggleMut.isPending && toggleMut.variables?.dogId === dog.id;
              const isFeeding = feedMut.isPending && feedingDogId === dog.id;
              const emoji = DOG_EMOJIS[dog.tokenId] ?? '🐕';
              const name = DOG_NAMES[dog.tokenId] ?? dog.dogType;
              const hunger = getDogHunger(dog.lastFedAt);
              const effectiveDef = Math.floor(dog.defensePower * hunger.mult);

              return (
                <div key={dog.id} className="glass rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                        dog.isGuarding ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/20'
                      }`}>
                        {emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-white font-bold text-sm leading-tight">{name}</p>
                          {dog.isGuarding ? (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                              🛡️ Guarding
                            </span>
                          ) : (
                            <span className="text-[9px] bg-white/8 text-white/40 px-1.5 py-0.5 rounded-full font-bold">
                              💤 Idle
                            </span>
                          )}
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                              hunger.status === 'fed'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : hunger.status === 'hungry'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                : 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                            }`}
                          >
                            {hunger.status === 'fed' ? `🍖 Fed (${hunger.hoursLeft}h)` : hunger.label}
                          </span>
                        </div>
                        <p className="text-white/40 text-[11px] mt-0.5">
                          −{effectiveDef}% steal rate {hunger.mult < 1.0 ? `(base: ${dog.defensePower}%)` : ''} · Web2 Dog
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {hunger.canFeed && (
                        <button
                          disabled={isFeeding}
                          onClick={() => feedMut.mutate(dog.id)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold active:scale-95 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 transition-all flex items-center gap-1"
                          title="Feed dog 10G to restore 100% defense"
                        >
                          {isFeeding ? <Loader2 size={11} className="animate-spin" /> : <Drumstick size={12} />}
                          <span>Feed (10G)</span>
                        </button>
                      )}
                      <button
                        disabled={isBusy}
                        onClick={() => toggleMut.mutate({ dogId: dog.id, isGuarding: !dog.isGuarding })}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1 ${
                          dog.isGuarding
                            ? 'bg-white/10 text-white/60 hover:text-white'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm'
                        }`}
                      >
                        {isBusy && <Loader2 size={10} className="animate-spin" />}
                        {dog.isGuarding ? 'Recall' : 'Deploy'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* NFT dogs */}
      {nftDogs.length > 0 && (
        <>
          <p className="text-purple-400 text-[10px] font-extrabold uppercase tracking-widest px-1 mt-1">NFT Guard Dogs (On-Chain)</p>
          <div className="flex flex-col gap-2">
            {nftDogs.map((dog) => {
              const isBusy = toggleMut.isPending && toggleMut.variables?.dogId === dog.id;
              const isFeeding = feedMut.isPending && feedingDogId === dog.id;
              const isCanceling = cancelListingMut.isPending && cancelingListingId === dog.listingId;
              const emoji = DOG_EMOJIS[dog.tokenId] ?? '🐕';
              const name = DOG_NAMES[dog.tokenId] ?? dog.dogType;
              const hunger = getDogHunger(dog.lastFedAt);
              const effectiveDef = Math.floor(dog.defensePower * hunger.mult);

              return (
                <div key={dog.id} className="glass rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                        dog.isGuarding
                          ? 'bg-emerald-500/20 border border-emerald-500/30'
                          : dog.isListed
                          ? 'bg-purple-500/20 border border-purple-500/30'
                          : 'bg-white/8 border border-white/10'
                      }`}>
                        {emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-white font-bold text-sm leading-tight truncate">{name}</p>
                          {dog.isGuarding ? (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                              🛡️ Guarding
                            </span>
                          ) : dog.isListed ? (
                            <span className="text-[9px] bg-purple-500/25 text-purple-300 border border-purple-400/40 px-1.5 py-0.5 rounded-full font-bold">
                              🏷️ Listed {dog.listingPrice ? `(${Number(dog.listingPrice).toLocaleString()} FARM)` : ''}
                            </span>
                          ) : (
                            <span className="text-[9px] bg-white/8 text-white/40 px-1.5 py-0.5 rounded-full font-bold">
                              📦 Storage
                            </span>
                          )}
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                              hunger.status === 'fed'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : hunger.status === 'hungry'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                : 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                            }`}
                          >
                            {hunger.status === 'fed' ? `🍖 Fed (${hunger.hoursLeft}h)` : hunger.label}
                          </span>
                        </div>
                        <p className="text-white/40 text-[11px] mt-0.5">
                          −{effectiveDef}% steal rate {hunger.mult < 1.0 ? `(base: ${dog.defensePower}%)` : ''}
                          {dog.isListed ? (
                            <span className="text-purple-400/90 font-medium"> · On Marketplace</span>
                          ) : !dog.isGuarding ? (
                            <span className="text-amber-400/80 font-medium"> · Ready to Deploy or Sell</span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {hunger.canFeed && (
                        <button
                          disabled={isFeeding}
                          onClick={() => feedMut.mutate(dog.id)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold active:scale-95 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 transition-all flex items-center gap-1"
                          title="Feed dog 10G to restore 100% defense"
                        >
                          {isFeeding ? <Loader2 size={11} className="animate-spin" /> : <Drumstick size={12} />}
                          <span>Feed (10G)</span>
                        </button>
                      )}
                      {dog.isListed && dog.listingId ? (
                        <button
                          disabled={isCanceling}
                          onClick={() => cancelListingMut.mutate(dog.listingId!)}
                          title="Cancel marketplace listing to deploy dog"
                          className="text-xs px-2.5 py-1.5 rounded-xl font-bold active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1 border border-purple-400/30 text-purple-300 hover:bg-purple-500/20"
                        >
                          {isCanceling && <Loader2 size={10} className="animate-spin" />}
                          Cancel Listing
                        </button>
                      ) : (
                        <button
                          disabled={isBusy}
                          onClick={() => toggleMut.mutate({ dogId: dog.id, isGuarding: !dog.isGuarding })}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1 ${
                            dog.isGuarding
                              ? 'bg-white/10 text-white/60 hover:text-white'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm'
                          }`}
                        >
                          {isBusy && <Loader2 size={10} className="animate-spin" />}
                          {dog.isGuarding ? 'Recall' : 'Deploy'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Kennel footer note */}
      <div className="glass rounded-xl p-3 mt-1 border border-white/5">
        <p className="text-white/30 text-[10px] leading-relaxed">
          🛡️ <span className="text-emerald-400 font-semibold">Guarding</span> defends your farm during neighbor raids.
          {' '}🍖 <span className="text-amber-300 font-semibold">Feed</span> dogs once every 24h to maintain 100% defense power.
        </p>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function StorageModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('crops');

  const { data: barnData, isLoading, refetch } = useQuery({
    queryKey: ['barnData'],
    queryFn: api.getBarnInventory,
    staleTime: 15_000,
  });

  const cropsCount = useMemo(() => {
    if (!barnData) return 0;
    return (
      barnData.crops.filter(i => i.quantity > 0).length +
      barnData.crates.filter(i => i.quantity > 0).length +
      barnData.seeds.filter(i => i.quantity > 0).length
    );
  }, [barnData]);

  const itemsCount = useMemo(() => {
    if (!barnData) return 0;
    return (
      (barnData.fertilizer.total > 0 ? 1 : 0) +
      barnData.tools.filter(i => i.quantity > 0).length
    );
  }, [barnData]);

  const dogsGuarding = useMemo(() => {
    if (!barnData) return { total: 0, guarding: 0 };
    return {
      total: barnData.dogs.length,
      guarding: barnData.dogs.filter(d => d.isGuarding).length,
    };
  }, [barnData]);

  const tabs: { id: Tab; label: string; emoji: string; badge?: string | number }[] = [
    { id: 'crops',       label: 'Crops',      emoji: '🌾', badge: cropsCount > 0 ? cropsCount : undefined },
    { id: 'consumables', label: 'Items',      emoji: '🧰', badge: itemsCount > 0 ? itemsCount : undefined },
    {
      id: 'dogs',
      label: 'Dog Kennel',
      emoji: '🐕',
      badge: dogsGuarding.total > 0 ? `${dogsGuarding.guarding}/${dogsGuarding.total}` : undefined,
    },
  ];

  const handleOpenShop = () => {
    onClose();
    eventBus.emit('show-shop', { tab: 'defense' });
  };

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

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Warehouse size={19} />
            </div>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Storage &amp; Barn</h2>
              <p className="text-white/40 text-xs">Manage crops, crates, items &amp; guard dogs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-90"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-1 pb-3 flex-shrink-0">
          <div className="flex p-1 rounded-2xl bg-white/5 border border-white/10 gap-1">
            {tabs.map(({ id, label, emoji, badge }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  tab === id
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <span>{emoji}</span>
                <span>{label}</span>
                {badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      tab === id
                        ? 'bg-black text-amber-300'
                        : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 pb-6">
          {isLoading && (
            <div className="flex items-center justify-center py-20 gap-2 text-white/40">
              <Loader2 size={18} className="animate-spin text-amber-400" />
              <span className="text-sm font-semibold">Loading storage…</span>
            </div>
          )}

          {barnData && tab === 'crops'       && <CropsAndSeedsTab barnData={barnData} />}
          {barnData && tab === 'consumables' && <ConsumablesTab   barnData={barnData} />}
          {barnData && tab === 'dogs'        && (
            <DogsTab
              barnData={barnData}
              refetch={refetch}
              onOpenShop={handleOpenShop}
            />
          )}
        </div>
      </div>
    </div>
  );
}
