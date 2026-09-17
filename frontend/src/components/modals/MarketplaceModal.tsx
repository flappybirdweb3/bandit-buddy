import { useState, useCallback, useMemo } from 'react';
import {
  X, ShoppingBag, Tag, CheckCircle2, Loader2, AlertTriangle,
  List, PlusCircle, ExternalLink, ChevronDown, SlidersHorizontal,
  ArrowUpDown, Copy, Check, RefreshCw, Shield, Sparkles,
} from 'lucide-react';
import WebApp from '@twa-dev/sdk';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useGame } from '@/providers/GameProvider';
import { useCreateListing, useBuyListing, stepLabel } from '@/hooks/useMarketplaceTrade';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useDexTier } from '@/hooks/useDexTier';
import {
  usePancakeSwap,
  PANCAKE_ROUTER_ADDRESS,
  FARM_TOKEN_ADDRESS,
  type SwapReceipt,
} from '@/hooks/usePancakeSwap';
import { SwapResultModal } from '@/components/modals/SwapResultModal';
import type { MarketplaceListing, BarnData, InventoryItem } from '@/types/game.types';

interface Props {
  onClose: () => void;
  initialSection?: Section;
}

type Section  = 'nft' | 'crops' | 'tools' | 'dex' | 'my-listings';
type NftTab   = 'browse' | 'sell' | 'my-listings';
type CropsTab = 'browse' | 'sell' | 'my-listings';
type ToolsTab = 'browse' | 'sell' | 'my-listings';

type SortBy = 'price' | 'createdAt' | 'deadline';
type SortOrder = 'ASC' | 'DESC';

// ── Constants ─────────────────────────────────────────────────────────────────

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
  magnifying_glass: '🔍', tool_magnifying_glass: '🔍',
  master_key: '🗝️', tool_master_key: '🗝️',
  soul_shard: '💎',
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
  magnifying_glass: 'Magnifying Glass', tool_magnifying_glass: 'Magnifying Glass',
  master_key: 'Master Key', tool_master_key: 'Master Key',
  soul_shard: 'Soul Shard',
};

const DOG_NAMES: Record<number, string> = {
  1: 'Chihuahua 🐶', 2: 'Corgi 🐕', 3: 'Husky 🐺',
  4: 'Rottweiler 🦮', 5: 'Doberman 🐩', 6: 'Pitbull 💪',
};
const DOG_DEFENSE: Record<number, number> = { 1: 10, 2: 20, 3: 35, 4: 50, 5: 65, 6: 80 };

const DEADLINE_OPTIONS = [
  { label: '6h',    days: 0.25 },
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
];

const SORT_OPTIONS: { value: SortBy; label: string; defaultOrder: SortOrder }[] = [
  { value: 'createdAt', label: 'Newest',       defaultOrder: 'DESC' },
  { value: 'price',     label: 'Price: Low',   defaultOrder: 'ASC'  },
  { value: 'price',     label: 'Price: High',  defaultOrder: 'DESC' },
  { value: 'deadline',  label: 'Expiring soon', defaultOrder: 'ASC'  },
];

const TOOL_ITEM_TYPES = ['magnifying_glass', 'master_key', 'tool_magnifying_glass', 'tool_master_key', 'soul_shard'];

const CRATE_FILTER_TYPES = [
  'crate_turnip', 'crate_carrot', 'crate_corn', 'crate_potato', 'crate_eggplant',
  'crate_tomato', 'crate_pea', 'crate_watermelon', 'crate_strawberry',
  'crate_pumpkin', 'crate_grape', 'crate_sunflower', 'crate_rose',
  'crate_wheat', 'crate_pumpkin_demon', 'crate_lucky_peach',
];
const SEED_FILTER_TYPES = ['seed_rose', 'seed_sunflower', 'seed_pumpkin_demon', 'seed_lucky_peach'];

const PAGE_SIZE = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeUntil(dateStr?: string | Date | null) {
  if (!dateStr) return 'No expiry';
  const diff = new Date(dateStr).getTime() - Date.now();
  if (isNaN(diff)) return 'No expiry';
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a href={`https://testnet.bscscan.com/tx/${hash}`} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 text-blue-300 text-[10px] underline">
      BSCScan <ExternalLink size={9} />
    </a>
  );
}

function itemIcon(t: string) { return ITEM_ICONS[t] ?? '📦'; }
function itemLabel(t: string) { return ITEM_LABELS[t] ?? t; }
function cropKey(t: string)   { return t.replace(/^(crate_|crop_|seed_)/, ''); }

const CROP_PACK_SIZE: Record<string, number> = {
  turnip: 100, carrot: 200, corn: 100, potato: 100, eggplant: 100, tomato: 100,
  pea: 100, watermelon: 50, strawberry: 50, pumpkin: 50, grape: 50,
  sunflower: 20, rose: 20, wheat: 500, pumpkin_demon: 20, lucky_peach: 20,
};

// ── NFT Listing Card ──────────────────────────────────────────────────────────

function ListingCard({ listing, onBuy, onCancel, isMine, buyStep, canceling }: {
  listing: MarketplaceListing;
  onBuy?: () => void; onCancel?: () => void;
  isMine: boolean; buyStep?: string; canceling?: boolean;
}) {
  const tokenId = listing.tokenId ?? 0;
  const dogName = DOG_NAMES[tokenId] ?? `Dog #${tokenId}`;
  const defense = DOG_DEFENSE[tokenId] ?? 0;
  const busy = !!buyStep && buyStep !== 'idle' && buyStep !== 'success' && buyStep !== 'error';
  const qty = Number(listing.quantity || 1);
  const totalPrice = Number(listing.priceFarm || 0);
  const unitPrice = qty > 0 ? Math.round(totalPrice / qty) : totalPrice;

  return (
    <div
      className={`rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
        isMine ? 'glass bg-amber-500/10 border border-amber-400/40 shadow-sm' : 'glass'
      }`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
          isMine ? 'bg-amber-500/30 ring-1 ring-amber-400/40' : 'bg-amber-500/20'
        }`}
      >
        🐕
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-white font-bold text-sm leading-tight truncate">{dogName}</p>
          {isMine && (
            <span className="text-amber-300 text-[9px] font-extrabold uppercase tracking-wider bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/30">
              Your Listing
            </span>
          )}
        </div>
        <p className={isMine ? 'text-amber-300/80 text-[10px] font-medium' : 'text-white/40 text-[10px]'}>
          {isMine ? 'Listed by you · ' : `−${defense}% steal · `}
          {timeUntil(listing.deadline)}
        </p>
        <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
          <p className="text-amber-300 font-black text-sm">{totalPrice.toLocaleString()} $FARM</p>
          {qty > 1 && (
            <span className="text-white/40 text-[10px] font-mono">
              ({unitPrice.toLocaleString()} /ea)
            </span>
          )}
        </div>
        {!isMine && listing.seller ? (
          <p className="text-white/25 text-[9px]">by @{listing.seller}</p>
        ) : isMine ? (
          <p className="text-amber-400/50 text-[9px] italic">You cannot buy your own listing</p>
        ) : null}
      </div>
      <div className="flex-shrink-0">
        {isMine ? (
          onCancel ? (
            <button
              disabled={canceling}
              onClick={onCancel}
              className="glass text-red-300 text-xs px-3 py-1.5 rounded-xl active:scale-95 transition-all border border-red-500/40 hover:bg-red-500/20 font-bold flex items-center gap-1 disabled:opacity-40"
              title="Cancel your listing and retrieve dog"
            >
              {canceling ? <Loader2 size={11} className="animate-spin" /> : null}
              Cancel
            </button>
          ) : (
            <span className="glass text-white/40 text-xs px-2.5 py-1.5 rounded-xl font-bold border border-white/10 select-none cursor-default">
              Your NFT
            </span>
          )
        ) : (
          <button
            disabled={busy}
            onClick={onBuy}
            className="text-xs px-3.5 py-1.5 rounded-xl font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1 min-w-[64px] justify-center text-white shadow-md"
            style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : null}
            {busy ? stepLabel(buyStep as any).replace('…', '') : 'Buy'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Item Listing Card (user_items) ────────────────────────────────────────────

function ItemListingCard({ listing, onBuy, onCancel, isMine, buying, canceling }: {
  listing: MarketplaceListing;
  onBuy?: () => void; onCancel?: () => void;
  isMine: boolean; buying?: boolean; canceling?: boolean;
}) {
  const icon = itemIcon(listing.itemType ?? '');
  const label = itemLabel(listing.itemType ?? '');
  const qty = Number(listing.quantity || 1);
  const totalPrice = Number(listing.priceFarm || 0);
  const unitPrice = qty > 0 ? Math.round(totalPrice / qty) : totalPrice;

  return (
    <div
      className={`rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
        isMine ? 'glass bg-amber-500/10 border border-amber-400/40 shadow-sm' : 'glass'
      }`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
          isMine ? 'bg-amber-500/25 ring-1 ring-amber-400/30' : 'bg-emerald-500/20'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-white font-bold text-sm leading-tight truncate">{label}</p>
          {isMine && (
            <span className="text-amber-300 text-[9px] font-extrabold uppercase tracking-wider bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/30">
              Your Listing
            </span>
          )}
        </div>
        <p className={isMine ? 'text-amber-300/80 text-[10px] font-medium' : 'text-white/40 text-[10px]'}>
          x{qty} · {isMine ? 'Listed by you · ' : ''}{timeUntil(listing.deadline)}
        </p>
        <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
          <p className="text-emerald-300 font-black text-sm">{totalPrice.toLocaleString()} GOLD</p>
          {qty > 1 && (
            <span className="text-white/40 text-[10px] font-mono">
              ({unitPrice.toLocaleString()} /ea)
            </span>
          )}
        </div>
        {!isMine && listing.seller ? (
          <p className="text-white/25 text-[9px]">by @{listing.seller}</p>
        ) : isMine ? (
          <p className="text-amber-400/50 text-[9px] italic">You cannot buy your own listing</p>
        ) : null}
      </div>
      <div className="flex-shrink-0">
        {isMine ? (
          onCancel ? (
            <button
              disabled={canceling}
              onClick={onCancel}
              className="glass text-red-300 text-xs px-3 py-1.5 rounded-xl active:scale-95 transition-all border border-red-500/40 hover:bg-red-500/20 font-bold flex items-center gap-1 disabled:opacity-40"
              title="Cancel your listing and return items to storage"
            >
              {canceling ? <Loader2 size={11} className="animate-spin" /> : null}
              Cancel
            </button>
          ) : (
            <span className="glass text-white/40 text-xs px-2.5 py-1.5 rounded-xl font-bold border border-white/10 select-none cursor-default">
              Your Item
            </span>
          )
        ) : (
          <button
            disabled={buying}
            onClick={onBuy}
            className="text-xs px-3.5 py-1.5 rounded-xl font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1 min-w-[64px] justify-center text-white shadow-md"
            style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
          >
            {buying ? <Loader2 size={11} className="animate-spin" /> : 'Buy'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Buy Confirmation Dialog ──────────────────────────────────────────────────

function BuyConfirmDialog({
  listing,
  userGold,
  isPending,
  onConfirm,
  onClose,
}: {
  listing: MarketplaceListing;
  userGold: number;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const icon = itemIcon(listing.itemType ?? '');
  const label = itemLabel(listing.itemType ?? '');
  const qty = Number(listing.quantity || 1);
  const totalPrice = Number(listing.priceFarm || 0);
  const unitPrice = qty > 0 ? Math.round(totalPrice / qty) : totalPrice;
  const canAfford = userGold >= totalPrice;
  const remainingGold = Math.max(0, userGold - totalPrice);
  const shortage = Math.max(0, totalPrice - userGold);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-3xl p-5 w-full max-w-sm border border-white/10 shadow-2xl flex flex-col gap-4 slide-up" onClick={(e) => e.stopPropagation()}>
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <h3 className="text-white font-black text-sm">Confirm Purchase</h3>
          </div>
          <button onClick={onClose} disabled={isPending} className="glass rounded-full p-1.5 text-white/50 hover:text-white transition-all">
            <X size={14} />
          </button>
        </div>

        {/* Item Info Box */}
        <div className="glass rounded-2xl p-3.5 flex items-center gap-3 bg-white/5 border border-white/5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{label}</p>
            <p className="text-white/40 text-xs mt-0.5">
              Quantity: <span className="text-white/80 font-bold font-mono">x{qty}</span>
              {qty > 1 && ` · ${unitPrice.toLocaleString()} GOLD/ea`}
            </p>
          </div>
        </div>

        {/* Price & Balance Breakdown */}
        <div className="glass rounded-xl p-3 flex flex-col gap-2 text-xs border border-white/5">
          <div className="flex justify-between items-center text-white/60">
            <span>Total Price</span>
            <span className="text-emerald-300 font-black text-sm font-mono">{totalPrice.toLocaleString()} GOLD</span>
          </div>
          <div className="flex justify-between items-center text-white/60">
            <span>Your Balance</span>
            <span className="text-white font-semibold font-mono">{Math.floor(userGold).toLocaleString()} GOLD</span>
          </div>
          <div className="border-t border-white/10 pt-2 flex justify-between items-center">
            <span className="text-white/80 font-medium">Balance After Purchase</span>
            <span className={`font-mono font-bold ${canAfford ? 'text-white' : 'text-red-400'}`}>
              {canAfford ? `${Math.floor(remainingGold).toLocaleString()} GOLD` : 'Insufficient'}
            </span>
          </div>
        </div>

        {!canAfford && (
          <div className="glass rounded-xl p-2.5 bg-red-950/30 border border-red-500/30 flex items-center gap-2 text-red-300 text-xs">
            <AlertTriangle size={14} className="flex-shrink-0 text-red-400" />
            <span>You need <b>{shortage.toLocaleString()} more GOLD</b> to purchase this listing.</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl glass font-bold text-xs text-white/60 hover:text-white active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canAfford || isPending}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl font-black text-xs text-white flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={canAfford ? { background: 'linear-gradient(135deg, #059669, #047857)' } : { background: 'rgba(255,255,255,0.08)' }}
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            <span>{isPending ? 'Purchasing…' : 'Confirm Buy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Browse Item Listings Tab ──────────────────────────────────────────────────

function BrowseItemsTab({ baseQueryKey, filterTypes, clientFilter, emptyLabel, onSwitchToSell }: {
  baseQueryKey: string;
  filterTypes: { value: string; label: string }[];
  clientFilter?: (l: MarketplaceListing) => boolean;
  emptyLabel: string;
  onSwitchToSell?: () => void;
}) {
  const queryClient = useQueryClient();

  // Filter state
  const [filter, setFilter]       = useState('all');
  const [sortIdx, setSortIdx]     = useState(0); // index into SORT_OPTIONS
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice]   = useState('');
  const [maxPrice, setMaxPrice]   = useState('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [allItems, setAllItems] = useState<MarketplaceListing[]>([]);

  // Current user & myListings detection
  const { profile } = useGame();
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const { data: myListings = [] } = useQuery<MarketplaceListing[]>({
    queryKey: ['my-marketplace-listings'],
    queryFn: api.getMyMarketplaceListings,
    staleTime: 15_000,
  });

  const myListingIds = useMemo(
    () => new Set(myListings.filter(l => l.status === 'active').map(l => l.id)),
    [myListings],
  );

  // Buy state
  const [buyingId, setBuyingId]         = useState<string | null>(null);
  const [confirmListing, setConfirmListing] = useState<MarketplaceListing | null>(null);
  const [buySuccess, setBuySuccess]     = useState<string | null>(null);
  const [buyError, setBuyError]         = useState<string | null>(null);

  const cancelMut = useMutation({
    mutationFn: (id: string) => {
      setCancelingId(id);
      return api.cancelMarketplaceListing(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [baseQueryKey] });
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['crop-market-listings'] });
      queryClient.invalidateQueries({ queryKey: ['tool-market-listings'] });
      setCancelingId(null);
      setBuySuccess('Listing cancelled! Items returned to your storage.');
      resetAndFetch();
    },
    onError: (err: any) => {
      setCancelingId(null);
      setBuyError(`Failed to cancel: ${err?.message || 'Unknown error'}`);
    },
  });

  const sortOpt = SORT_OPTIONS[sortIdx];

  const buildQueryParams = useCallback((currentOffset: number) => ({
    limit: PAGE_SIZE,
    offset: currentOffset,
    assetType: 'user_items' as const,
    itemType: filter === 'all' ? undefined : filter,
    sortBy: sortOpt.value,
    order: sortOpt.defaultOrder,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  }), [filter, sortOpt, minPrice, maxPrice]);

  const queryKey = [baseQueryKey, filter, sortIdx, minPrice, maxPrice, offset];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => api.getMarketplaceListings(buildQueryParams(offset)),
    staleTime: 30_000,
    // Merge results into allItems when offset changes
    select: (res) => res,
  });

  // When offset resets (new filter/sort), clear accumulated list
  const resetAndFetch = useCallback(() => {
    setAllItems([]);
    setOffset(0);
  }, []);

  // Apply clientFilter on fetched items (for 'all' case where backend returns mixed types)
  const fetchedItems = (data?.items ?? []).filter(
    (l) => !clientFilter || filter !== 'all' || clientFilter(l),
  );

  // Accumulate pages
  const displayItems = offset === 0 ? fetchedItems : [...allItems, ...fetchedItems.filter(
    (n) => !allItems.some((e) => e.id === n.id),
  )];

  const total = data?.total ?? 0;
  const hasMore = displayItems.length < total;

  const handleLoadMore = () => {
    setAllItems(displayItems);
    setOffset((prev) => prev + PAGE_SIZE);
  };

  const handleFilterChange = (val: string) => { setFilter(val); resetAndFetch(); };
  const handleSortChange   = (idx: number)  => { setSortIdx(idx); resetAndFetch(); };
  const handlePriceApply   = () => { resetAndFetch(); setShowFilters(false); };
  const handlePriceClear   = () => { setMinPrice(''); setMaxPrice(''); resetAndFetch(); setShowFilters(false); };

  const buyMut = useMutation({
    mutationFn: (id: string) => api.buyItemListing(id),
    onMutate: (id) => { setBuyingId(id); setBuyError(null); setBuySuccess(null); },
    onSuccess: (res) => {
      setBuyingId(null);
      setConfirmListing(null);
      setBuySuccess(`Bought ${res.quantity}x ${itemLabel(res.itemType)}!`);
      queryClient.invalidateQueries({ queryKey: [baseQueryKey] });
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['dailyQuests'] });
      resetAndFetch();
    },
    onError: (e: Error) => { setBuyingId(null); setBuyError(e.message); },
  });

  const chips = [{ value: 'all', label: 'All' }, ...filterTypes];
  const hasActivePrice = minPrice || maxPrice;

  return (
    <div className="flex flex-col gap-2.5">
      {onSwitchToSell && (
        <div
          onClick={onSwitchToSell}
          className="glass rounded-2xl px-4 py-3 flex items-center justify-between cursor-pointer border border-amber-500/20 hover:border-amber-500/40 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2">
            <span>📦</span>
            <span className="text-xs text-white/80">Want to sell your own items?</span>
          </div>
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
            Go to Sell →
          </span>
        </div>
      )}
      {/* Sort row */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 overflow-x-auto pb-0.5 flex-1 -mx-0.5 px-0.5">
          {SORT_OPTIONS.map((opt, i) => (
            <button key={`${opt.value}-${opt.defaultOrder}`} onClick={() => handleSortChange(i)}
              className={`flex-shrink-0 flex items-center gap-1 text-xs px-4 py-2.5 rounded-full font-bold transition-all ${
                sortIdx === i ? 'bg-violet-600/70 text-white' : 'glass text-white/40'
              }`}>
              <ArrowUpDown size={9} />
              {opt.label}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex-shrink-0 flex items-center gap-1 text-xs px-4 py-2.5 rounded-full font-bold transition-all ${
            showFilters || hasActivePrice ? 'bg-amber-500/30 text-amber-300' : 'glass text-white/40'
          }`}
        >
          <SlidersHorizontal size={10} />
          Filter
          {hasActivePrice && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
        </button>
      </div>

      {/* Price filter panel */}
      {showFilters && (
        <div className="glass rounded-2xl p-3 flex flex-col gap-2">
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide">Price range (GOLD/$FARM)</p>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min"
              className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-white text-xs outline-none placeholder:text-white/25"
            />
            <span className="text-white/30 text-xs">—</span>
            <input
              type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-white text-xs outline-none placeholder:text-white/25"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handlePriceApply}
              className="flex-1 py-2 rounded-xl text-xs font-black text-white bg-violet-600/70 active:scale-95 transition-all">
              Apply
            </button>
            {hasActivePrice && (
              <button onClick={handlePriceClear}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white/50 glass active:scale-95 transition-all">
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Type filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {chips.map(opt => (
          <button key={opt.value} onClick={() => handleFilterChange(opt.value)}
            className={`flex-shrink-0 text-xs px-4 py-2 rounded-full font-bold transition-all ${
              filter === opt.value ? 'bg-white/15 text-white' : 'glass text-white/40'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Result count */}
      {!isLoading && total > 0 && (
        <p className="text-white/25 text-[10px] text-right -mt-1">
          Showing {displayItems.length}/{total} results
        </p>
      )}

      {/* Feedback banners */}
      {buySuccess && (
        <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
          <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
          <span className="text-green-300 text-xs">{buySuccess}</span>
          <button onClick={() => setBuySuccess(null)} className="ml-auto text-white/30 text-[10px]">✕</button>
        </div>
      )}
      {buyError && (
        <div className="glass rounded-xl px-3 py-2 text-red-400 text-xs">
          ❌ {buyError}
          <button onClick={() => setBuyError(null)} className="ml-2 underline text-white/30">dismiss</button>
        </div>
      )}

      {/* Items */}
      {isLoading && offset === 0 && (
        <div className="text-center py-10 text-white/40 text-sm">Loading…</div>
      )}
      {!isLoading && displayItems.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <span className="text-4xl opacity-20">📦</span>
          <p className="text-white/30 text-sm">{emptyLabel}</p>
        </div>
      )}

      {/* Buy Confirmation Dialog */}
      {confirmListing && (
        <BuyConfirmDialog
          listing={confirmListing}
          userGold={profile?.goldBalance || 0}
          isPending={buyingId === confirmListing.id}
          onConfirm={() => buyMut.mutate(confirmListing.id)}
          onClose={() => setConfirmListing(null)}
        />
      )}

      {displayItems.map(l => {
        const isMine = myListingIds.has(l.id) ||
          (!!profile?.id && l.sellerId === profile.id) ||
          (!!profile?.username && l.seller === profile.username);
        return (
          <ItemListingCard
            key={l.id}
            listing={l}
            isMine={isMine}
            buying={buyingId === l.id}
            canceling={cancelingId === l.id}
            onBuy={() => setConfirmListing(l)}
            onCancel={() => cancelMut.mutate(l.id)}
          />
        );
      })}

      {/* Load More */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={isFetching}
          className="w-full py-3 glass rounded-2xl text-white/50 text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
        >
          {isFetching ? (
            <><Loader2 size={13} className="animate-spin" /> Loading…</>
          ) : (
            <><ChevronDown size={13} /> Load more ({total - displayItems.length} left)</>
          )}
        </button>
      )}
    </div>
  );
}

// ── My Item Listings Tab ──────────────────────────────────────────────────────

function MyItemListingsTab({ category }: { category: 'crops' | 'tools' }) {
  const queryClient = useQueryClient();
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const { data: allListings = [], isLoading } = useQuery({
    queryKey: ['my-marketplace-listings'],
    queryFn: api.getMyMarketplaceListings,
    staleTime: 15_000,
  });

  const listings = allListings.filter(l => {
    if (!l.assetType || l.assetType === 'nft') return false;
    if (l.status !== 'active') return false;
    const it = l.itemType ?? '';
    if (category === 'tools') return TOOL_ITEM_TYPES.includes(it);
    return it.startsWith('crate_') || it.startsWith('seed_');
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
      queryClient.invalidateQueries({ queryKey: ['tool-market-listings'] });
      setCancelingId(null);
    },
    onError: () => setCancelingId(null),
  });

  if (isLoading) return <div className="text-center py-10 text-white/40 text-sm">Loading…</div>;
  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-center">
        <List size={36} className="text-white/20" />
        <p className="text-white/30 text-sm">No active listings</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {listings.map(l => (
        <ItemListingCard key={l.id} listing={l} isMine
          canceling={cancelingId === l.id}
          onCancel={() => cancelMut.mutate(l.id)} />
      ))}
    </div>
  );
}

// ── Sell Items Tab (Crates / Rare Seeds / Tools) ──────────────────────────────

function SellItemsTab({
  category,
  onGoToBrowse,
  onGoToMyListings,
}: {
  category: 'crops' | 'tools';
  onGoToBrowse: () => void;
  onGoToMyListings: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [deadlineDays, setDeadlineDays] = useState(1);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [packingKey, setPackingKey] = useState<string | null>(null);

  const { data: barnData, isLoading: barnLoading } = useQuery<BarnData>({
    queryKey: ['barnData'],
    queryFn: api.getBarnInventory,
    staleTime: 10_000,
  });

  const { data: allListings = [] } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ['tool-market-listings'] });
      setCancelingId(null);
      setFeedbackMsg('Listing cancelled! Item returned to available storage.');
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
    onError: (err: any) => {
      setCancelingId(null);
      setFeedbackMsg(`Failed to cancel: ${err?.message || 'Unknown error'}`);
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
  });

  const listMut = useMutation({
    mutationFn: (data: { itemType: string; quantity: number; priceFarm: number; deadline: string }) =>
      api.createItemListing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['crop-market-listings'] });
      queryClient.invalidateQueries({ queryKey: ['tool-market-listings'] });
      setSelectedItem(null);
      setQty('1');
      setPrice('');
      setFeedbackMsg('Listing created successfully!');
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
  });

  const packMut = useMutation({
    mutationFn: ({ ck, count }: { ck: string; count: number }) => {
      setPackingKey(ck);
      return api.packCrate(ck, count);
    },
    onSuccess: (data) => {
      setPackingKey(null);
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      setFeedbackMsg(data.message || 'Crates packed successfully!');
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
    onError: (err: any) => {
      setPackingKey(null);
      setFeedbackMsg(`Pack error: ${err?.message || 'Failed to pack crate'}`);
      setTimeout(() => setFeedbackMsg(null), 3500);
    },
  });

  if (barnLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-white/40 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading storage items…
      </div>
    );
  }

  const items: InventoryItem[] = category === 'crops'
    ? [...(barnData?.crates ?? []), ...(barnData?.seeds ?? [])].filter((i: InventoryItem) => i.quantity > 0)
    : (barnData?.tools ?? []).filter((t: InventoryItem) => TOOL_ITEM_TYPES.includes(t.itemType) && t.quantity > 0);

  const packableCrops: InventoryItem[] = category === 'crops'
    ? (barnData?.crops ?? []).filter((c: InventoryItem) => {
        const ck = cropKey(c.itemType);
        const req = CROP_PACK_SIZE[ck] ?? 100;
        return c.available >= req;
      })
    : [];

  const activeMyListings = allListings.filter(l => {
    if (!l.assetType || l.assetType === 'nft') return false;
    if (l.status !== 'active') return false;
    const it = l.itemType ?? '';
    if (category === 'tools') return TOOL_ITEM_TYPES.includes(it);
    return it.startsWith('crate_') || it.startsWith('seed_');
  });

  const activeListingMap = new Map(activeMyListings.map(l => [l.itemType, l]));

  const currentItem = items.find((i: InventoryItem) => i.itemType === selectedItem);
  const maxAvailable = currentItem?.available ?? 0;
  const numQty = parseInt(qty, 10);
  const isValidQty = !isNaN(numQty) && numQty >= 1 && numQty <= maxAvailable;
  const numPrice = Number(price);
  const isValidPrice = !isNaN(numPrice) && numPrice > 0;
  const canSubmit = maxAvailable > 0 && isValidQty && isValidPrice && !listMut.isPending;

  return (
    <div className="flex flex-col gap-3">
      {/* Informational banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-start gap-2.5">
        <span className="text-xl">{category === 'crops' ? '📦' : '🔧'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-amber-300 text-xs font-bold leading-tight">
            {category === 'crops' ? 'Sell Crates & Seeds on Market' : 'Sell Tools & Shards on Market'}
          </p>
          <p className="text-white/60 text-[11px] mt-0.5 leading-normal">
            {category === 'crops'
              ? 'List your bundled crates and rare seeds for other players to buy with GOLD. Active listings lock crate quantity in Storage until sold or cancelled.'
              : 'List tools or Soul Shards for GOLD. Items remain locked until bought or cancelled.'}
          </p>
        </div>
      </div>

      {/* Status / Feedback message */}
      {feedbackMsg && (
        <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 border border-green-500/30">
          <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
          <span className="text-green-300 text-xs font-bold">{feedbackMsg}</span>
        </div>
      )}

      {/* Error display */}
      {listMut.error && (
        <div className="glass rounded-xl px-3 py-2 text-red-400 text-xs border border-red-500/30">
          ❌ {(listMut.error as Error).message}
        </div>
      )}

      {/* Packable raw crops helper (only under crops) */}
      {category === 'crops' && packableCrops.length > 0 && (
        <div className="glass rounded-2xl p-3 flex flex-col gap-2 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-emerald-300 text-xs font-bold flex items-center gap-1.5">
              <span>🌾</span>
              <span>Harvested Crops Ready to Pack</span>
            </span>
            <span className="text-white/30 text-[10px]">1 Crate = bundle to sell</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {packableCrops.map((crop: InventoryItem) => {
              const ck = cropKey(crop.itemType);
              const packSize = CROP_PACK_SIZE[ck] ?? 100;
              const maxPossible = Math.floor(crop.available / packSize);
              return (
                <div key={crop.itemType} className="flex items-center justify-between bg-white/5 rounded-xl px-2.5 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{itemIcon(crop.itemType)}</span>
                    <div>
                      <p className="text-white/90 text-xs font-semibold">{itemLabel(crop.itemType)}</p>
                      <p className="text-white/40 text-[10px]">
                        {crop.available.toLocaleString()} available ({packSize}/crate · can pack {maxPossible})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      disabled={packMut.isPending}
                      onClick={() => packMut.mutate({ ck, count: 1 })}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1 text-white shadow-sm"
                      style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
                    >
                      {packingKey === ck ? <Loader2 size={10} className="animate-spin" /> : '📦'}
                      Pack 1
                    </button>
                    {maxPossible > 1 && (
                      <button
                        disabled={packMut.isPending}
                        onClick={() => packMut.mutate({ ck, count: maxPossible })}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1 text-emerald-300 glass border border-emerald-500/40 hover:bg-emerald-500/20 shadow-sm"
                      >
                        Pack All ({maxPossible})
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3 text-center">
          <span className="text-4xl opacity-20">{category === 'crops' ? '📦' : '🔧'}</span>
          <p className="text-white font-bold text-sm">
            {category === 'crops' ? 'No Crates or Seeds in Storage' : 'No Tools in Storage'}
          </p>
          <p className="text-white/40 text-xs max-w-xs leading-relaxed">
            {category === 'crops'
              ? 'Harvest crops from your plots and pack them into Crates to sell them here, or browse market offerings.'
              : 'Obtain tools through events or smash dogs in Gacha to acquire Soul Shards.'}
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={onGoToBrowse}
              className="text-xs px-4 py-2 rounded-xl font-bold glass text-amber-300 active:scale-95 transition-all"
            >
              Browse Market →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item: InventoryItem) => {
            const activeListing = activeListingMap.get(item.itemType);
            const isEditing = selectedItem === item.itemType;
            const ck = cropKey(item.itemType);
            const packSize = CROP_PACK_SIZE[ck];

            return (
              <div key={item.itemType} className="glass rounded-2xl p-3 flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl flex-shrink-0">
                    {itemIcon(item.itemType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm leading-tight">{itemLabel(item.itemType)}</p>
                    <p className="text-white/40 text-[10px]">
                      x{item.available} available
                      {item.lockedQuantity > 0 ? ` · ${item.lockedQuantity} listed` : ''}
                      {packSize ? ` (${packSize} crops/crate)` : ''}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {activeListing ? (
                      <button
                        onClick={() => cancelMut.mutate(activeListing.id)}
                        disabled={cancelingId === activeListing.id}
                        className="glass text-red-300 text-xs px-3 py-1.5 rounded-xl active:scale-95 transition-all border border-red-500/30 hover:bg-red-500/20 font-bold flex items-center gap-1 disabled:opacity-40"
                      >
                        {cancelingId === activeListing.id ? <Loader2 size={11} className="animate-spin" /> : null}
                        Cancel Listing
                      </button>
                    ) : (
                      <button
                        disabled={item.available <= 0}
                        onClick={() => {
                          if (isEditing) {
                            setSelectedItem(null);
                          } else {
                            setSelectedItem(item.itemType);
                            setQty('1');
                            setPrice('');
                          }
                        }}
                        className={`text-xs px-3.5 py-1.5 rounded-xl font-bold active:scale-95 transition-all disabled:opacity-30 ${
                          isEditing ? 'glass text-white/50' : 'text-white shadow-sm'
                        }`}
                        style={isEditing ? {} : { background: 'linear-gradient(135deg, #d97706, #b45309)' }}
                      >
                        {isEditing ? 'Cancel' : 'Sell'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Active listing info card if listed */}
                {activeListing && (
                  <div className="glass rounded-xl px-3 py-2 flex items-center justify-between border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-300 font-bold">Active Listing:</span>
                      <span className="text-white text-xs font-semibold">x{Number(activeListing.quantity)}</span>
                      <span className="text-white/40 text-[10px]">·</span>
                      <span className="text-amber-300 text-xs font-black">{Number(activeListing.priceFarm).toLocaleString()} GOLD</span>
                    </div>
                    <span className="text-white/40 text-[10px]">{timeUntil(activeListing.deadline)}</span>
                  </div>
                )}

                {/* Inline listing form */}
                {isEditing && (
                  <div className="mt-1 border-t border-white/10 pt-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white/70 text-xs font-semibold">Set Price &amp; Quantity</span>
                      <span className="text-amber-300 text-[10px] font-bold">{item.available} available to list</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-white/30 text-[9px] mb-1">Quantity (max {item.available})</p>
                        <div className="glass rounded-lg flex items-center px-2">
                          <input
                            type="number"
                            min={1}
                            max={item.available}
                            value={qty}
                            onChange={e => setQty(e.target.value)}
                            className="flex-1 bg-transparent text-white text-xs py-1.5 outline-none w-0"
                          />
                        </div>
                        {qty && !isValidQty && (
                          <p className="text-red-400 text-[8px] mt-0.5">Must be 1 to {item.available}</p>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white/30 text-[9px] mb-1">Total Price (GOLD)</p>
                        <div className="glass rounded-lg flex items-center px-2 gap-1">
                          <input
                            type="number"
                            min={1}
                            value={price}
                            onChange={e => setPrice(e.target.value)}
                            placeholder="0"
                            className="flex-1 bg-transparent text-white text-xs py-1.5 outline-none w-0 placeholder:text-white/20"
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
                          onClick={() => setDeadlineDays(opt.days)}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                            deadlineDays === opt.days
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
                        itemType: item.itemType,
                        quantity: numQty,
                        priceFarm: numPrice,
                        deadline: new Date(Date.now() + deadlineDays * 86_400_000).toISOString(),
                      })}
                      className="py-2 rounded-xl font-bold text-xs active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5 text-white"
                      style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
                    >
                      {listMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <ShoppingBag size={12} />}
                      Create Listing ({numPrice > 0 ? `${numPrice.toLocaleString()} GOLD` : '0 GOLD'})
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── All My Listings Tab (Unified Overview) ───────────────────────────────────

function AllMyListingsTab() {
  const queryClient = useQueryClient();
  const [filterCat, setFilterCat] = useState<'all' | 'items' | 'nft'>('all');
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  const { data: allListings = [], isLoading } = useQuery({
    queryKey: ['my-marketplace-listings'],
    queryFn: api.getMyMarketplaceListings,
    staleTime: 15_000,
  });

  const activeListings = allListings.filter(l => l.status === 'active');

  const cancelMut = useMutation({
    mutationFn: (id: string) => {
      setCancelingId(id);
      return api.cancelMarketplaceListing(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['nftStatus'] });
      queryClient.invalidateQueries({ queryKey: ['crop-market-listings'] });
      queryClient.invalidateQueries({ queryKey: ['tool-market-listings'] });
      queryClient.invalidateQueries({ queryKey: ['nft-marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['myFarm'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setCancelingId(null);
      setCancelSuccess('Listing cancelled successfully! Items returned to your storage.');
      setTimeout(() => setCancelSuccess(null), 3500);
    },
    onError: (err: any) => {
      setCancelingId(null);
      setCancelSuccess(`Failed to cancel: ${err?.message || 'Unknown error'}`);
      setTimeout(() => setCancelSuccess(null), 3500);
    },
  });

  const filtered = activeListings.filter(l => {
    if (filterCat === 'nft') return l.assetType === 'nft';
    if (filterCat === 'items') return l.assetType === 'user_items';
    return true;
  });

  if (isLoading) {
    return (
      <div className="text-center py-12 text-white/40 text-sm flex items-center justify-center gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading your active listings…
      </div>
    );
  }

  if (activeListings.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl">📋</div>
        <p className="text-white font-bold text-sm">No Active Listings</p>
        <p className="text-white/40 text-xs max-w-xs leading-relaxed">
          You have no items or Guard Dog NFTs currently listed. Open Storage to list Crates, Tools, or Soul Shards!
        </p>
      </div>
    );
  }

  const itemsCount = activeListings.filter(l => l.assetType === 'user_items').length;
  const nftsCount = activeListings.filter(l => l.assetType === 'nft').length;

  return (
    <div className="flex flex-col gap-3">
      {cancelSuccess && (
        <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 border border-green-500/30">
          <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
          <span className="text-green-300 text-xs font-bold">{cancelSuccess}</span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setFilterCat('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            filterCat === 'all' ? 'bg-amber-500/25 text-amber-300 border border-amber-500/30' : 'glass text-white/40'
          }`}
        >
          All ({activeListings.length})
        </button>
        {itemsCount > 0 && (
          <button
            onClick={() => setFilterCat('items')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterCat === 'items' ? 'bg-amber-500/25 text-amber-300 border border-amber-500/30' : 'glass text-white/40'
            }`}
          >
            📦 Items &amp; Crates ({itemsCount})
          </button>
        )}
        {nftsCount > 0 && (
          <button
            onClick={() => setFilterCat('nft')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterCat === 'nft' ? 'bg-amber-500/25 text-amber-300 border border-amber-500/30' : 'glass text-white/40'
            }`}
          >
            🐕 Guard Dog NFTs ({nftsCount})
          </button>
        )}
      </div>

      {/* Listing Cards */}
      <div className="flex flex-col gap-2">
        {filtered.map(l => {
          if (l.assetType === 'nft') {
            return (
              <ListingCard
                key={l.id}
                listing={l}
                isMine
                canceling={cancelingId === l.id}
                onCancel={() => cancelMut.mutate(l.id)}
              />
            );
          }
          return (
            <ItemListingCard
              key={l.id}
              listing={l}
              isMine
              canceling={cancelingId === l.id}
              onCancel={() => cancelMut.mutate(l.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── NFT Sell Tab ──────────────────────────────────────────────────────────────

interface SellTabProps {
  walletAddress?: string | null;
  telegramId?: number | string | null;
  onGoToMyListings?: () => void;
  onGoToBrowse?: () => void;
}

interface BreedGroup {
  tokenId: number;
  dogName: string;
  defensePower: number;
  totalOwned: number;
  guardingCount: number;
  storedCount: number;
  activeListingCount: number;
  availableToList: number;
}

function SellTab({ walletAddress, telegramId, onGoToMyListings, onGoToBrowse }: SellTabProps) {
  const qc = useQueryClient();
  const { data: nftStatus, isLoading: nftLoading, refetch: refetchNfts } = useQuery({
    queryKey: ['nftStatus'],
    queryFn: api.getNftStatus,
    enabled: !!walletAddress,
    staleTime: 30_000,
  });

  const { data: myListings = [] } = useQuery<MarketplaceListing[]>({
    queryKey: ['my-marketplace-listings'],
    queryFn: api.getMyMarketplaceListings,
    enabled: !!walletAddress,
    staleTime: 30_000,
  });

  const syncMutation = useMutation({
    mutationFn: api.syncNft,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nftStatus'] });
      refetchNfts();
    },
  });

  const { createListing, step, txHash, error, reset } = useCreateListing();
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [price, setPrice] = useState('10000');
  const [deadlineDays, setDeadlineDays] = useState(7);

  const isPending = step !== 'idle' && step !== 'success' && step !== 'error';
  const isSuccess = step === 'success';

  // Group owned dogs by breed tokenId so duplicate tokenIds (e.g. 5 Corgis) are merged cleanly
  const { sellableBreeds, guardingOnlyBreeds, totalOwnedNfts } = useMemo(() => {
    const owned = nftStatus?.ownedBreeds ?? [];
    const activeNftListings = myListings.filter(l => l.assetType === 'nft' && l.status === 'active');

    const map = new Map<number, BreedGroup>();
    for (const d of owned) {
      let b = map.get(d.tokenId);
      if (!b) {
        const name = DOG_NAMES[d.tokenId] ?? d.dogType ?? `Dog #${d.tokenId}`;
        const activeCount = activeNftListings.filter(l => l.tokenId === d.tokenId).length;
        b = {
          tokenId: d.tokenId,
          dogName: name,
          defensePower: d.defensePower || DOG_DEFENSE[d.tokenId] || 0,
          totalOwned: 0,
          guardingCount: 0,
          storedCount: 0,
          activeListingCount: activeCount,
          availableToList: 0,
        };
        map.set(d.tokenId, b);
      }
      b.totalOwned++;
      if (d.isGuarding) b.guardingCount++;
      else b.storedCount++;
    }

    for (const b of map.values()) {
      b.availableToList = Math.max(0, b.storedCount - b.activeListingCount);
    }

    const all = Array.from(map.values()).sort((a, b) => b.defensePower - a.defensePower);
    return {
      sellableBreeds: all.filter(b => b.storedCount > 0),
      guardingOnlyBreeds: all.filter(b => b.storedCount === 0 && b.guardingCount > 0),
      totalOwnedNfts: owned.length,
    };
  }, [nftStatus?.ownedBreeds, myListings]);

  // Auto-select first available sellable breed if none selected
  useMemo(() => {
    const available = sellableBreeds.find(b => b.availableToList > 0) ?? sellableBreeds[0];
    if ((selectedTokenId === null || !sellableBreeds.some(b => b.tokenId === selectedTokenId)) && available) {
      setSelectedTokenId(available.tokenId);
    }
  }, [selectedTokenId, sellableBreeds]);

  const selectedBreed = sellableBreeds.find(b => b.tokenId === selectedTokenId);
  const numericPrice = parseFloat(price) || 0;
  const marketFeePct = 5;
  const feeAmount = (numericPrice * marketFeePct) / 100;
  const netEarnings = Math.max(0, numericPrice - feeAmount);

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-center px-4">
        <AlertTriangle size={32} className="text-amber-400" />
        <p className="text-white/50 text-sm">Link a BSC wallet first</p>
        <p className="text-white/25 text-xs">Settings → BSC Wallet</p>
      </div>
    );
  }
  if (nftLoading) return <div className="text-center py-10 text-white/40 text-sm">Loading NFTs…</div>;

  if (totalOwnedNfts === 0) {
    return (
      <div className="flex flex-col items-center py-14 gap-3 text-center px-4">
        <span className="text-4xl">🐕</span>
        <p className="text-white/80 text-sm font-bold">Only On-Chain Guard Dogs can be sold here.</p>
        <p className="text-white/40 text-xs leading-relaxed max-w-xs">
          To sell your Shop Dogs, please Tokenize them in your Storage. Or pull from Gacha to get new NFT dogs!
        </p>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="mt-2 glass px-4 py-2 rounded-xl text-xs text-amber-300 font-bold flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncMutation.isPending ? 'animate-spin' : ''} />
          Sync Wallet NFTs
        </button>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="glass rounded-2xl p-5 flex flex-col items-center gap-4 text-center border border-emerald-500/30 bg-emerald-500/5">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-3xl">
          🎉
        </div>
        <div>
          <h3 className="text-white font-black text-base">Listing Created Successfully!</h3>
          <p className="text-white/60 text-xs mt-1">
            Your Guard Dog NFT is now listed on the decentralized marketplace.
          </p>
        </div>

        <div className="w-full glass rounded-xl p-3 flex flex-col gap-2 text-xs border border-white/5">
          <div className="flex justify-between items-center text-white/60">
            <span>Listed Asset</span>
            <span className="text-white font-bold">{selectedBreed?.dogName ?? `Dog #${selectedTokenId}`}</span>
          </div>
          <div className="flex justify-between items-center text-white/60">
            <span>Listing Price</span>
            <span className="text-amber-400 font-black">{numericPrice.toLocaleString()} $FARM</span>
          </div>
          <div className="flex justify-between items-center text-white/60">
            <span>Net You Receive (95%)</span>
            <span className="text-emerald-400 font-black">+{netEarnings.toLocaleString(undefined, { maximumFractionDigits: 2 })} $FARM</span>
          </div>
          <div className="flex justify-between items-center text-white/60">
            <span>Listing Expires in</span>
            <span className="text-white font-semibold">{deadlineDays} Days</span>
          </div>
          {txHash && (
            <div className="flex justify-between items-center text-white/60 pt-1 border-t border-white/10">
              <span>BSC Tx</span>
              <TxLink hash={txHash} />
            </div>
          )}
        </div>

        <div className="flex flex-col w-full gap-2 mt-1">
          {onGoToMyListings && (
            <button
              onClick={() => { reset(); onGoToMyListings(); }}
              className="w-full py-3 rounded-xl font-black text-xs text-white bg-gradient-to-r from-amber-500 to-amber-600 active:scale-95 transition-all shadow-lg shadow-amber-500/25"
            >
              📋 View My Active Listings
            </button>
          )}
          {onGoToBrowse && (
            <button
              onClick={() => { reset(); onGoToBrowse(); }}
              className="w-full py-2.5 rounded-xl glass text-xs text-white/70 font-bold active:scale-95 transition-all hover:text-white"
            >
              🛒 Browse All Marketplace Listings
            </button>
          )}
          <button
            onClick={reset}
            className="w-full py-1 text-[11px] text-white/40 hover:text-white/70 underline"
          >
            + List Another NFT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {isPending && (
        <div className="glass rounded-xl px-3 py-2.5 flex items-center gap-2 border border-amber-500/30">
          <Loader2 size={14} className="animate-spin text-amber-400 flex-shrink-0" />
          <span className="text-white/80 text-xs font-semibold">{stepLabel(step)}</span>
          {txHash && <TxLink hash={txHash} />}
        </div>
      )}
      {error && (
        <div className="glass rounded-xl px-3 py-2.5 text-red-400 text-xs leading-relaxed border border-red-500/30">
          ❌ {error}
          <button onClick={reset} className="ml-2 underline text-white/50 hover:text-white">retry</button>
        </div>
      )}

      {/* ── Currently Guarding (Non-sellable) ── */}
      {guardingOnlyBreeds.length > 0 && (
        <div>
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1.5">Currently Guarding (not sellable)</p>
          <div className="flex flex-col gap-1.5">
            {guardingOnlyBreeds.map((breed) => (
              <div key={breed.tokenId} className="glass rounded-xl px-3 py-2.5 flex items-center gap-3 opacity-50">
                <span className="text-xl">🐕</span>
                <div className="flex-1">
                  <p className="text-white/80 text-sm font-semibold leading-tight">
                    {breed.dogName}
                  </p>
                  <p className="text-white/35 text-[10px]">−{breed.defensePower}% steal · 🛡️ {breed.guardingCount} guarding</p>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold flex-shrink-0">🛡️ Guarding Farm</span>
              </div>
            ))}
          </div>
          <p className="text-white/25 text-[10px] mt-1 text-center">
            Move dogs to Storage → Guard Dogs to make them sellable
          </p>
        </div>
      )}

      {/* ── Stored Dogs (Available to sell) ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
            {sellableBreeds.length > 0 ? 'Select Guard Dog Breed to Sell' : 'No dogs in storage'}
          </p>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="text-[10px] text-amber-400/80 hover:text-amber-300 flex items-center gap-1 active:scale-95 disabled:opacity-40"
          >
            <RefreshCw size={10} className={syncMutation.isPending ? 'animate-spin' : ''} />
            Sync Wallet
          </button>
        </div>

        {sellableBreeds.length === 0 ? (
          <div className="glass rounded-xl px-4 py-5 text-center flex flex-col items-center gap-2 border border-white/5">
            <span className="text-2xl">📦</span>
            <p className="text-white/60 text-xs font-semibold">All your dogs are guarding</p>
            <p className="text-white/35 text-[11px] leading-relaxed max-w-xs">
              Go to <span className="text-amber-300 font-bold">Storage → Guard Dogs</span> and move a dog to storage to sell it.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sellableBreeds.map((breed) => {
              const isSelected = selectedTokenId === breed.tokenId;
              const isFullyListed = breed.availableToList <= 0;
              return (
                <button
                  key={breed.tokenId}
                  disabled={isPending || isFullyListed}
                  onClick={() => setSelectedTokenId(breed.tokenId)}
                  className={`glass rounded-xl p-3 flex items-center gap-3 text-left transition-all active:scale-98 relative ${
                    isSelected
                      ? 'ring-2 ring-amber-400 bg-amber-500/15 border-amber-400/40'
                      : isFullyListed
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-white/5 border-white/5'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                    🐕
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-bold truncate">
                        {breed.dogName}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold flex-shrink-0">
                        −{breed.defensePower}% steal
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/50">
                      <span>📦 In storage: <b className="text-white/90">{breed.storedCount}</b></span>
                      {breed.guardingCount > 0 && (
                        <span>· 🛡️ Guarding: {breed.guardingCount}</span>
                      )}
                      {breed.activeListingCount > 0 && (
                        <span className="text-amber-400 font-medium">· 🏷️ {breed.activeListingCount} listed</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${
                      isFullyListed
                        ? 'bg-red-500/20 text-red-300'
                        : isSelected
                        ? 'bg-amber-400 text-black'
                        : 'bg-white/10 text-white/70'
                    }`}>
                      {isFullyListed ? 'Listed' : `x${breed.storedCount}`}
                    </span>
                    {isSelected && (
                      <CheckCircle2 size={16} className="text-amber-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Selected Dog Info ── */}
      {selectedBreed && (
        <div className="glass rounded-xl p-3 border border-amber-500/30 bg-amber-500/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-lg">🐕</span>
            <div>
              <p className="text-white font-bold">Listing: 1x {selectedBreed.dogName}</p>
              <p className="text-white/40 text-[10px]">
                {selectedBreed.availableToList > 1
                  ? `${selectedBreed.availableToList - 1} ${selectedBreed.dogName} will remain available in your storage`
                  : 'Last stored dog of this breed will be listed'}
              </p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-1 rounded bg-amber-400/20 text-amber-300 font-bold">
            1 NFT
          </span>
        </div>
      )}

      {/* ── Price Input ($FARM) ── */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Price ($FARM)</p>
          <span className="text-white/30 text-[10px]">P2P Order</span>
        </div>
        <div className="glass rounded-xl flex items-center px-3 py-1 gap-2 border border-white/10 focus-within:border-amber-400/50">
          <input
            type="number"
            min={1}
            step={1}
            value={price}
            disabled={isPending}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 10000"
            className="flex-1 bg-transparent text-white font-bold text-base py-1.5 outline-none placeholder:text-white/20"
          />
          <span className="text-amber-400 text-xs font-black flex-shrink-0 px-2 py-1 rounded-lg bg-amber-400/10">
            $FARM
          </span>
        </div>

        {/* Quick price presets */}
        <div className="flex gap-1.5 mt-2">
          {[100, 500, 1000, 5000, 10000].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={isPending}
              onClick={() => setPrice(String(preset))}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
                price === String(preset)
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  : 'glass text-white/40 hover:text-white/70'
              }`}
            >
              {preset >= 1000 ? `${preset / 1000}k` : preset}
            </button>
          ))}
        </div>

        {/* Fee & Earnings breakdown */}
        {numericPrice > 0 && (
          <div className="mt-2 glass rounded-xl p-2.5 text-[11px] flex flex-col gap-1 border border-white/5">
            <div className="flex justify-between text-white/40">
              <span>Marketplace Fee (5%)</span>
              <span>−{feeAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} $FARM</span>
            </div>
            <div className="flex justify-between text-white/80 font-bold pt-1 border-t border-white/5">
              <span className="text-emerald-400">Net You Receive</span>
              <span className="text-emerald-400 font-black">+{netEarnings.toLocaleString(undefined, { maximumFractionDigits: 2 })} $FARM</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Listing Duration ── */}
      <div>
        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1.5">Listing expires in</p>
        <div className="grid grid-cols-4 gap-1.5">
          {DEADLINE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              disabled={isPending}
              onClick={() => setDeadlineDays(opt.days)}
              className={`glass rounded-xl py-2 text-xs font-bold transition-all active:scale-95 ${
                deadlineDays === opt.days ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40' : 'text-white/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {selectedTokenId !== null && (
        <div className="glass rounded-xl px-3 py-2 text-white/40 text-[10px] leading-relaxed border border-white/5">
          ℹ️ First-time listing requires 1 on-chain approval tx (~0.0002 BNB gas), then gasless EIP-712 signature.
        </div>
      )}

      {/* ── Submit Action Button ── */}
      <button
        disabled={!selectedTokenId || !price || Number(price) <= 0 || isPending || sellableBreeds.length === 0 || (selectedBreed && selectedBreed.availableToList <= 0)}
        onClick={() => {
          if (selectedTokenId && price && Number(price) > 0)
            createListing(selectedTokenId, Number(price), deadlineDays, telegramId, walletAddress);
        }}
        className="w-full py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
        style={(!selectedTokenId || !price || Number(price) <= 0 || isPending || sellableBreeds.length === 0 || (selectedBreed && selectedBreed.availableToList <= 0))
          ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }
          : { background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', boxShadow: '0 0 20px rgba(245,158,11,0.35)' }
        }
      >
        {isPending && <Loader2 size={15} className="animate-spin" />}
        {isPending
          ? stepLabel(step)
          : `🐕 List ${selectedBreed?.dogName || 'Dog'} for ${numericPrice > 0 ? numericPrice.toLocaleString() : ''} $FARM`
        }
      </button>
    </div>
  );
}

function shortAddr(addr?: string | null) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}



// ── DEX Swap Tab ──────────────────────────────────────────────────────────────

function DexSwapTab() {
  const {
    direction,
    fromToken,
    toToken,
    fromAmount,
    setFromAmount,
    toAmount,
    isEstimating,
    toggleDirection,
    setMax,
    setHalf,
    setPercent,
    formattedBnbBalance,
    formattedFarmBalance,
    balLoading,
    refetchBalances,
    step,
    stepLabel,
    baseToken,
    setBaseToken,
    fromBalanceDisplay,
    toBalanceDisplay,
    formattedUsdtBalance,
    txHash,
    error,
    swap,
    reset,
    receipt,
    showResultModal,
    dismissResultModal,
    openResultModal,
    minReceived,
    rateText,
    insufficientBalance,
    isLive,
    killSwitchActive,
    farmPriceUsd,
    farmPriceBnb,
    walletAddress,
  } = usePancakeSwap();

  const { tier, buyTaxPct, sellTaxPct, volume24h } = useDexTier(60_000);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);

  const handleCopyToken = () => {
    if (!FARM_TOKEN_ADDRESS) return;
    navigator.clipboard.writeText(FARM_TOKEN_ADDRESS);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const isPending = step === 'checking' || step === 'approving' || step === 'swapping' || step === 'confirming';
  const canSwap = Boolean(
    walletAddress &&
    !killSwitchActive &&
    fromAmount &&
    Number(fromAmount) > 0 &&
    !insufficientBalance &&
    !isPending
  );

  const nextTierInfo = tier === 1
    ? { target: 10_000, nextTier: 2, buyNext: '2.0%', sellNext: '3.0%' }
    : tier === 2
    ? { target: 100_000, nextTier: 3, buyNext: '1.0%', sellNext: '1.5%' }
    : null;

  const progressPct = nextTierInfo
    ? Math.min(100, Math.round((volume24h / nextTierInfo.target) * 100))
    : 100;

  const bscScanUrl = txHash
    ? (Number(import.meta.env.VITE_BSC_CHAIN_ID || 97) === 56
        ? `https://bscscan.com/tx/${txHash}`
        : `https://testnet.bscscan.com/tx/${txHash}`)
    : null;

  return (
    <div className="flex flex-col gap-3 py-1">
      {/* ── Result Modal (Success / Error Transaction Popup) ── */}
      {showResultModal && receipt && (
        <SwapResultModal
          receipt={receipt}
          onClose={dismissResultModal}
          onRetry={receipt.status === 'error' ? swap : undefined}
        />
      )}

      {/* 1. Live Price Ribbon */}
      <div className="glass-gold rounded-2xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
          <div>
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <span>{isLive ? `$${farmPriceUsd.toFixed(6)}` : '$0.0100'}</span>
              <span className="text-[10px] text-white/50 font-mono">
                {farmPriceBnb > 0 ? `(${farmPriceBnb.toFixed(8)} BNB)` : ''}
              </span>
            </div>
            <p className="text-[10px] text-green-400 font-semibold">PancakeSwap V2 AMM</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-white/40 uppercase font-semibold">Dynamic Peg</div>
          <div className="text-xs font-bold text-amber-400">1 BNB ≈ {farmPriceBnb > 0 ? Math.round(1 / farmPriceBnb).toLocaleString() : '200,000'} FARM</div>
        </div>
      </div>

      {/* 2. Active Web3 Wallet & On-Chain Balances Card */}
      {walletAddress ? (
        <div className="glass rounded-2xl p-3.5 flex flex-col gap-2.5 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-white/70">Web3 Wallet:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(walletAddress);
                    setCopiedWallet(true);
                    setTimeout(() => setCopiedWallet(false), 2000);
                  }}
                  className="flex items-center gap-1 font-mono text-xs font-semibold text-amber-300 hover:text-white active:scale-95 transition-all bg-white/5 px-2 py-0.5 rounded-lg"
                >
                  <span>{shortAddr(walletAddress)}</span>
                  {copiedWallet ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-white/40" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => refetchBalances()}
              disabled={balLoading}
              title="Refresh balances"
              className="glass rounded-xl px-2.5 py-1 text-white/60 hover:text-white active:scale-90 transition-all flex items-center gap-1.5 text-[10px] font-bold"
            >
              <RefreshCw size={11} className={balLoading ? 'animate-spin text-amber-400' : ''} />
              <span>{balLoading ? 'Loading…' : 'Refresh'}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="glass rounded-xl p-2.5 flex flex-col bg-black/25 text-left">
              <div className="flex items-center gap-1 text-white/50 text-[10px] font-bold uppercase truncate">
                <span>🟡</span> <span>BNB</span>
              </div>
              <div className="text-sm font-black text-white font-mono mt-0.5 truncate">
                {balLoading ? '…' : formattedBnbBalance}
              </div>
            </div>

            <div className="glass rounded-xl p-2.5 flex flex-col bg-amber-500/10 border border-amber-500/20 text-left">
              <div className="flex items-center gap-1 text-amber-400 text-[10px] font-bold uppercase truncate">
                <span>🌾</span> <span>$FARM</span>
              </div>
              <div className="text-sm font-black text-amber-300 font-mono mt-0.5 truncate">
                {balLoading ? '…' : formattedFarmBalance}
              </div>
            </div>

            <div className="glass rounded-xl p-2.5 flex flex-col bg-teal-500/10 border border-teal-500/20 text-left">
              <div className="flex items-center gap-1 text-teal-400 text-[10px] font-bold uppercase truncate">
                <span>₮</span> <span>USDT</span>
              </div>
              <div className="text-sm font-black text-teal-300 font-mono mt-0.5 truncate">
                {balLoading ? '…' : formattedUsdtBalance}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 border-t border-white/5">
            <span>Network: BSC Testnet</span>
            {receipt && (
              <button
                type="button"
                onClick={openResultModal}
                className="text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-1"
              >
                <span>View latest Swap receipt</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl p-3.5 border border-amber-500/30 bg-amber-950/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-200">No Web3 Wallet Connected</div>
              <p className="text-[10px] text-amber-300/70 mt-0.5">Link or create a BSC wallet in Settings to trade $FARM</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Kill Switch Alert */}
      {killSwitchActive && (
        <div className="glass rounded-2xl p-3 border border-red-500/40 bg-red-950/30 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-red-300">Kill Switch Activated</div>
            <p className="text-[11px] text-red-200/80 mt-0.5 leading-relaxed">
              Price slippage exceeded 15%. In-app swaps are temporarily restricted to protect liquidity.
            </p>
          </div>
        </div>
      )}

      {/* 4. In-App Native Swap Card */}
      <div className="glass rounded-3xl p-4 flex flex-col gap-2 relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-black text-white uppercase tracking-wider">Instant Swap</span>
          <span className="text-[10px] text-white/40 font-mono">Router: {shortAddr(PANCAKE_ROUTER_ADDRESS)}</span>
        </div>

        {/* Pair Switcher: BNB / FARM vs USDT / FARM */}
        <div
          className="flex items-center justify-between gap-1.5 p-1 bg-black/40 rounded-2xl border border-white/10 mb-1"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setBaseToken('BNB');
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            disabled={isPending}
            className={`flex-1 py-1.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
              baseToken === 'BNB'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>🟡</span>
            <span>BNB / FARM</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setBaseToken('USDT');
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            disabled={isPending}
            className={`flex-1 py-1.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
              baseToken === 'USDT'
                ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/30'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>₮</span>
            <span>USDT / FARM</span>
          </button>
        </div>

        {/* ── FROM CONTAINER ── */}
        <div className="rounded-2xl bg-black/30 border border-white/5 p-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40 font-bold uppercase text-[10px] tracking-wider">You Pay</span>
            <div className="flex items-center gap-1 text-[11px] text-white/50">
              <span>Balance:</span>
              <span className="font-mono font-semibold text-white/90">
                {fromBalanceDisplay} {fromToken === 'FARM' ? '$FARM' : fromToken}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              disabled={isPending}
              className="bg-transparent text-2xl font-black text-white focus:outline-none w-full placeholder:text-white/20 font-mono"
            />

            <div className="glass rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 font-bold text-xs text-white flex-shrink-0">
              <span>{fromToken === 'BNB' ? '🟡' : fromToken === 'USDT' ? '₮' : '🌾'}</span>
              <span>{fromToken === 'FARM' ? '$FARM' : fromToken}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-[10px] text-white/30">
              {fromToken === 'BNB' ? 'Reserve: 0.002 BNB for gas' : fromToken === 'USDT' ? 'BSC BEP-20 USDT' : 'Native Token'}
            </span>
            <div className="flex items-center gap-1">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setPercent(pct)}
                  disabled={isPending}
                  className="glass rounded-md px-2 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-white/10 active:scale-95 transition-all"
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── TOGGLE DIRECTION BUTTON ── */}
        <div className="flex justify-center -my-2 z-10">
          <button
            type="button"
            onClick={toggleDirection}
            disabled={isPending}
            className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-amber-400 hover:text-white hover:bg-amber-500/20 active:scale-90 transition-all shadow-lg"
            title="Switch Swap Direction"
          >
            <ArrowUpDown size={15} />
          </button>
        </div>

        {/* ── TO CONTAINER ── */}
        <div className="rounded-2xl bg-black/30 border border-white/5 p-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40 font-bold uppercase text-[10px] tracking-wider">You Receive (Est.)</span>
            <div className="flex items-center gap-1 text-[11px] text-white/50">
              <span>Balance:</span>
              <span className="font-mono font-semibold text-white/90">
                {toBalanceDisplay} {toToken === 'FARM' ? '$FARM' : toToken}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-2xl font-black text-amber-400 font-mono truncate flex items-center gap-2">
              {isEstimating ? (
                <Loader2 size={20} className="animate-spin text-amber-400" />
              ) : (
                toAmount || '0.0'
              )}
            </div>

            <div className="glass rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 font-bold text-xs text-white flex-shrink-0">
              <span>{toToken === 'BNB' ? '🟡' : toToken === 'USDT' ? '₮' : '🌾'}</span>
              <span>{toToken === 'FARM' ? '$FARM' : toToken}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-white/40">
            <span>Minimum Received:</span>
            <span className="font-mono text-white/70 font-semibold">{minReceived} {toToken === 'FARM' ? '$FARM' : toToken}</span>
          </div>
        </div>

        {/* ── DETAILS SUMMARY ── */}
        <div className="rounded-xl bg-black/20 p-2.5 flex flex-col gap-1 text-[11px] text-white/50 mx-1">
          <div className="flex items-center justify-between">
            <span>Rate:</span>
            <span className="font-mono text-white/80 font-semibold">{rateText}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Transaction Tax ({direction === 'BNB_TO_FARM' || direction === 'USDT_TO_FARM' ? 'Buy' : 'Sell'}):</span>
            <span className="text-amber-400 font-semibold">{direction === 'BNB_TO_FARM' || direction === 'USDT_TO_FARM' ? buyTaxPct : sellTaxPct}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Slippage Tolerance:</span>
            <span className="text-emerald-400 font-semibold">2.0%</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Route:</span>
            <span className="text-white/70 font-mono">PancakeSwap V2 Router (BSC)</span>
          </div>
        </div>

        {/* ── QUICK RESULT BANNER (When popup closed) ── */}
        {receipt && !showResultModal && (
          <div
            onClick={openResultModal}
            className={`rounded-xl p-2.5 glass border cursor-pointer flex items-center justify-between active:scale-[0.99] transition-all mx-1 ${
              receipt.status === 'success'
                ? 'border-green-500/40 bg-green-950/20'
                : 'border-red-500/40 bg-red-950/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {receipt.status === 'success' ? (
                <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
              )}
              <div className="flex flex-col">
                <span className={`text-xs font-semibold ${receipt.status === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                  {receipt.status === 'success' ? 'Latest swap succeeded' : 'Latest swap failed'}
                </span>
                <span className="text-[10px] text-white/50">
                  {receipt.fromAmount} {receipt.fromToken} → {receipt.toAmount} {receipt.toToken}
                </span>
              </div>
            </div>
            <span className="text-[11px] text-amber-400 font-bold underline">
              View Details
            </span>
          </div>
        )}

        {/* ── ACTION BUTTON ── */}
        <button
          type="button"
          onClick={swap}
          disabled={!canSwap}
          className="w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={
            canSwap
              ? {
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#000',
                  boxShadow: '0 8px 24px -4px rgba(245, 158, 11, 0.4)',
                }
              : {
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.4)',
                }
          }
        >
          {isPending && <Loader2 size={18} className="animate-spin" />}
          {!walletAddress
            ? '⚠️ Link Wallet to Swap'
            : killSwitchActive
            ? '⚠️ Swap Paused (High Volatility)'
            : insufficientBalance
            ? `⚠️ Insufficient ${fromToken} Balance`
            : !fromAmount || Number(fromAmount) <= 0
            ? 'Enter Amount'
            : stepLabel}
        </button>
      </div>

      {/* 4. Tax Tier & Volume Card */}
      <div className="glass rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{tier === 3 ? '👑' : tier === 2 ? '🌟' : '⭐'}</span>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Your Tax Tier: <span className="text-amber-400">Tier {tier}</span>
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-semibold">
            {tier === 3 ? 'Whale' : tier === 2 ? 'Pro Trader' : 'Standard'}
          </span>
        </div>

        {/* Tax Rates Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="glass rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-white/40">Buy Tax</span>
            <span className="text-lg font-black text-emerald-400 mt-0.5">{buyTaxPct}</span>
          </div>
          <div className="glass rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-white/40">Sell Tax</span>
            <span className="text-lg font-black text-amber-400 mt-0.5">{sellTaxPct}</span>
          </div>
        </div>

        {/* 24h Volume & Next Tier Progress */}
        <div className="rounded-xl bg-black/20 p-3 mx-1">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-white/50 text-[11px]">24h DEX Volume:</span>
            <span className="font-mono font-bold text-white">
              {Math.round(volume24h).toLocaleString()} $FARM
            </span>
          </div>

          {nextTierInfo ? (
            <>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[10px] text-white/40 flex items-center justify-between">
                <span>Trade {nextTierInfo.target.toLocaleString()} FARM for Tier {nextTierInfo.nextTier}</span>
                <span className="text-emerald-400 font-semibold">{nextTierInfo.buyNext} Buy / {nextTierInfo.sellNext} Sell</span>
              </p>
            </>
          ) : (
            <p className="text-[10px] text-amber-300 font-medium text-center">
              🎉 You have unlocked the lowest DEX trading fees!
            </p>
          )}
        </div>

        {!walletAddress ? (
          <p className="text-[10px] text-amber-300/80 leading-tight text-center mx-1">
            ⚠️ Link your BSC wallet in Settings to track your tax tier and trading volume.
          </p>
        ) : (
          <p className="text-[10px] text-white/35 leading-tight text-center mx-1">
            💡 DEX trading fees directly fund the Treasury Buyback Pool to burn $FARM and support token floor price.
          </p>
        )}
      </div>

      {/* 5. Token Contract Address Box */}
      {FARM_TOKEN_ADDRESS && (
        <div className="glass rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-white/40">
              $FARM Contract Address
            </div>
            <div className="text-xs font-mono text-white/80 mt-0.5">
              {shortAddr(FARM_TOKEN_ADDRESS)}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyToken}
            className="glass rounded-lg px-3 py-1.5 flex items-center gap-1.5 active:scale-95 transition-all text-xs font-semibold"
          >
            {copiedToken ? (
              <>
                <Check size={13} className="text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={13} className="text-white/60" />
                <span className="text-white/80">Copy</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function MarketplaceModal({ onClose, initialSection = 'dex' }: Props) {
  const [section, setSection]   = useState<Section>(initialSection);
  const [nftTab, setNftTab]     = useState<NftTab>('browse');
  const [cropsTab, setCropsTab] = useState<CropsTab>('browse');
  const [toolsTab, setToolsTab] = useState<ToolsTab>('browse');
  const queryClient = useQueryClient();
  const { profile } = useGame();

  const { data: nftData, isLoading: nftLoading } = useQuery({
    queryKey: ['nft-marketplace-listings'],
    queryFn: () => api.getMarketplaceListings({ limit: 50, offset: 0, assetType: 'nft' }),
    staleTime: 30_000,
    enabled: section === 'nft' && nftTab === 'browse',
  });
  const nftListings = nftData?.items ?? [];

  const { data: myListings = [], isLoading: myLoading } = useQuery({
    queryKey: ['my-marketplace-listings'],
    queryFn: api.getMyMarketplaceListings,
    staleTime: 15_000,
  });

  const activeListings = myListings.filter(l => l.status === 'active');
  const myNftListings = activeListings.filter(l => !l.assetType || l.assetType === 'nft');

  const [cancelingNftId, setCancelingNftId] = useState<string | null>(null);

  const cancelMut = useMutation({
    mutationFn: (id: string) => {
      setCancelingNftId(id);
      return api.cancelMarketplaceListing(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      queryClient.invalidateQueries({ queryKey: ['nftStatus'] });
      queryClient.invalidateQueries({ queryKey: ['nft-marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['myFarm'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setCancelingNftId(null);
    },
    onError: () => setCancelingNftId(null),
  });

  const buyHook = useBuyListing();

  const sectionInfo: Record<Section, { title: string; subtitle: string }> = {
    dex:           { title: 'DEX Swap',           subtitle: 'PancakeSwap V2 AMM · Instant $FARM & BNB Swap' },
    nft:           { title: 'NFT Market',         subtitle: 'Buy & sell Guard Dog NFTs with $FARM' },
    crops:         { title: 'Crop Market',        subtitle: 'Trade crates & seasonal seeds' },
    tools:         { title: 'Tools Market',       subtitle: 'Magnifying Glass, Master Key & Soul Shards' },
    'my-listings': { title: 'My Active Listings', subtitle: 'Manage and cancel your active marketplace listings' },
  };

  type TabDef = { id: string; label: string; icon: React.ReactNode };
  let tabs: TabDef[] = [];
  let activeTab: string = '';
  let setTab: (id: string) => void = () => {};

  if (section === 'crops') {
    tabs = [
      { id: 'browse',      label: 'Browse',      icon: <Tag size={11} /> },
      { id: 'sell',        label: 'Sell',        icon: <PlusCircle size={11} /> },
      { id: 'my-listings', label: 'My Listings', icon: <List size={11} /> },
    ];
    activeTab = cropsTab;
    setTab = (id) => setCropsTab(id as CropsTab);
  } else if (section === 'tools') {
    tabs = [
      { id: 'browse',      label: 'Browse',      icon: <Tag size={11} /> },
      { id: 'sell',        label: 'Sell',        icon: <PlusCircle size={11} /> },
      { id: 'my-listings', label: 'My Listings', icon: <List size={11} /> },
    ];
    activeTab = toolsTab;
    setTab = (id) => setToolsTab(id as ToolsTab);
  } else if (section === 'nft') {
    tabs = [
      { id: 'browse',      label: 'Browse',      icon: <Tag size={11} /> },
      { id: 'sell',        label: 'Sell',        icon: <PlusCircle size={11} /> },
      { id: 'my-listings', label: 'My Listings', icon: <List size={11} /> },
    ];
    activeTab = nftTab;
    setTab = (id) => setNftTab(id as NftTab);
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
      <div
        className="relative w-full max-w-2xl glass mx-auto rounded-t-3xl overflow-hidden slide-up flex flex-col max-h-[92vh] sm:max-h-[85vh] pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/25 rounded-full mx-auto mt-2.5 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {section === 'dex' ? (
              <ArrowUpDown size={18} className="text-amber-400 flex-shrink-0" />
            ) : section === 'crops' ? (
              <Tag size={18} className="text-amber-400 flex-shrink-0" />
            ) : section === 'tools' ? (
              <SlidersHorizontal size={18} className="text-amber-400 flex-shrink-0" />
            ) : section === 'my-listings' ? (
              <List size={18} className="text-amber-400 flex-shrink-0" />
            ) : (
              <ShoppingBag size={18} className="text-amber-400 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h2 className="text-white font-black text-base leading-tight truncate">{sectionInfo[section].title}</h2>
              <p className="text-white/40 text-[11px] truncate">{sectionInfo[section].subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Live currency balance pill */}
            {(section === 'crops' || section === 'tools') && (
              <div className="glass rounded-xl px-2.5 py-1 flex items-center gap-1.5 border border-amber-500/20 bg-amber-500/10">
                <span className="text-xs">🪙</span>
                <span className="text-amber-300 font-black text-xs font-mono">
                  {Math.floor(profile?.goldBalance || 0).toLocaleString()}
                </span>
                <span className="text-amber-400/60 text-[10px] font-bold">GOLD</span>
              </div>
            )}
            <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Section selector */}
        <div className="flex-shrink-0 px-4 mb-2">
          <div className="glass rounded-2xl flex p-1 gap-1 overflow-x-auto no-scrollbar">
            {(['dex', 'nft', 'crops', 'tools', 'my-listings'] as Section[]).map(s => {
              const isActive = section === s;
              const isDex = s === 'dex';
              const isMy = s === 'my-listings';
              const myCount = activeListings.length;
              return (
                <button
                  key={s}
                  onClick={() => setSection(s)}
                  className={`flex-1 min-w-fit px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? isDex
                        ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/25 text-amber-300 border border-amber-500/30 shadow-sm'
                        : isMy
                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/30 shadow-sm'
                          : 'bg-white/15 text-white'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {s === 'dex'
                    ? '🥞 DEX'
                    : s === 'nft'
                      ? '🐕 NFT'
                      : s === 'crops'
                        ? '🌾 Crops'
                        : s === 'tools'
                          ? '🔧 Tools'
                          : `📋 My Listings${myCount > 0 ? ` (${myCount})` : ''}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab bar (only rendered when section has sub-tabs) */}
        {tabs.length > 0 && (
          <div className="flex-shrink-0 px-4 mb-3">
            <div className="flex gap-1">
              {tabs.map(({ id, label, icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === id ? 'bg-white/10 text-white' : 'text-white/35'
                  }`}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No wallet banner (NFT section only) */}
        {section === 'nft' && !profile?.walletAddress && nftTab !== 'sell' && (
          <div className="mx-4 mb-3 glass rounded-2xl p-3 flex items-center gap-2 border border-amber-500/20">
            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-xs">Link a BSC wallet in Settings to buy or sell NFTs.</p>
          </div>
        )}

        {/* NFT buy result banner */}
        {section === 'nft' && buyHook.step === 'success' && (
          <div className="mx-4 mb-3 glass rounded-xl px-3 py-2 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
            <span className="text-green-300 text-xs flex-1">Trade complete! NFT transferred.</span>
            {buyHook.txHash && <TxLink hash={buyHook.txHash} />}
          </div>
        )}
        {section === 'nft' && buyHook.error && (
          <div className="mx-4 mb-3 glass rounded-xl px-3 py-2 text-red-400 text-xs">
            ❌ {buyHook.error}
            <button onClick={buyHook.reset} className="ml-2 underline text-white/30">dismiss</button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 pb-6 flex flex-col gap-2.5">

          {/* ── NFT Section ── */}
          {section === 'nft' && nftTab === 'browse' && (
            <>
              {/* Need FARM shortcut banner */}
              <div
                onClick={() => setSection('dex')}
                className="glass rounded-2xl px-4 py-3 flex items-center justify-between cursor-pointer border border-amber-500/20 hover:border-amber-500/40 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-2">
                  <span>🥞</span>
                  <span className="text-xs text-white/80">Need <strong className="text-amber-400 font-bold">$FARM</strong> to buy Guard Dogs?</span>
                </div>
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  Swap DEX →
                </span>
              </div>

              {nftLoading && <div className="text-center py-10 text-white/40 text-sm">Loading…</div>}
              {!nftLoading && nftListings.length === 0 && (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                  <ShoppingBag size={36} className="text-white/20" />
                  <p className="text-white/30 text-sm">No active listings yet.</p>
                  <p className="text-white/20 text-xs">Be the first to list a Guard Dog!</p>
                </div>
              )}
              {!nftLoading && nftData && nftData.total > 0 && (
                <p className="text-white/25 text-[10px] text-right">
                  {nftListings.length}/{nftData.total} listings
                </p>
              )}
              {nftListings.map(l => {
                const isMine = myNftListings.some(m => m.id === l.id) ||
                  (!!profile?.id && l.sellerId === profile.id) ||
                  (!!profile?.username && l.seller === profile.username);
                return (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    isMine={isMine}
                    buyStep={buyHook.step}
                    canceling={cancelingNftId === l.id}
                    onCancel={() => cancelMut.mutate(l.id)}
                    onBuy={() => { buyHook.reset(); buyHook.buy(l.id, profile?.telegramId); }}
                  />
                );
              })}
            </>
          )}

          {section === 'nft' && nftTab === 'sell' && (
            <SellTab
              walletAddress={profile?.walletAddress}
              telegramId={profile?.telegramId}
              onGoToMyListings={() => setNftTab('my-listings')}
              onGoToBrowse={() => setNftTab('browse')}
            />
          )}

          {section === 'nft' && nftTab === 'my-listings' && (
            <>
              {myLoading && <div className="text-center py-10 text-white/40 text-sm">Loading…</div>}
              {!myLoading && myNftListings.length === 0 && (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                  <List size={36} className="text-white/20" />
                  <p className="text-white/30 text-sm">No listings yet.</p>
                </div>
              )}
              {myNftListings.map(l => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  isMine
                  canceling={cancelingNftId === l.id}
                  onCancel={() => cancelMut.mutate(l.id)}
                />
              ))}
            </>
          )}

          {/* ── Crops Section ── */}
          {section === 'crops' && cropsTab === 'browse' && (
            <BrowseItemsTab
              baseQueryKey="crop-market-listings"
              filterTypes={[
                ...CRATE_FILTER_TYPES.map(v => ({ value: v, label: itemLabel(v) })),
                ...SEED_FILTER_TYPES.map(v => ({ value: v, label: itemLabel(v) })),
              ]}
              clientFilter={l => {
                const it = l.itemType ?? '';
                return it.startsWith('crate_') || it.startsWith('seed_');
              }}
              emptyLabel="No crates or seeds listed yet"
              onSwitchToSell={() => setCropsTab('sell')}
            />
          )}

          {section === 'crops' && cropsTab === 'sell' && (
            <SellItemsTab
              category="crops"
              onGoToBrowse={() => setCropsTab('browse')}
              onGoToMyListings={() => setCropsTab('my-listings')}
            />
          )}

          {section === 'crops' && cropsTab === 'my-listings' && <MyItemListingsTab category="crops" />}

          {/* ── Tools Section ── */}
          {section === 'tools' && toolsTab === 'browse' && (
            <BrowseItemsTab
              baseQueryKey="tool-market-listings"
              filterTypes={[
                { value: 'magnifying_glass', label: 'Magnifying Glass' },
                { value: 'master_key',       label: 'Master Key' },
                { value: 'soul_shard',       label: 'Soul Shard 💎' },
              ]}
              clientFilter={l => TOOL_ITEM_TYPES.includes(l.itemType ?? '')}
              emptyLabel="No tools listed yet"
              onSwitchToSell={() => setToolsTab('sell')}
            />
          )}

          {section === 'tools' && toolsTab === 'sell' && (
            <SellItemsTab
              category="tools"
              onGoToBrowse={() => setToolsTab('browse')}
              onGoToMyListings={() => setToolsTab('my-listings')}
            />
          )}

          {section === 'tools' && toolsTab === 'my-listings' && <MyItemListingsTab category="tools" />}

          {/* ── My Listings Section ── */}
          {section === 'my-listings' && <AllMyListingsTab />}

          {/* ── DEX Swap Section ── */}
          {section === 'dex' && <DexSwapTab />}
        </div>
      </div>
    </div>
  );
}
