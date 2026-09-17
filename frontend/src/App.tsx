import { useState, useEffect, useCallback, lazy, Suspense, type ReactNode, useRef } from 'react';
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
import { LiveTradeToast } from '@/components/notifications/LiveTradeToast';
import { useGame } from '@/providers/GameProvider';
import { useAutoWallet } from '@/hooks/useAutoWallet';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useOfflineDetection } from '@/hooks/useOfflineDetection';
import { api } from '@/api/client';
import WebApp from '@twa-dev/sdk';
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { NeighborVisitHeader } from '@/components/hud/NeighborVisitHeader';
import { soundManager } from '@/sounds/SoundManager';
import type { PlotClickEvent, FarmData } from '@/types/game.types';

// ── Desktop detection ────────────────────────────────────────────────────────
// Telegram Desktop / macOS / Web platforms open Mini Apps in a large panel
// that is not phone-sized. We constrain the game to a 430px centered frame.
function detectDesktop(): boolean {
  const platform = (WebApp as any).platform ?? '';
  return (['tdesktop', 'macos', 'web', 'weba'] as string[]).includes(platform)
    || window.innerWidth > 520;
}

// On desktop, all position:fixed children are contained within the 430px frame
// because CSS `transform` on a parent makes it the fixed-positioning containing block.
function DesktopFrame({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#020802',
    }}>
      <div style={{
        position: 'relative',
        width: '430px',
        height: '100%',
        maxHeight: '932px',
        overflow: 'hidden',
        transform: 'translateZ(0)', // makes position:fixed children relative to this frame
        boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        {children}
      </div>
    </div>
  );
}

const SeedSelectModal  = lazy(() => import('@/components/modals/SeedSelectModal').then(m => ({ default: m.SeedSelectModal })));
const HarvestModal     = lazy(() => import('@/components/modals/HarvestModal').then(m => ({ default: m.HarvestModal })));
const StealModal       = lazy(() => import('@/components/modals/StealModal').then(m => ({ default: m.StealModal })));
const AttackModal      = lazy(() => import('@/components/modals/AttackModal').then(m => ({ default: m.AttackModal })));
const FriendsModal     = lazy(() => import('@/components/modals/FriendsModal').then(m => ({ default: m.FriendsModal })));
const BuyPlotModal     = lazy(() => import('@/components/modals/BuyPlotModal').then(m => ({ default: m.BuyPlotModal })));
const PlotUpgradeModal = lazy(() => import('@/components/modals/PlotUpgradeModal').then(m => ({ default: m.PlotUpgradeModal })));
const WalletSetupModal = lazy(() => import('@/components/modals/WalletSetupModal').then(m => ({ default: m.WalletSetupModal })));
const FertilizerModal  = lazy(() => import('@/components/modals/FertilizerModal').then(m => ({ default: m.FertilizerModal })));
const ConfirmDigModal  = lazy(() => import('@/components/modals/ConfirmDigModal').then(m => ({ default: m.ConfirmDigModal })));
const SettingsModal    = lazy(() => import('@/components/modals/SettingsModal').then(m => ({ default: m.SettingsModal })));
const DogStatusModal   = lazy(() => import('@/components/modals/DogStatusModal').then(m => ({ default: m.DogStatusModal })));

type ActiveModal =
  | { type: 'seed'; plotId: string; preSelectedSeedId?: string }
  | { type: 'harvest'; plotIndex: number }
  | { type: 'steal'; plotId: string; plotIndex: number; targetUserId: string; targetUsername: string; isRevenge?: boolean }
  | { type: 'attack'; plotId: string; plotIndex: number; targetUserId: string; targetUsername: string }
  | { type: 'friends' }
  | { type: 'buy-plot'; cost: number }
  | { type: 'upgrade-plot'; plotId: string; plotIndex: number }
  | { type: 'fertilizer'; plotId: string; plotIndex: number }
  | { type: 'confirm-dig'; plotId: string; plotIndex: number; cropName: string; isRipe: boolean }
  | { type: 'dog-status'; dogId?: string | null; dogType?: string | null; defense: number; lastFedAt?: string | null; isVisiting?: boolean }
  | null;


export function App() {
  const currentTelegramId = (WebApp as any).initDataUnsafe?.user?.id;
  const enteredStorageKey = currentTelegramId ? `bb_entered_${currentTelegramId}` : 'bb_entered';
  const tutorialStorageKey = currentTelegramId ? `${TUTORIAL_KEY}_${currentTelegramId}` : TUTORIAL_KEY;

  const [started, setStarted] = useState(
    () => localStorage.getItem(enteredStorageKey) === '1' || localStorage.getItem('bb_entered') === '1',
  );
  // Show tutorial if user has entered the game but hasn't completed the tutorial yet
  const [showTutorial, setShowTutorial] = useState(() => {
    const hasEntered = localStorage.getItem(enteredStorageKey) === '1' || localStorage.getItem('bb_entered') === '1';
    const isDone = currentTelegramId
      ? localStorage.getItem(tutorialStorageKey) === '1'
      : (localStorage.getItem(tutorialStorageKey) === '1' || localStorage.getItem(TUTORIAL_KEY) === '1');
    return hasEntered && !isDone;
  });
  const [modal, setModal] = useState<ActiveModal>(null);
  const [visitState, setVisitState] = useState<{ userId: string; username: string; isRevenge?: boolean } | null>(null);
  const [preSelectedSeed, setPreSelectedSeed] = useState<{ seedId: string; seedName: string } | null>(null);
  const { myFarm, isLoading, profile, profileError, refetchAll } = useGame();
  const qc = useQueryClient();

  const [isDesktop] = useState(detectDesktop);
  const [desktopFullscreen, setDesktopFullscreen] = useState(false);

  const { showSetup, dismissSetup } = useAutoWallet(profile);
  const { requestFullscreen, exitFullscreen, supported: fsSupported } = useFullscreen();
  useOfflineDetection();

  const handleDismissSetup = () => {
    dismissSetup();
    qc.invalidateQueries({ queryKey: ['profile'] });
  };

  // On desktop: expand() fills the Telegram panel (fine), but skip requestFullscreen()
  // which would take over the entire OS screen and break the centered layout.
  // On mobile: both expand() and requestFullscreen() are used as before.
  const enterFullView = useCallback(() => {
    WebApp.expand();
    if (!isDesktop) {
      if (fsSupported) requestFullscreen();
      try { (WebApp as any).disableVerticalSwipes?.(); } catch {}
    }
  }, [isDesktop, fsSupported, requestFullscreen]);

  // Desktop fullscreen toggle: when user explicitly enables it, go OS fullscreen
  const toggleDesktopFullscreen = useCallback(() => {
    if (desktopFullscreen) {
      exitFullscreen();
      setDesktopFullscreen(false);
    } else {
      if (fsSupported) requestFullscreen();
      setDesktopFullscreen(true);
    }
  }, [desktopFullscreen, fsSupported, requestFullscreen, exitFullscreen]);

  // Auto-expand for returning users on mount
  useEffect(() => {
    if (started) enterFullView();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // Back button — closes open modal, or returns to own farm from visit, or closes app
  useEffect(() => {
    const bb = WebApp.BackButton;
    if (!bb) return;

    const hasBack = !!modal || !!visitState;
    if (hasBack) {
      bb.show();
    } else {
      bb.hide();
    }

    const handler = () => {
      if (modal) { setModal(null); return; }
      if (visitState) { returnToOwnFarm(); return; }
      WebApp.close();
    };

    bb.onClick(handler);
    return () => { bb.offClick(handler); };
  }, [modal, visitState]);

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
    eventBus.emit('return-to-own-farm');
    qc.removeQueries({ queryKey: ['friendFarm'] });
    qc.invalidateQueries({ queryKey: ['myFarm'] });
    const currentFarm = qc.getQueryData<FarmData>(['myFarm']) ?? myFarm;
    if (currentFarm) {
      eventBus.emit('farm-updated', currentFarm);
    }
  }, [myFarm, qc]);

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
          targetUserId: visitState.userId, targetUsername: visitState.username, isRevenge: visitState.isRevenge });
      } else if (ev.action === 'attack' && visitState) {
        setModal({ type: 'attack', plotId: ev.plotId, plotIndex: ev.plotIndex,
          targetUserId: visitState.userId, targetUsername: visitState.username });
      } else if (ev.action === 'upgrade' && !visitState) {
        setModal({ type: 'upgrade-plot', plotId: ev.plotId, plotIndex: ev.plotIndex });
      }
    });

    const unsubFriends = eventBus.on('show-friends', () => setModal({ type: 'friends' }));
    const unsubBuyPlot = eventBus.on('buy-plot', ({ cost }) => setModal({ type: 'buy-plot', cost }));
    const unsubVisit  = eventBus.on('visit-farm', ({ userId, username, isRevenge }) => {
      setVisitState({ userId, username, isRevenge });
      setModal(null);
    });
    const unsubBack = eventBus.on('back-to-my-farm', () => returnToOwnFarm());

    const unsubFertilizer = eventBus.on('fertilizer-select', ({ plotId, plotIndex }) => {
      setModal({ type: 'fertilizer', plotId, plotIndex });
    });

    const unsubTool = eventBus.on('plot-tool-action', async ({ tool, plotId, plotIndex }) => {
      try {
        if (tool === 'dig') {
          const plot = myFarm?.plots[plotIndex];
          if (!plot || plot.isEmpty) {
            eventBus.emit('show-toast', { message: 'Plot is already empty', type: 'info' });
            return;
          }
          const cropName = plot.seed?.name ?? 'Crop';
          const isRipe = !!plot.isRipe;
          setModal({ type: 'confirm-dig', plotId, plotIndex, cropName, isRipe });
          return;
        } else if (tool === 'water') {
          const res = await api.water(plotId);
          eventBus.emit('water-animation', { plotIndex });
          eventBus.emit('play-sound', 'water');
          eventBus.emit('show-toast', { message: res.message, type: 'success' });
        } else if (tool === 'bug-spray') {
          const res = await api.bugSpray(plotId);
          eventBus.emit('water-animation', { plotIndex });
          eventBus.emit('play-sound', 'weed_kill');
          eventBus.emit('show-toast', { message: res.message, type: 'success' });
        } else if (tool === 'weed-kill') {
          const res = await api.weedKill(plotId);
          eventBus.emit('dig-animation', { plotIndex });
          eventBus.emit('play-sound', 'weed_kill');
          eventBus.emit('show-toast', { message: res.message, type: 'success' });
        }
        qc.invalidateQueries({ queryKey: ['myFarm'] });
        qc.invalidateQueries({ queryKey: ['profile'] });
        qc.invalidateQueries({ queryKey: ['dailyQuests'] });
        qc.invalidateQueries({ queryKey: ['achievements'] });
        if (visitState) {
          qc.invalidateQueries({ queryKey: ['friendFarm', visitState.userId] });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Action failed';
        eventBus.emit('show-toast', { message: msg, type: 'error' });
      }
    });

    const unsubTutorial = eventBus.on('show-tutorial', () => setShowTutorial(true));

    const unsubDog = eventBus.on('dog-clicked', (ev) => {
      setModal({
        type: 'dog-status',
        dogId: ev.dogId,
        dogType: ev.dogType,
        defense: ev.defense,
        lastFedAt: ev.lastFedAt,
        isVisiting: ev.isVisiting,
      });
    });

    return () => { unsubPlot(); unsubFriends(); unsubBuyPlot(); unsubVisit(); unsubBack(); unsubTool(); unsubFertilizer(); unsubTutorial(); unsubDog(); };
  }, [myFarm, friendFarm, visitState, returnToOwnFarm, preSelectedSeed]);

  // Block Phaser input whenever any React modal/overlay is open.
  useEffect(() => {
    const open = modal !== null || showSetup || showTutorial;
    eventBus.setOverlay('App', open);
  }, [modal, showSetup, showTutorial]);

  const activeFarm = visitState ? friendFarm : myFarm;

  // Guard: production access outside Telegram → show redirect screen
  if (import.meta.env.PROD && !WebApp.initData) {
    return <DesktopFrame enabled={isDesktop}><NotInTelegramScreen /></DesktopFrame>;
  }

  // Returning user: show loading overlay while data loads (canvas starts in background)
  if (started && isLoading) {
    return (
      <DesktopFrame enabled={isDesktop}>
        <div className="h-full w-full relative overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #0a1f0a 0%, #1a3a1a 40%, #1e3a5f 100%)' }}>
          <SkeletonHUD />
          <ToastContainer />
        </div>
      </DesktopFrame>
    );
  }

  // Auth/API error: started=true but profile never loaded — show error details and auto-retry
  if (started && !isLoading && !profile) {
    const errMsg = profileError?.message ?? 'Unknown error';
    return (
      <DesktopFrame enabled={isDesktop}>
        <ConnectionErrorScreen errMsg={errMsg} onRetry={refetchAll} />
      </DesktopFrame>
    );
  }

  // New user: show welcome screen (loading → then Enter Farm button)
  if (!started) {
    return (
      <DesktopFrame enabled={isDesktop}>
        <WelcomeScreen
          onEnter={() => {
            soundManager.unlock();
            enterFullView();
            localStorage.setItem(enteredStorageKey, '1');
            localStorage.setItem('bb_entered', '1');
            setStarted(true);
            const isDone = currentTelegramId
              ? localStorage.getItem(tutorialStorageKey) === '1'
              : (localStorage.getItem(tutorialStorageKey) === '1' || localStorage.getItem(TUTORIAL_KEY) === '1');
            if (!isDone) {
              setShowTutorial(true);
            }
          }}
        />
      </DesktopFrame>
    );
  }

  return (
    <DesktopFrame enabled={isDesktop && !desktopFullscreen}>
    <div className="h-full w-full relative overflow-hidden bg-black">
      {/* ── Phaser canvas (full-screen background, lazy-loaded) ── */}
      <Suspense fallback={null}><GameCanvas /></Suspense>

      {/* ── Top HUD (includes desktop fullscreen toggle seamlessly in flex row) ── */}
      <HUD
        isDesktop={isDesktop}
        desktopFullscreen={desktopFullscreen}
        onToggleDesktopFullscreen={toggleDesktopFullscreen}
      />

      {/* ── Neighbor Visit Header ── */}
      {visitState && (
        <NeighborVisitHeader
          targetUserId={visitState.userId}
          targetUsername={visitState.username}
          hasGuardDog={friendFarm?.hasGuardDog ?? false}
          guardDogType={friendFarm?.guardDogType ?? null}
          guardDogDefense={friendFarm?.guardDogDefense ?? 0}
          isRevenge={visitState.isRevenge}
          onReturn={returnToOwnFarm}
        />
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

        {modal?.type === 'steal' && activeFarm && (() => {
          const plot = activeFarm.plots.find((p) => p.id === modal.plotId) ?? activeFarm.plots[modal.plotIndex];
          if (!plot) return null;
          return (
            <StealModal
              plot={plot}
              plotIndex={modal.plotIndex}
              targetUserId={modal.targetUserId}
              targetUsername={modal.targetUsername}
              hasGuardDog={activeFarm.hasGuardDog}
              guardDogType={activeFarm.guardDogType}
              guardDogDefense={activeFarm.guardDogDefense ?? 0}
              isRevenge={modal.isRevenge}
              onClose={() => setModal(null)}
              onSwitchToAttack={() => setModal({
                type: 'attack', plotId: modal.plotId, plotIndex: modal.plotIndex,
                targetUserId: modal.targetUserId, targetUsername: modal.targetUsername,
              })}
            />
          );
        })()}

        {modal?.type === 'attack' && activeFarm && (() => {
          const plot = activeFarm.plots.find((p) => p.id === modal.plotId) ?? activeFarm.plots[modal.plotIndex];
          if (!plot) return null;
          return (
            <AttackModal
              plot={plot}
              targetUserId={modal.targetUserId}
              targetUsername={modal.targetUsername}
              onClose={() => setModal(null)}
              onSwitchToSteal={() => setModal({
                type: 'steal', plotId: modal.plotId, plotIndex: modal.plotIndex,
                targetUserId: modal.targetUserId, targetUsername: modal.targetUsername,
              })}
            />
          );
        })()}

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

        {modal?.type === 'confirm-dig' && (
          <ConfirmDigModal
            plotId={modal.plotId}
            plotIndex={modal.plotIndex}
            cropName={modal.cropName}
            isRipe={modal.isRipe}
            onClose={() => setModal(null)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ['myFarm'] });
              qc.invalidateQueries({ queryKey: ['profile'] });
            }}
          />
        )}

        {modal?.type === 'dog-status' && (
          <DogStatusModal
            dogId={modal.dogId}
            dogType={modal.dogType}
            defense={modal.defense}
            lastFedAt={modal.lastFedAt}
            isVisiting={modal.isVisiting}
            onClose={() => setModal(null)}
          />
        )}

        {showSetup && <WalletSetupModal onClose={handleDismissSetup} />}
      </Suspense>

      {showTutorial && (
        <TutorialOverlay
          storageKey={tutorialStorageKey}
          onDone={() => setShowTutorial(false)}
        />
      )}

      <SoundSystem />
      <ToastContainer />
      <LiveTradeToast />
    </div>
    </DesktopFrame>
  );
}

// Diagnostic error screen.
//
// It used to infer "network problem" from an unauthenticated /api/ping and then tell the
// player to disable their Telegram proxy. That advice is wrong for the failure this screen
// most often represents: /api/ping answers 200 while every AUTHENTICATED route is rejected,
// because the session cookie is never stored for a cross-origin iframe. We now classify the
// error the API client actually surfaced (it carries the HTTP status / server message) and
// only blame the network when the network is genuinely the problem.
function ConnectionErrorScreen({ errMsg, onRetry }: { errMsg: string; onRetry: () => void }) {
  const [pingResult, setPingResult] = useState<'testing' | 'ok' | 'fail'>('testing');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    fetch('/api/ping', { cache: 'no-store' })
      .then(r => r.ok ? setPingResult('ok') : setPingResult('fail'))
      .catch(() => setPingResult('fail'));
  }, []);

  // api/client.ts throws `auth-401: …` when /auth/session is rejected, and `HTTP 401` (or
  // the guard's own message) when a game route is rejected — match both shapes.
  const isNetworkFailure =
    /failed to fetch|network\s?error|load failed|network request failed|timed?\s?out|aborted/i.test(errMsg);
  const isAuthFailure =
    /auth[-_ ]?40[13]|\b40[13]\b|unauthorized|forbidden|init\s?data|session (expired|invalid|missing)/i.test(errMsg);
  const isServerFault = /\b5\d\d\b|internal server error/i.test(errMsg);

  const hardRelogin = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    try { document.cookie = 'bb_sess=; Max-Age=0; path=/'; } catch { /* ignore */ }
    window.location.reload();
  };

  const hint =
    pingResult === 'testing' ? null :
    pingResult === 'fail'
      ? 'Server unreachable. In Telegram → Settings → Proxy: disable proxy, or switch to mobile data.'
      : isNetworkFailure && pingResult !== 'ok'
        ? 'Network request failed. Check your internet connection or proxy settings.'
        : isAuthFailure
          ? 'The server is reachable, but could not authenticate this Telegram account. Tap “Re-login” to restart your session.'
          : isServerFault
            ? 'The server returned an error while creating your session. Tap “Retry”, then “Re-login”.'
            : 'The server is reachable but rejected the request. Tap “Re-login”.';

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-6"
      style={{ background: 'linear-gradient(160deg, #0a1f0a 0%, #1a3a1a 40%, #1e3a5f 100%)' }}>
      <div className="text-5xl">🦝</div>
      <div className="text-center">
        <p className="text-white font-black text-lg">Connection error</p>
        <p className="text-white/40 text-sm mt-1">Could not reach the farm server.</p>
        {hint && (
          <p className="text-yellow-300/80 text-xs mt-3 px-2 leading-relaxed">{hint}</p>
        )}
        {isAuthFailure && (
          <p className="text-white/30 text-[10px] mt-2 px-2">
            Diagnosed as an authentication failure — the Telegram account was not accepted.
          </p>
        )}
        <p className="text-white/20 text-[10px] mt-2 font-mono break-all px-2">{errMsg}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => onRetry()}
          className="px-6 py-3 rounded-2xl font-bold text-white text-sm active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)', boxShadow: '0 4px 20px rgba(34,197,94,0.35)' }}
        >
          Retry
        </button>
        <button
          onClick={hardRelogin}
          className="px-6 py-3 rounded-2xl font-bold text-white/60 text-sm active:scale-95 transition-all"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          Re-login
        </button>
      </div>
    </div>
  );
}
