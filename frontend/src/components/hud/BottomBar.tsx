import { useState, useEffect, lazy, Suspense } from 'react';
import { SEED_EMOJI } from "@/constants/seeds";
import { MousePointer2, Shovel, Sprout, Droplets, Bug, Hand, Trophy, Gem, Flame, ShoppingBag, ClipboardList, Globe, Flower2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useGame } from '@/providers/GameProvider';
import { eventBus } from '@/game/EventBus';
import { api } from '@/api/client';
import { HarvestAllButton } from '@/components/hud/HarvestAllButton';
import { PlantAllButton } from '@/components/hud/PlantAllButton';

const ClaimModal      = lazy(() => import('@/components/modals/ClaimModal').then(m => ({ default: m.ClaimModal })));
const LeaderboardModal = lazy(() => import('@/components/modals/LeaderboardModal').then(m => ({ default: m.LeaderboardModal })));
const DailyRewardModal = lazy(() => import('@/components/modals/DailyRewardModal').then(m => ({ default: m.DailyRewardModal })));
const ShopModal        = lazy(() => import('@/components/modals/ShopModal').then(m => ({ default: m.ShopModal })));
const QuestModal       = lazy(() => import('@/components/modals/QuestModal').then(m => ({ default: m.QuestModal })));
const ExploreModal     = lazy(() => import('@/components/modals/ExploreModal').then(m => ({ default: m.ExploreModal })));

export type ToolId = 'cursor' | 'dig' | 'seed' | 'water' | 'spray' | 'weed-kill' | 'steal';

const TOOLS: { id: ToolId; icon: React.ReactNode; label: string; steal?: boolean }[] = [
  { id: 'cursor',    icon: <MousePointer2 size={20} />, label: 'Select' },
  { id: 'dig',       icon: <Shovel size={20} />,        label: 'Dig' },
  { id: 'seed',      icon: <Sprout size={20} />,        label: 'Plant' },
  { id: 'water',     icon: <Droplets size={20} />,      label: 'Water' },
  { id: 'spray',     icon: <Bug size={20} />,           label: 'Bug Spray' },
  { id: 'weed-kill', icon: <Flower2 size={20} />,       label: 'Weed Kill' },
  { id: 'steal',     icon: <Hand size={20} />,          label: 'Steal', steal: true },
];

export function BottomBar() {
  const [activeTool, setActiveTool] = useState<ToolId>('cursor');
  const [selectedSeed, setSelectedSeed] = useState<{ seedId: string; seedName: string } | null>(null);
  const [showClaim, setShowClaim] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showExplore, setShowExplore] = useState(false);
  const { profile, myFarm } = useGame();

  // Block Phaser input whenever any BottomBar modal is open
  useEffect(() => {
    const open = showClaim || showLeaderboard || showDaily || showShop || showQuests || showExplore;
    if (open) {
      eventBus.emit('ui-overlay', true);
      return;
    }
    const t = setTimeout(() => eventBus.emit('ui-overlay', false), 200);
    return () => clearTimeout(t);
  }, [showClaim, showLeaderboard, showDaily, showShop, showQuests, showExplore]);

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

  // Sync pre-selected seed from event bus + HUD Claim badge shortcut
  useEffect(() => {
    const unsubSeed  = eventBus.on('seed-preselected', (data) => setSelectedSeed(data));
    const unsubClaim = eventBus.on('show-claim', () => setShowClaim(true));
    return () => { unsubSeed(); unsubClaim(); };
  }, []);

  const handleTool = (id: ToolId) => {
    setActiveTool(id);
    eventBus.emit('tool-changed', id);
    // Switching away from seed tool clears the pre-selected seed
    if (id !== 'seed') setSelectedSeed(null);
  };

  const clearSeed = () => {
    setSelectedSeed(null);
    eventBus.emit('seed-cleared');
  };

  const claimReady  = !!profile && profile.goldBalance >= 100;
  const dryPlots    = myFarm?.plots.filter((p) => p.hasDrySoil).length ?? 0;
  const weedPlots   = myFarm?.plots.filter((p) => p.hasWeeds).length ?? 0;
  const bugPlots    = myFarm?.plots.filter((p) => p.hasBugs).length ?? 0;

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
        style={{ paddingBottom: 'max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)))' }}
      >
        {/* ── Batch action buttons ── */}
        <div className="flex justify-center gap-2 mb-2 px-4">
          <HarvestAllButton />
          {activeTool === 'seed' && selectedSeed && (
            <PlantAllButton seedId={selectedSeed.seedId} seedName={selectedSeed.seedName} />
          )}
        </div>

        {/* ── Active seed indicator ── */}
        {activeTool === 'seed' && selectedSeed && (
          <div className="flex justify-center mb-1 px-4">
            <div className="glass rounded-full px-3 py-1 flex items-center gap-2 pointer-events-auto">
              <span className="text-base leading-none">
                {SEED_EMOJI[selectedSeed.seedName] ?? '🌿'}
              </span>
              <span className="text-white/80 text-xs font-bold">{selectedSeed.seedName} selected</span>
              <button
                onClick={clearSeed}
                className="text-white/40 hover:text-white/80 active:scale-90 transition-all leading-none"
                title="Clear seed selection"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ── Tool context hint ── */}
        {activeTool === 'steal' && (
          <div className="flex justify-center mb-1 px-4 pointer-events-none">
            <div className="glass-red rounded-full px-3 py-1 flex items-center gap-2">
              <span className="text-red-300 text-[10px] font-bold">⚡ −10 energy per raid</span>
              <span className="w-px h-3 bg-red-400/30" />
              <span className="text-red-300/70 text-[10px]">max 5/day</span>
            </div>
          </div>
        )}
        {activeTool === 'spray' && (
          <div className="flex justify-center mb-1 px-4 pointer-events-none">
            <div className="glass rounded-full px-3 py-1 flex items-center gap-2">
              {(profile?.fertilizerCharges ?? 0) === 0 ? (
                <span className="text-white/40 text-[10px]">No fertilizer — buy from Shop</span>
              ) : (
                <>
                  {(profile?.normalFertCharges ?? 0) > 0 && (
                    <span className="text-green-300 text-[10px] font-bold">🌿×{profile!.normalFertCharges}</span>
                  )}
                  {(profile?.superFertCharges ?? 0) > 0 && (
                    <span className="text-blue-300 text-[10px] font-bold">🚀×{profile!.superFertCharges}</span>
                  )}
                  {(profile?.advancedFertCharges ?? 0) > 0 && (
                    <span className="text-purple-300 text-[10px] font-bold">💎×{profile!.advancedFertCharges}</span>
                  )}
                  <span className="text-white/40 text-[10px]">tap crop to fertilize</span>
                </>
              )}
            </div>
          </div>
        )}
        {activeTool === 'water' && (
          <div className="flex justify-center mb-1 px-4 pointer-events-none">
            <div className="glass rounded-full px-3 py-1">
              {dryPlots > 0
                ? <span className="text-blue-300 text-[10px] font-bold">💧 {dryPlots} plot{dryPlots > 1 ? 's' : ''} need water — −15% penalty if skipped!</span>
                : <span className="text-white/40 text-[10px]">Water crops to prevent −15% dry soil penalty</span>
              }
            </div>
          </div>
        )}
        {activeTool === 'weed-kill' && (
          <div className="flex justify-center mb-1 px-4 pointer-events-none">
            <div className="glass rounded-full px-3 py-1 flex items-center gap-2">
              {weedPlots > 0 ? (
                <span className="text-green-300 text-[10px] font-bold">🌿 {weedPlots} plot{weedPlots > 1 ? 's' : ''} infected — tap to remove weeds (−5 ⚡)</span>
              ) : (
                <span className="text-white/40 text-[10px]">No weeds — use on neighbor farms to sabotage their harvest</span>
              )}
            </div>
          </div>
        )}

        {/* ── Tool dock ── */}
        <div className="flex justify-center mb-2 px-4">
          <div className="glass rounded-full px-3 py-2 flex items-center gap-1 pointer-events-auto">
            {TOOLS.map((tool) => {
              const isActive    = activeTool === tool.id;
              const fertCharges = profile?.fertilizerCharges ?? 0;
              const isSpray     = tool.id === 'spray';
              const isWater     = tool.id === 'water';
              const isWeedKill  = tool.id === 'weed-kill';
              return (
                <button
                  key={tool.id}
                  onClick={() => handleTool(tool.id)}
                  title={tool.label}
                  className={[
                    'relative flex flex-col items-center justify-center w-11 h-11 rounded-full transition-all active:scale-90',
                    tool.steal
                      ? isActive
                        ? 'bg-red-500 text-white tool-steal-glow scale-110'
                        : 'text-red-400 hover:bg-red-500/20'
                      : isActive
                        ? 'bg-white/20 text-white scale-110'
                        : 'text-white/60 hover:text-white hover:bg-white/10',
                  ].join(' ')}
                >
                  {tool.icon}
                  {tool.steal && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                  {isSpray && fertCharges > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-green-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                      {fertCharges}
                    </span>
                  )}
                  {isWeedKill && (weedPlots > 0 || bugPlots > 0) && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-lime-500 text-black text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none animate-pulse">
                      {weedPlots + bugPlots}
                    </span>
                  )}
                  {isWater && dryPlots > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-blue-400 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none animate-pulse">
                      {dryPlots}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Nav bar ── */}
        <div className="flex items-center gap-2 px-3 pointer-events-auto">
          {/* Daily reward */}
          <NavBtn
            icon={
              <div className="relative">
                <Flame size={18} className={profile?.canClaimDaily ? 'text-orange-400' : undefined} />
                {profile?.canClaimDaily && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                )}
              </div>
            }
            label="Daily"
            onClick={() => setShowDaily(true)}
          />

          {/* Shop */}
          <NavBtn
            icon={<ShoppingBag size={18} />}
            label="Shop"
            onClick={() => setShowShop(true)}
          />

          {/* Leaderboard */}
          <NavBtn
            icon={<Trophy size={18} />}
            label="Ranks"
            onClick={() => setShowLeaderboard(true)}
          />

          {/* Claim $FARM — centre, bigger */}
          <button
            onClick={() => setShowClaim(true)}
            className={[
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95',
              claimReady
                ? 'glass-purple text-violet-200 pulse-gold'
                : 'glass text-white/50',
            ].join(' ')}
          >
            <Gem size={16} />
            <span>Claim $FARM</span>
            {claimReady && (
              <span className="bg-violet-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {profile!.goldBalance.toFixed(0)}G
              </span>
            )}
          </button>

          {/* Quests */}
          <NavBtn
            icon={
              <div className="relative">
                <ClipboardList size={18} />
                {claimableQuests > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full text-[9px] font-black text-black flex items-center justify-center">
                    {claimableQuests}
                  </span>
                )}
              </div>
            }
            label="Quests"
            onClick={() => setShowQuests(true)}
          />

          {/* Explore / Raid Map */}
          <NavBtn
            icon={
              <div className="relative">
                <Globe size={18} className={stealableCount > 0 ? 'text-red-400' : undefined} />
                {stealableCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center animate-pulse">
                    {stealableCount > 9 ? '9+' : stealableCount}
                  </span>
                )}
              </div>
            }
            label="Explore"
            onClick={() => setShowExplore(true)}
          />
        </div>
      </div>

      <Suspense fallback={null}>
        {showClaim && (
          <ErrorBoundary>
            <ClaimModal onClose={() => setShowClaim(false)} />
          </ErrorBoundary>
        )}

        {showLeaderboard && (
          <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
        )}

        {showDaily && (
          <DailyRewardModal
            currentStreak={profile?.dailyStreak ?? 0}
            canClaim={profile?.canClaimDaily ?? true}
            nextClaimAt={profile?.nextClaimAt ?? null}
            onClose={() => setShowDaily(false)}
          />
        )}

        {showShop && <ShopModal onClose={() => setShowShop(false)} />}
        {showQuests && <QuestModal onClose={() => setShowQuests(false)} />}
        {showExplore && <ExploreModal onClose={() => setShowExplore(false)} />}
      </Suspense>
    </>
  );
}

function NavBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass flex flex-col items-center justify-center gap-0.5 w-12 py-2.5 rounded-2xl text-white/70 hover:text-white active:scale-95 transition-all pointer-events-auto"
    >
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}
