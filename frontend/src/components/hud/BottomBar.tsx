import { useState, useEffect, lazy, Suspense } from 'react';
import { SEED_EMOJI } from "@/constants/seeds";
import {
  MousePointer2, Shovel, Sprout, Droplets, Bug, Hand, Trophy, Gem, Flame,
  Store, Scale, ClipboardList, Globe, Scissors, Shield, Gift, Warehouse,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useGame } from '@/providers/GameProvider';
import { eventBus } from '@/game/EventBus';
import { api } from '@/api/client';
import { soundManager } from '@/sounds/SoundManager';
import { HarvestAllButton } from '@/components/hud/HarvestAllButton';
import { PlantAllButton } from '@/components/hud/PlantAllButton';

import { lazyWithRetry } from '@/utils/lazyWithRetry';

const ClaimModal       = lazyWithRetry(() => import('@/components/modals/ClaimModal').then(m => ({ default: m.ClaimModal })));
const LeaderboardModal = lazyWithRetry(() => import('@/components/modals/LeaderboardModal').then(m => ({ default: m.LeaderboardModal })));
const DailyRewardModal = lazyWithRetry(() => import('@/components/modals/DailyRewardModal').then(m => ({ default: m.DailyRewardModal })));
const ShopModal        = lazyWithRetry(() => import('@/components/modals/ShopModal').then(m => ({ default: m.ShopModal })));
const QuestModal       = lazyWithRetry(() => import('@/components/modals/QuestModal').then(m => ({ default: m.QuestModal })));
const ExploreModal     = lazyWithRetry(() => import('@/components/modals/ExploreModal').then(m => ({ default: m.ExploreModal })));
const MarketplaceModal = lazyWithRetry(() => import('@/components/modals/MarketplaceModal').then(m => ({ default: m.MarketplaceModal })));
const GuildModal       = lazyWithRetry(() => import('@/components/modals/GuildModal').then(m => ({ default: m.GuildModal })));
const GachaModal       = lazyWithRetry(() => import('@/components/modals/GachaModal').then(m => ({ default: m.GachaModal })));
const StorageModal     = lazyWithRetry(() => import('@/components/modals/StorageModal').then(m => ({ default: m.StorageModal })));

export type ToolId = 'cursor' | 'dig' | 'seed' | 'water' | 'spray' | 'weed-kill' | 'steal';

const TOOLS: { id: ToolId; icon: React.ReactNode; label: string; steal?: boolean }[] = [
  { id: 'cursor',    icon: <MousePointer2 size={20} />, label: 'Select' },
  { id: 'dig',       icon: <Shovel size={20} />,        label: 'Dig' },
  { id: 'seed',      icon: <Sprout size={20} />,        label: 'Plant' },
  { id: 'water',     icon: <Droplets size={20} />,      label: 'Water' },
  { id: 'spray',     icon: <Bug size={20} />,           label: 'Bug Spray' },
  { id: 'weed-kill', icon: <Scissors size={20} />,      label: 'Weed Kill' },
  { id: 'steal',     icon: <Hand size={20} />,          label: 'Steal', steal: true },
];

export function BottomBar() {
  const [activeTool, setActiveTool]       = useState<ToolId>('cursor');
  const [selectedSeed, setSelectedSeed]   = useState<{ seedId: string; seedName: string } | null>(null);
  const [showClaim, setShowClaim]         = useState(false);
  const [claimInitialTab, setClaimInitialTab] = useState<'convert' | 'dex' | 'deposit_tx' | 'treasury'>('convert');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showDaily, setShowDaily]         = useState(false);
  const [showShop, setShowShop]           = useState(false);
  const [shopInitialTab, setShopInitialTab] = useState<'seeds' | 'energy' | 'defense' | 'boost' | 'upgrades'>('seeds');
  const [showQuests, setShowQuests]       = useState(false);
  const [showExplore, setShowExplore]     = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showGuild, setShowGuild]         = useState(false);
  const [showGacha, setShowGacha]         = useState(false);
  const [showStorage, setShowStorage]     = useState(false);
  const [isVisiting, setIsVisiting]       = useState(false);
  const { profile, myFarm } = useGame();

  useEffect(() => {
    const open = showClaim || showLeaderboard || showDaily || showShop || showQuests || showExplore || showMarketplace || showGuild || showGacha || showStorage;
    eventBus.setOverlay('BottomBar', open);
  }, [showClaim, showLeaderboard, showDaily, showShop, showQuests, showExplore, showMarketplace, showGuild, showGacha, showStorage]);

  // Auto-open Daily Reward on initial session launch if reward is ready to claim
  useEffect(() => {
    if (profile?.canClaimDaily) {
      const prompted = sessionStorage.getItem('bb_daily_prompted');
      if (!prompted) {
        sessionStorage.setItem('bb_daily_prompted', '1');
        setShowDaily(true);
      }
    }
  }, [profile?.canClaimDaily]);

  const { data: quests = [] } = useQuery({
    queryKey: ['dailyQuests'],
    queryFn: api.getDailyQuests,
    staleTime: 60_000,
    refetchInterval: 2 * 60 * 1000,
  });
  const claimableQuests = quests.filter((q) => q.completed && !q.claimed).length;

  const { data: exploreFarms = [] } = useQuery({
    queryKey: ['exploreFarms'],
    queryFn: api.getExploreFarms,
    staleTime: 60_000,
    refetchInterval: 3 * 60 * 1000,
  });
  const stealableCount = exploreFarms.length;

  const { data: barnData } = useQuery({
    queryKey: ['barnData'],
    queryFn: api.getBarnInventory,
    staleTime: 15_000,
  });
  const totalRawCrops = barnData?.crops?.reduce((acc, item) => acc + (item.quantity - item.lockedQuantity), 0) ?? 0;

  useEffect(() => {
    const unsubSeed    = eventBus.on('seed-preselected', (data) => setSelectedSeed(data));
    const unsubClaim   = eventBus.on('show-claim', (data) => {
      if (data && typeof data === 'object' && data.tab) {
        setClaimInitialTab(data.tab);
      } else {
        setClaimInitialTab('convert');
      }
      setShowClaim(true);
    });
    const unsubStorage = eventBus.on('show-storage', () => setShowStorage(true));
    const unsubShop    = eventBus.on('show-shop', (data) => {
      if (data && typeof data === 'object' && data.tab) {
        setShopInitialTab(data.tab);
      } else {
        setShopInitialTab('seeds');
      }
      setShowShop(true);
    });
    const unsubToolChange = eventBus.on('tool-changed', (tool) => {
      setActiveTool(tool as ToolId);
    });
    const unsubVisitFarm = eventBus.on('visit-farm', () => {
      setIsVisiting(true);
      setActiveTool('steal');
      eventBus.emit('tool-changed', 'steal');
    });
    const unsubReturnFarm = eventBus.on('return-to-own-farm', () => {
      setIsVisiting(false);
      setActiveTool('cursor');
      eventBus.emit('tool-changed', 'cursor');
    });
    return () => { unsubSeed(); unsubClaim(); unsubStorage(); unsubShop(); unsubToolChange(); unsubVisitFarm(); unsubReturnFarm(); };
  }, []);

  const handleTool = (id: ToolId) => {
    setActiveTool(id);
    eventBus.emit('tool-changed', id);
    if (id !== 'seed') setSelectedSeed(null);
    try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
  };

  const clearSeed = () => {
    setSelectedSeed(null);
    eventBus.emit('seed-cleared');
  };

  const claimReady = !!profile && profile.goldBalance >= 100;
  const dryPlots   = myFarm?.plots.filter((p) => p.hasDrySoil).length ?? 0;
  const weedPlots  = myFarm?.plots.filter((p) => p.hasWeeds).length ?? 0;
  const bugPlots   = myFarm?.plots.filter((p) => p.hasBugs).length ?? 0;

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
        style={{ paddingBottom: 'max(12px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 12px)))' }}
      >
        {/* ── Batch action buttons ── */}
        <div className="flex justify-center gap-2 mb-1.5 px-4">
          <HarvestAllButton />
          {activeTool === 'seed' && selectedSeed && (
            <PlantAllButton seedId={selectedSeed.seedId} seedName={selectedSeed.seedName} />
          )}
        </div>

        {/* ── Active seed indicator ── */}
        {activeTool === 'seed' && selectedSeed && (
          <div className="flex justify-center mb-1 px-4">
            <div className="glass rounded-full px-3 py-1 flex items-center gap-2 pointer-events-auto">
              <span className="text-base leading-none">{SEED_EMOJI[selectedSeed.seedName] ?? '🌿'}</span>
              <span className="text-white/80 text-xs font-bold">{selectedSeed.seedName} selected</span>
              <button onClick={clearSeed} className="text-white/40 hover:text-white/80 active:scale-90 transition-all leading-none">✕</button>
            </div>
          </div>
        )}

        {/* ── Context hints ── */}
        {isVisiting ? (
          <div className="flex justify-center mb-1 px-4 pointer-events-none">
            {activeTool === 'cursor' && (
              <div className="glass rounded-full px-3 py-1 flex items-center gap-2">
                <span className="text-white/80 text-[10px]">Tap any crop to Steal, Sabotage, or Help neighbor</span>
              </div>
            )}
            {activeTool === 'steal' && (
              <div className="glass-red rounded-full px-3 py-1 flex items-center gap-2">
                <span className="text-red-300 text-[10px] font-bold">⚡ −10 energy per raid</span>
                <span className="w-px h-3 bg-red-400/30" />
                <span className="text-red-300/70 text-[10px]">max 5/day</span>
              </div>
            )}
            {activeTool === 'spray' && (
              <div className="glass rounded-full px-3 py-1 flex items-center gap-2 border border-emerald-400/30 bg-emerald-500/10">
                <span className="text-emerald-300 text-[10px] font-bold">🤝 Help Spray Bugs</span>
                <span className="w-px h-3 bg-white/20" />
                <span className="text-white/70 text-[10px]">−5⚡ · Earn +15G & +1 Trust!</span>
              </div>
            )}
            {activeTool === 'weed-kill' && (
              <div className="glass rounded-full px-3 py-1 flex items-center gap-2 border border-emerald-400/30 bg-emerald-500/10">
                <span className="text-emerald-300 text-[10px] font-bold">🤝 Help Pull Weeds</span>
                <span className="w-px h-3 bg-white/20" />
                <span className="text-white/70 text-[10px]">−5⚡ · Earn +15G & +1 Trust!</span>
              </div>
            )}
            {activeTool === 'water' && (
              <div className="glass rounded-full px-3 py-1 flex items-center gap-2 border border-blue-400/30 bg-blue-500/10">
                <span className="text-blue-300 text-[10px] font-bold">🤝 Help Water Soil</span>
                <span className="w-px h-3 bg-white/20" />
                <span className="text-white/70 text-[10px]">−5⚡ · Earn +10G & +1 Trust!</span>
              </div>
            )}
          </div>
        ) : (
          <>
            {activeTool === 'dig' && (
              <div className="flex justify-center mb-1 px-4 pointer-events-none">
                <div className="glass-red rounded-full px-3 py-1 flex items-center gap-2 border border-red-500/30 bg-red-500/10">
                  <span className="text-amber-300 text-[10px] font-bold">⛏️ Dig Mode: Tap any crop to clear it (with confirmation)</span>
                </div>
              </div>
            )}
            {activeTool === 'seed' && !selectedSeed && (
              <div className="flex justify-center mb-1 px-4">
                <div className="glass rounded-full px-3 py-1 flex items-center gap-2 pointer-events-auto">
                  <span className="text-green-300 text-[10px] font-bold">🌱 Tap an empty plot to plant</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShopInitialTab('seeds');
                      setShowShop(true);
                      try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
                    }}
                    className="ml-1 px-2 py-0.5 bg-green-500 hover:bg-green-400 text-black text-[10px] font-black rounded-full transition-all active:scale-95"
                  >
                    Buy Seeds 🌾
                  </button>
                </div>
              </div>
            )}
            {activeTool === 'steal' && (
              <div className="flex justify-center mb-1 px-4">
                <div className="glass-red rounded-full px-3 py-1 flex items-center gap-2 pointer-events-auto">
                  <span className="text-red-300 text-[10px] font-bold">⚡ −10 energy per raid</span>
                  <span className="w-px h-3 bg-red-400/30" />
                  <span className="text-red-300/70 text-[10px]">max 5/day</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExplore(true);
                      try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
                    }}
                    className="ml-1 px-2 py-0.5 bg-red-500 hover:bg-red-400 text-white text-[10px] font-black rounded-full transition-all active:scale-95"
                  >
                    Explore Farms 🌐
                  </button>
                </div>
              </div>
            )}
            {activeTool === 'spray' && (
              <div className="flex justify-center mb-1 px-4 pointer-events-none">
                <div className="glass rounded-full px-3 py-1 flex items-center gap-2">
                  {bugPlots > 0 ? (
                    <span className="text-red-300 text-[10px] font-bold animate-pulse">
                      🐛 {bugPlots} plot{bugPlots > 1 ? 's' : ''} have bugs — tap to spray (−5⚡)
                    </span>
                  ) : (profile?.fertilizerCharges ?? 0) === 0 ? (
                    <span className="text-white/50 text-[10px]">No bugs · Buy fertilizer from Shop to boost crops</span>
                  ) : (
                    <>
                      {(profile?.normalFertCharges ?? 0) > 0 && <span className="text-green-300 text-[10px] font-bold">🌿×{profile!.normalFertCharges}</span>}
                      {(profile?.superFertCharges  ?? 0) > 0 && <span className="text-blue-300 text-[10px] font-bold">🚀×{profile!.superFertCharges}</span>}
                      {(profile?.advancedFertCharges ?? 0) > 0 && <span className="text-purple-300 text-[10px] font-bold">💎×{profile!.advancedFertCharges}</span>}
                      <span className="text-white/60 text-[10px]">tap crop to fertilize</span>
                    </>
                  )}
                </div>
              </div>
            )}
            {activeTool === 'weed-kill' && (
              <div className="flex justify-center mb-1 px-4 pointer-events-none">
                <div className="glass rounded-full px-3 py-1 flex items-center gap-2">
                  {weedPlots > 0 ? (
                    <span className="text-lime-300 text-[10px] font-bold animate-pulse">
                      ✂️ {weedPlots} plot{weedPlots > 1 ? 's' : ''} have weeds — tap to remove (−5⚡)
                    </span>
                  ) : (
                    <span className="text-white/50 text-[10px]">
                      No weeds · Visit neighbors to help pull weeds (+15G & +1 Trust)
                    </span>
                  )}
                </div>
              </div>
            )}
            {activeTool === 'water' && (
              <div className="flex justify-center mb-1 px-4 pointer-events-none">
                <div className="glass rounded-full px-3 py-1">
                  {dryPlots > 0
                    ? <span className="text-blue-300 text-[10px] font-bold animate-pulse">💧 {dryPlots} plot{dryPlots > 1 ? 's' : ''} need water — −15% penalty if skipped!</span>
                    : <span className="text-white/50 text-[10px]">💧 Water dry crops to speed up growth & prevent dry penalty</span>
                  }
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Feature nav (Unified Sleek 10-Button Console) ── */}
        <div className="px-3 mb-1.5 pointer-events-auto">
          <div className="w-full max-w-[420px] mx-auto rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            <div className="grid grid-cols-5 gap-0.5">
              {/* Row 1: Daily, Shop, Market, Guild, Gacha */}
              <NavBtn
                icon={<Flame size={16} />}
                label="Daily"
                accent="text-amber-400"
                badge={profile?.canClaimDaily ? (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-pulse" />
                ) : undefined}
                onClick={() => setShowDaily(true)}
              />
              <NavBtn
                icon={<Store size={16} />}
                label="Shop"
                accent="text-emerald-400"
                onClick={() => setShowShop(true)}
              />
              <NavBtn
                icon={<Scale size={16} />}
                label="Market"
                accent="text-cyan-400"
                onClick={() => setShowMarketplace(true)}
              />
              <NavBtn
                icon={<Shield size={16} />}
                label="Guild"
                accent="text-indigo-400"
                onClick={() => setShowGuild(true)}
              />
              <NavBtn
                icon={<Gift size={16} />}
                label="Gacha"
                accent="text-pink-400"
                onClick={() => setShowGacha(true)}
              />

              {/* Row 2: Quests, Explore, Ranks, Storage, $FARM */}
              <NavBtn
                icon={<ClipboardList size={16} />}
                label="Quests"
                accent="text-lime-400"
                badge={claimableQuests > 0 ? (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full text-[8px] font-black text-black flex items-center justify-center shadow-sm">
                    {claimableQuests}
                  </span>
                ) : undefined}
                onClick={() => setShowQuests(true)}
              />
              <NavBtn
                icon={<Globe size={16} />}
                label="Explore"
                accent="text-sky-400"
                badge={stealableCount > 0 ? (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-gradient-to-r from-red-500 to-rose-600 rounded-full text-[8px] font-black text-white flex items-center justify-center shadow-sm animate-pulse">
                    {stealableCount > 9 ? '9+' : stealableCount}
                  </span>
                ) : undefined}
                onClick={() => setShowExplore(true)}
              />
              <NavBtn
                icon={<Trophy size={16} />}
                label="Ranks"
                accent="text-yellow-400"
                onClick={() => setShowLeaderboard(true)}
              />
              <NavBtn
                icon={<Warehouse size={16} />}
                label="Storage"
                accent="text-amber-300"
                badge={totalRawCrops > 0 ? (
                  <span className="absolute -top-1 -right-2 bg-amber-500 text-black text-[8px] font-black rounded-full px-1 h-3 flex items-center justify-center shadow-sm animate-pulse">
                    {totalRawCrops > 999 ? `${(totalRawCrops / 1000).toFixed(1)}k` : totalRawCrops}
                  </span>
                ) : undefined}
                onClick={() => setShowStorage(true)}
              />
              <NavBtn
                icon={<Gem size={16} className={claimReady ? 'animate-pulse' : undefined} />}
                label="$FARM"
                accent={claimReady ? 'text-violet-300 drop-shadow-[0_0_8px_rgba(167,139,250,0.8)]' : 'text-violet-400'}
                isSpecial={true}
                badge={claimReady ? (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-violet-400 rounded-full shadow-[0_0_6px_rgba(167,139,250,0.9)] animate-pulse" />
                ) : undefined}
                onClick={() => setShowClaim(true)}
              />
            </div>
          </div>
        </div>

        {/* ── Tool strip ── */}
        <div className="flex justify-center px-4">
          <div className="glass rounded-full px-2.5 py-1.5 flex items-center gap-0.5 pointer-events-auto">
            {(isVisiting ? TOOLS.filter((t) => t.id !== 'dig' && t.id !== 'seed') : TOOLS).map((tool) => {
              const isActive    = activeTool === tool.id;
              const fertCharges = profile?.fertilizerCharges ?? 0;
              const title       = isVisiting
                ? tool.id === 'cursor'
                  ? 'Inspect / Sabotage / Help'
                  : tool.id === 'spray'
                  ? 'Help Spray Bugs (+15G)'
                  : tool.id === 'weed-kill'
                  ? 'Help Pull Weeds (+15G)'
                  : tool.id === 'water'
                  ? 'Help Water (+10G)'
                  : tool.label
                : tool.label;
              return (
                <button
                  key={tool.id}
                  onClick={() => handleTool(tool.id)}
                  title={title}
                  className={[
                    'relative flex flex-col items-center justify-center w-10 h-10 rounded-full transition-all active:scale-90',
                    tool.steal
                      ? isActive ? 'bg-red-500 text-white tool-steal-glow scale-110' : 'text-red-400 hover:bg-red-500/20'
                      : isActive ? 'bg-white/20 text-white scale-110' : 'text-white/60 hover:text-white hover:bg-white/10',
                  ].join(' ')}
                >
                  {tool.icon}
                  {tool.steal && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                  {tool.id === 'spray' && (
                    bugPlots > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none animate-pulse">
                        {bugPlots}
                      </span>
                    ) : fertCharges > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-emerald-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                        {fertCharges}
                      </span>
                    ) : null
                  )}
                  {tool.id === 'weed-kill' && weedPlots > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-lime-500 text-black text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none animate-pulse">
                      {weedPlots}
                    </span>
                  )}
                  {tool.id === 'water' && dryPlots > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-blue-400 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none animate-pulse">
                      {dryPlots}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <Suspense fallback={null}>
        {showClaim && (
          <ErrorBoundary onReset={() => setShowClaim(false)}>
            <ClaimModal onClose={() => setShowClaim(false)} initialTab={claimInitialTab} />
          </ErrorBoundary>
        )}
        {showLeaderboard && (
          <ErrorBoundary onReset={() => setShowLeaderboard(false)}>
            <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
          </ErrorBoundary>
        )}
        {showDaily && (
          <ErrorBoundary onReset={() => setShowDaily(false)}>
            <DailyRewardModal
              currentStreak={profile?.dailyStreak ?? 0}
              canClaim={profile?.canClaimDaily ?? true}
              nextClaimAt={profile?.nextClaimAt ?? null}
              currentEnergy={profile?.energy ?? 100}
              maxEnergy={profile?.maxEnergy ?? 100}
              onClose={() => setShowDaily(false)}
            />
          </ErrorBoundary>
        )}
        {showShop && (
          <ErrorBoundary onReset={() => setShowShop(false)}>
            <ShopModal initialTab={shopInitialTab} onClose={() => setShowShop(false)} />
          </ErrorBoundary>
        )}
        {showQuests && (
          <ErrorBoundary onReset={() => setShowQuests(false)}>
            <QuestModal onClose={() => setShowQuests(false)} />
          </ErrorBoundary>
        )}
        {showExplore && (
          <ErrorBoundary onReset={() => setShowExplore(false)}>
            <ExploreModal onClose={() => setShowExplore(false)} />
          </ErrorBoundary>
        )}
        {showMarketplace && (
          <ErrorBoundary onReset={() => setShowMarketplace(false)}>
            <MarketplaceModal onClose={() => setShowMarketplace(false)} />
          </ErrorBoundary>
        )}
        {showGuild && (
          <ErrorBoundary onReset={() => setShowGuild(false)}>
            <GuildModal onClose={() => setShowGuild(false)} />
          </ErrorBoundary>
        )}
        {showGacha && (
          <ErrorBoundary onReset={() => setShowGacha(false)}>
            <GachaModal onClose={() => setShowGacha(false)} />
          </ErrorBoundary>
        )}
        {showStorage && (
          <ErrorBoundary onReset={() => setShowStorage(false)}>
            <StorageModal onClose={() => setShowStorage(false)} />
          </ErrorBoundary>
        )}
      </Suspense>
    </>
  );
}

interface NavBtnProps {
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  accent?: string;
  isSpecial?: boolean;
  onClick: () => void;
}

function NavBtn({ icon, label, badge, accent, isSpecial, onClick }: NavBtnProps) {
  const handleClick = () => {
    try {
      (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    } catch {}
    soundManager.play('click');
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        'relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all duration-150 active:scale-90 select-none group',
        isSpecial
          ? 'bg-gradient-to-b from-violet-500/20 to-purple-700/20 border border-violet-400/40 text-violet-200 shadow-[0_0_12px_rgba(167,139,250,0.25)] hover:border-violet-300'
          : 'hover:bg-white/10 text-white/75 hover:text-white',
      ].join(' ')}
    >
      <div className={`relative flex items-center justify-center transition-transform group-hover:scale-110 ${accent ?? ''}`}>
        {icon}
        {badge}
      </div>
      <span className="text-[9px] font-bold tracking-tight leading-tight mt-0.5 opacity-90 group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}
