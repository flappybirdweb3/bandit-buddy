import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReconnect } from 'wagmi';
import { GameCanvas } from '@/game/GameCanvas';
import { eventBus } from '@/game/EventBus';
import { HUD } from '@/components/hud/HUD';
import { BottomBar } from '@/components/hud/BottomBar';
import { FriendsBar } from '@/components/hud/FriendsBar';
import { SeedSelectModal } from '@/components/modals/SeedSelectModal';
import { HarvestModal } from '@/components/modals/HarvestModal';
import { StealModal } from '@/components/modals/StealModal';
import { FriendsModal } from '@/components/modals/FriendsModal';
import { useGame } from '@/providers/GameProvider';
import { api } from '@/api/client';
import { ArrowLeft } from 'lucide-react';
import type { PlotClickEvent, FarmData } from '@/types/game.types';

type ActiveModal =
  | { type: 'seed'; plotId: string }
  | { type: 'harvest'; plotIndex: number }
  | { type: 'steal'; plotId: string; plotIndex: number; targetUserId: string; targetUsername: string }
  | { type: 'friends' }
  | null;


export function App() {
  const [modal, setModal] = useState<ActiveModal>(null);
  const [visitState, setVisitState] = useState<{ userId: string; username: string } | null>(null);
  const { myFarm } = useGame();
  const { reconnect } = useReconnect();

  // WalletConnect WebSocket drops when Telegram WebView is backgrounded (user switches to
  // MetaMask to approve). Re-trigger on visibility so wagmi picks up the relay session.
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') reconnect(); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [reconnect]);

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
    const unsubPlot = eventBus.on('plot-clicked', (ev: PlotClickEvent) => {
      const activeFarm: FarmData | undefined = visitState ? friendFarm : myFarm;
      const plot = activeFarm?.plots[ev.plotIndex];
      if (!plot) return;

      if (ev.action === 'plant') {
        setModal({ type: 'seed', plotId: ev.plotId });
      } else if (ev.action === 'harvest') {
        setModal({ type: 'harvest', plotIndex: ev.plotIndex });
      } else if (ev.action === 'steal' && visitState) {
        setModal({ type: 'steal', plotId: ev.plotId, plotIndex: ev.plotIndex,
          targetUserId: visitState.userId, targetUsername: visitState.username });
      }
    });

    const unsubFriends = eventBus.on('show-friends', () => setModal({ type: 'friends' }));
    const unsubVisit  = eventBus.on('visit-farm', ({ userId, username }) => {
      setVisitState({ userId, username });
      setModal(null);
    });
    const unsubBack = eventBus.on('back-to-my-farm', () => returnToOwnFarm());

    return () => { unsubPlot(); unsubFriends(); unsubVisit(); unsubBack(); };
  }, [myFarm, friendFarm, visitState, returnToOwnFarm]);

  const activeFarm = visitState ? friendFarm : myFarm;

  return (
    <div className="h-screen w-full relative overflow-hidden bg-black">
      {/* ── Phaser canvas (full-screen background) ── */}
      <GameCanvas />

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
      <BottomBar onShowFriends={() => setModal({ type: 'friends' })} />

      {/* ── Modals ── */}
      {modal?.type === 'seed' && (
        <SeedSelectModal plotId={modal.plotId} onClose={() => setModal(null)} />
      )}

      {modal?.type === 'harvest' && activeFarm && (
        <HarvestModal
          plot={activeFarm.plots[modal.plotIndex]}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'steal' && activeFarm && (
        <StealModal
          plot={activeFarm.plots.find((p) => p.id === modal.plotId)!}
          plotIndex={modal.plotIndex}
          targetUserId={modal.targetUserId}
          targetUsername={modal.targetUsername}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'friends' && (
        <FriendsModal onClose={() => setModal(null)} />
      )}
    </div>
  );
}
