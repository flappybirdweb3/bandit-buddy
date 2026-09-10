import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
const GameCanvas = lazy(() => import('@/game/GameCanvas').then(m => ({ default: m.GameCanvas })));
import { eventBus } from '@/game/EventBus';
import { HUD } from '@/components/hud/HUD';
import { BottomBar } from '@/components/hud/BottomBar';
import { FriendsBar } from '@/components/hud/FriendsBar';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { NotInTelegramScreen } from '@/components/NotInTelegramScreen';
import { TutorialOverlay, TUTORIAL_KEY } from '@/components/TutorialOverlay';
import { SkeletonHUD } from '@/components/SkeletonHUD';
import { SoundSystem } from '@/components/SoundSystem';
import { ToastContainer } from '@/components/Toast';
import { useGame } from '@/providers/GameProvider';
import { useAutoWallet } from '@/hooks/useAutoWallet';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useOfflineDetection } from '@/hooks/useOfflineDetection';
import { api } from '@/api/client';
import WebApp from '@twa-dev/sdk';
import { ArrowLeft } from 'lucide-react';
import { soundManager } from '@/sounds/SoundManager';
import type { PlotClickEvent, FarmData } from '@/types/game.types';

const SeedSelectModal  = lazy(() => import('@/components/modals/SeedSelectModal').then(m => ({ default: m.SeedSelectModal })));
const HarvestModal     = lazy(() => import('@/components/modals/HarvestModal').then(m => ({ default: m.HarvestModal })));
const StealModal       = lazy(() => import('@/components/modals/StealModal').then(m => ({ default: m.StealModal })));
const AttackModal      = lazy(() => import('@/components/modals/AttackModal').then(m => ({ default: m.AttackModal })));
const FriendsModal     = lazy(() => import('@/components/modals/FriendsModal').then(m => ({ default: m.FriendsModal })));
const BuyPlotModal     = lazy(() => import('@/components/modals/BuyPlotModal').then(m => ({ default: m.BuyPlotModal })));
const PlotUpgradeModal = lazy(() => import('@/components/modals/PlotUpgradeModal').then(m => ({ default: m.PlotUpgradeModal })));
const WalletSetupModal = lazy(() => import('@/components/modals/WalletSetupModal').then(m => ({ default: m.WalletSetupModal })));
const FertilizerModal  = lazy(() => import('@/components/modals/FertilizerModal').then(m => ({ default: m.FertilizerModal })));
const SettingsModal    = lazy(() => import('@/components/modals/SettingsModal').then(m => ({ default: m.SettingsModal })));

type ActiveModal =
  | { type: 'seed'; plotId: string; preSelectedSeedId?: string }
  | { type: 'harvest'; plotIndex: number }
  | { type: 'steal'; plotId: string; plotIndex: number; targetUserId: string; targetUsername: string }
  | { type: 'attack'; plotId: string; plotIndex: number; targetUserId: string; targetUsername: string }
  | { type: 'friends' }
  | { type: 'buy-plot'; cost: number }
  | { type: 'upgrade-plot'; plotId: string; plotIndex: number }
  | { type: 'fertilizer'; plotId: string; plotIndex: number }
  | null;


export function App() {
  const [started, setStarted] = useState(() => localStorage.getItem('bb_entered') === '1');
  const [showTutorial, setShowTutorial] = useState(false);
  const [modal, setModal] = useState<ActiveModal>(null);
  const [visitState, setVisitState] = useState<{ userId: string; username: string } | null>(null);
  const [preSelectedSeed, setPreSelectedSeed] = useState<{ seedId: string; seedName: string } | null>(null);
  const { myFarm, isLoading, profile } = useGame();
  const qc = useQueryClient();

  const { showSetup, dismissSetup } = useAutoWallet(profile);
  const { requestFullscreen, supported: fsSupported } = useFullscreen();
  useOfflineDetection();

  const handleDismissSetup = () => {
    dismissSetup();
    qc.invalidateQueries({ queryKey: ['profile'] });
  };

  // Maximize viewport: expand() works on all Telegram versions;
  // requestFullscreen() adds true fullscreen on Telegram 10.0+ (Bot API 7.7)
  const enterFullView = useCallback(() => {
    WebApp.expand();
    if (fsSupported) requestFullscreen();
  }, [fsSupported, requestFullscreen]);

  // Auto-expand for returning users on mount
  useEffect(() => {
    if (started) enterFullView();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // Unlock AudioContext on first user gesture (iOS/Telegram WebView requires this)
  useEffect(() => {
    const unlock = () => { soundManager.unlock(); document.removeEventListener('touchstart', unlock); document.removeEventListener('click', unlock); };
    document.addEventListener('touchstart', unlock, { once: true, passive: true });
    document.addEventListener('click', unlock, { once: true });
    return () => { document.removeEventListener('touchstart', unlock); document.removeEventListener('click', unlock); };
  }, []);

  // Welcome toast for new users who joined via a referral link (show once)
  useEffect(() => {
    const SHOWN_KEY = 'bb_ref_welcome';
    if (localStorage.getItem(SHOWN_KEY)) return;
    const startParam = (WebApp as any).initDataUnsafe?.start_param ?? '';
    if (!startParam.startsWith('ref_')) return;
    localStorage.setItem(SHOWN_KEY, '1');
    setTimeout(() => {
      eventBus.emit('show-toast', { message: '🎉 Welcome bonus! +25G added to your farm', type: 'success' });
    }, 3000);
  }, []);


  const { data: friendFarm } = useQuery({
    queryKey: ['friendFarm', visitState?.userId],
    queryFn: () => api.getFarm(visitState!.userId),
    enabled: !!visitState,
  });

  useEffect(() => {
    if (friendFarm && visitState) eventBus.emit('farm-updated', friendFarm);
  }, [friendFarm, visitState]);

  const returnToOwnFarm = useCallback(() => {
    setVisitState(null);
    if (myFarm) eventBus.emit('farm-updated', myFarm);
  }, [myFarm]);

  useEffect(() => {
    const unsubSeed    = eventBus.on('seed-preselected', (data) => setPreSelectedSeed(data));
    const unsubClear   = eventBus.on('seed-cleared', () => setPreSelectedSeed(null));
    return () => { unsubSeed(); unsubClear(); };
  }, []);

  useEffect(() => {
    const unsubPlot = eventBus.on('plot-clicked', (ev: PlotClickEvent) => {
      const activeFarm: FarmData | undefined = visitState ? friendFarm : myFarm;
      const plot = activeFarm?.plots[ev.plotIndex];
      if (!plot) return;

      if (ev.action === 'plant') {
        setModal({ type: 'seed', plotId: ev.plotId, preSelectedSeedId: preSelectedSeed?.seedId });
      } else if (ev.action === 'harvest') {
        setModal({ type: 'harvest', plotIndex: ev.plotIndex });
      } else if (ev.action === 'steal' && visitState) {
        setModal({ type: 'steal', plotId: ev.plotId, plotIndex: ev.plotIndex,
          targetUserId: visitState.userId, targetUsername: visitState.username });
      } else if (ev.action === 'attack' && visitState) {
        setModal({ type: 'attack', plotId: ev.plotId, plotIndex: ev.plotIndex,
          targetUserId: visitState.userId, targetUsername: visitState.username });
      } else if (ev.action === 'upgrade' && !visitState) {
        setModal({ type: 'upgrade-plot', plotId: ev.plotId, plotIndex: ev.plotIndex });
      }
    });

    const unsubFriends = eventBus.on('show-friends', () => setModal({ type: 'friends' }));
    const unsubBuyPlot = eventBus.on('buy-plot', ({ cost }) => setModal({ type: 'buy-plot', cost }));
    const unsubVisit  = eventBus.on('visit-farm', ({ userId, username }) => {
      setVisitState({ userId, username });
      setModal(null);
    });
    const unsubBack = eventBus.on('back-to-my-farm', () => returnToOwnFarm());

    const unsubFertilizer = eventBus.on('fertilizer-select', ({ plotId, plotIndex }) => {
      setModal({ type: 'fertilizer', plotId, plotIndex });
    });

    const unsubTool = eventBus.on('plot-tool-action', async ({ tool, plotId, plotIndex }) => {
      try {
        if (tool === 'dig') {
          eventBus.emit('dig-animation', { plotIndex });
          eventBus.emit('play-sound', 'click');
          await api.dig(plotId);
          eventBus.emit('show-toast', { message: '⛏️ Crop removed', type: 'info' });
        } else if (tool === 'water') {
          const res = await api.water(plotId);
          eventBus.emit('water-animation', { plotIndex });
          eventBus.emit('play-sound', 'water');
          eventBus.emit('show-toast', { message: `💧 ${res.message}`, type: 'success' });
        } else if (tool === 'bug-spray') {
          const res = await api.bugSpray(plotId);
          eventBus.emit('water-animation', { plotIndex });
          eventBus.emit('play-sound', 'weed_kill');
          eventBus.emit('show-toast', { message: `🐛 ${res.message}`, type: 'success' });
        } else if (tool === 'weed-kill') {
          const res = await api.weedKill(plotId);
          eventBus.emit('dig-animation', { plotIndex });
          eventBus.emit('play-sound', 'weed_kill');
          eventBus.emit('show-toast', { message: `🌿 ${res.message}`, type: 'success' });
        }
        qc.invalidateQueries({ queryKey: ['myFarm'] });
        qc.invalidateQueries({ queryKey: ['profile'] });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Action failed';
        eventBus.emit('show-toast', { message: msg, type: 'error' });
      }
    });

    return () => { unsubPlot(); unsubFriends(); unsubBuyPlot(); unsubVisit(); unsubBack(); unsubTool(); unsubFertilizer(); };
  }, [myFarm, friendFarm, visitState, returnToOwnFarm, preSelectedSeed]);

  // Block Phaser input whenever any React modal/overlay is open.
  // Delay unblocking by 200ms to prevent touch bleedthrough — the finger
  // that closed the modal must fully lift before Phaser can receive events.
  useEffect(() => {
    if (modal !== null || showSetup || showTutorial) {
      eventBus.emit('ui-overlay', true);
      return;
    }
    const t = setTimeout(() => eventBus.emit('ui-overlay', false), 200);
    return () => clearTimeout(t);
  }, [modal, showSetup, showTutorial]);

  const activeFarm = visitState ? friendFarm : myFarm;

  // Guard: production access outside Telegram → show redirect screen
  if (import.meta.env.PROD && !WebApp.initData) {
    return <NotInTelegramScreen />;
  }

  // Returning user: show loading overlay while data loads (canvas starts in background)
  if (started && isLoading) {
    return (
      <div className="h-full w-full relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0a1f0a 0%, #1a3a1a 40%, #1e3a5f 100%)' }}>
        <SkeletonHUD />
        <ToastContainer />
      </div>
    );
  }

  // Auth/API error: started=true but profile never loaded — offer retry
  if (started && !isLoading && !profile) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-6"
        style={{ background: 'linear-gradient(160deg, #0a1f0a 0%, #1a3a1a 40%, #1e3a5f 100%)' }}>
        <div className="text-5xl">🦝</div>
        <div className="text-center">
          <p className="text-white font-black text-lg">Connection error</p>
          <p className="text-white/40 text-sm mt-1">Could not reach the farm server.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 rounded-2xl font-bold text-white text-sm active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)', boxShadow: '0 4px 20px rgba(34,197,94,0.35)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // New user: show welcome screen (loading → then Enter Farm button)
  if (!started) {
    return (
      <WelcomeScreen
        onEnter={() => {
          soundManager.unlock();
          enterFullView();
          localStorage.setItem('bb_entered', '1');
          setStarted(true);
          if (localStorage.getItem(TUTORIAL_KEY) !== '1') {
            setShowTutorial(true);
          }
        }}
      />
    );
  }

  return (
    <div className="h-full w-full relative overflow-hidden bg-black">
      {/* ── Phaser canvas (full-screen background, lazy-loaded) ── */}
      <Suspense fallback={null}><GameCanvas /></Suspense>

      {/* ── Top HUD ── */}
      <HUD />

      {/* ── Visit banner ── */}
      {visitState && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <button
            onClick={returnToOwnFarm}
            className="glass-red rounded-full flex items-center gap-2 px-4 py-2 text-red-300 text-sm font-bold active:scale-95 transition-all"
          >
            <ArrowLeft size={14} />
            Raiding @{visitState.username}
          </button>
        </div>
      )}

      {/* ── Friends bar (above bottom bar) ── */}
      <FriendsBar />

      {/* ── Bottom toolbar + nav ── */}
      <BottomBar />

      {/* ── Modals ── */}
      <Suspense fallback={null}>
        {modal?.type === 'seed' && (
          <SeedSelectModal
            plotId={modal.plotId}
            preSelectedSeedId={modal.preSelectedSeedId}
            onClose={() => setModal(null)}
          />
        )}

        {modal?.type === 'harvest' && activeFarm && (
          <HarvestModal
            plot={activeFarm.plots[modal.plotIndex]}
            plotIndex={modal.plotIndex}
            onClose={() => setModal(null)}
          />
        )}

        {modal?.type === 'steal' && activeFarm && (
          <StealModal
            plot={activeFarm.plots.find((p) => p.id === modal.plotId)!}
            plotIndex={modal.plotIndex}
            targetUserId={modal.targetUserId}
            targetUsername={modal.targetUsername}
            hasGuardDog={activeFarm.hasGuardDog}
            guardDogType={activeFarm.guardDogType}
            guardDogDefense={activeFarm.guardDogDefense ?? 0}
            onClose={() => setModal(null)}
          />
        )}

        {modal?.type === 'attack' && activeFarm && (
          <AttackModal
            plot={activeFarm.plots.find((p) => p.id === modal.plotId)!}
            targetUserId={modal.targetUserId}
            targetUsername={modal.targetUsername}
            onClose={() => setModal(null)}
          />
        )}

        {modal?.type === 'friends' && (
          <FriendsModal onClose={() => setModal(null)} />
        )}

        {modal?.type === 'buy-plot' && (
          <BuyPlotModal cost={modal.cost} onClose={() => setModal(null)} />
        )}

        {modal?.type === 'upgrade-plot' && activeFarm && (
          <PlotUpgradeModal
            plotId={modal.plotId}
            plot={activeFarm.plots[modal.plotIndex]}
            onClose={() => setModal(null)}
          />
        )}

        {modal?.type === 'fertilizer' && (
          <FertilizerModal
            plotId={modal.plotId}
            plotIndex={modal.plotIndex}
            onClose={() => setModal(null)}
          />
        )}

        {showSetup && <WalletSetupModal onClose={handleDismissSetup} />}
      </Suspense>

      {showTutorial && <TutorialOverlay onDone={() => setShowTutorial(false)} />}

      <SoundSystem />
      <ToastContainer />
    </div>
  );
}
