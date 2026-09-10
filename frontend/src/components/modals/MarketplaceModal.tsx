import { useState } from 'react';
import { X, ShoppingBag, Tag, Clock, CheckCircle2, Loader2, AlertTriangle, List } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useGame } from '@/providers/GameProvider';
import type { MarketplaceListing } from '@/types/game.types';

interface Props { onClose: () => void }

type Tab = 'browse' | 'my-listings';

const DOG_NAMES: Record<number, string> = {
  1: 'Chihuahua 🐶',
  2: 'Corgi 🐕',
  3: 'Husky 🐺',
  4: 'Rottweiler 🦮',
  5: 'Doberman 🐩',
  6: 'Pitbull 💪',
};
const DOG_DEFENSE: Record<number, number> = { 1: 10, 2: 20, 3: 35, 4: 50, 5: 65, 6: 80 };

function timeUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

function ListingCard({
  listing,
  onBuy,
  onCancel,
  isMine,
  busy,
}: {
  listing: MarketplaceListing;
  onBuy?: () => void;
  onCancel?: () => void;
  isMine: boolean;
  busy: boolean;
}) {
  const dogName = DOG_NAMES[listing.tokenId] ?? `Dog #${listing.tokenId}`;
  const defense = DOG_DEFENSE[listing.tokenId] ?? 0;
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl flex-shrink-0">
        🐕
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm leading-tight">{dogName}</p>
        <p className="text-white/40 text-[10px]">-{defense}% steal chance • {timeUntil(listing.deadline)}</p>
        <p className="text-amber-300 font-black text-sm mt-0.5">{listing.priceFarm.toFixed(0)} $FARM</p>
      </div>
      <div className="flex-shrink-0">
        {isMine ? (
          <button
            disabled={busy}
            onClick={onCancel}
            className="glass text-red-400/70 text-xs px-3 py-1.5 rounded-xl active:scale-95 transition-all disabled:opacity-40"
          >
            Cancel
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={onBuy}
            className="text-xs px-3 py-1.5 rounded-xl font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1"
            style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff' }}
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : null}
            Buy
          </button>
        )}
      </div>
    </div>
  );
}

export function MarketplaceModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('browse');
  const [result, setResult] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { profile } = useGame();

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['marketplace-listings'],
    queryFn: () => api.getMarketplaceListings(),
    staleTime: 30_000,
    enabled: tab === 'browse',
  });

  const { data: myListings = [], isLoading: myLoading } = useQuery({
    queryKey: ['my-marketplace-listings'],
    queryFn: api.getMyMarketplaceListings,
    staleTime: 30_000,
    enabled: tab === 'my-listings',
  });

  const buyMutation = useMutation({
    mutationFn: (id: string) => api.buyMarketplaceListing(id),
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelMarketplaceListing(id),
    onSuccess: () => {
      setResult('✅ Listing cancelled');
      queryClient.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const busy = buyMutation.isPending || cancelMutation.isPending;

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
            <ShoppingBag size={18} className="text-amber-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">NFT Market</h2>
              <p className="text-white/40 text-xs">Buy & sell Guard Dog NFTs</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Tab */}
        <div className="flex-shrink-0 px-5 mb-3">
          <div className="glass rounded-2xl flex p-1 gap-1">
            {(['browse', 'my-listings'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  tab === t ? 'bg-white/15 text-white' : 'text-white/40'
                }`}
              >
                {t === 'browse' ? <><Tag size={11} /> Browse</> : <><List size={11} /> My Listings</>}
              </button>
            ))}
          </div>
        </div>

        {result && (
          <div className="mx-5 mb-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/70">
            {result}
          </div>
        )}

        {/* No wallet warning */}
        {!profile?.walletAddress && (
          <div className="mx-5 mb-3 glass rounded-2xl p-3 flex items-center gap-2 border border-amber-500/20">
            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-xs">Link a BSC wallet in Settings to buy or sell NFTs.</p>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 pb-8 flex flex-col gap-2.5">
          {tab === 'browse' && (
            <>
              {isLoading && <div className="text-center py-10 text-white/40 text-sm">Loading…</div>}
              {!isLoading && listings.length === 0 && (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                  <ShoppingBag size={36} className="text-white/20" />
                  <p className="text-white/30 text-sm">No active listings yet.</p>
                  <p className="text-white/20 text-xs">Be the first to list a Guard Dog!</p>
                </div>
              )}
              {listings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  isMine={false}
                  busy={busy}
                  onBuy={() => { setResult(null); buyMutation.mutate(l.id); }}
                />
              ))}
            </>
          )}

          {tab === 'my-listings' && (
            <>
              {myLoading && <div className="text-center py-10 text-white/40 text-sm">Loading…</div>}
              {!myLoading && myListings.length === 0 && (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                  <List size={36} className="text-white/20" />
                  <p className="text-white/30 text-sm">No listings yet.</p>
                </div>
              )}
              {myListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l as MarketplaceListing}
                  isMine
                  busy={busy}
                  onCancel={() => { setResult(null); cancelMutation.mutate(l.id); }}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
