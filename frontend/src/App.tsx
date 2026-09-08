import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GameCanvas } from '@/game/GameCanvas';
import { eventBus } from '@/game/EventBus';
import { HUD } from '@/components/hud/HUD';
import { BottomBar } from '@/components/hud/BottomBar';
import { SeedSelectModal } from '@/components/modals/SeedSelectModal';
import { HarvestModal } from '@/components/modals/HarvestModal';
import { StealModal } from '@/components/modals/StealModal';
import { FriendsModal } from '@/components/modals/FriendsModal';
import { useGame } from '@/providers/GameProvider';
import { api } from '@/api/client';
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

  // When visiting a friend, fetch their farm
  const { data: friendFarm } = useQuery({
    queryKey: ['friendFarm', visitState?.userId],
    queryFn: () => api.getFarm(visitState!.userId),
    enabled: !!visitState,
  });

  // Push friend farm to Phaser when available
  useEffect(() => {
    if (friendFarm && visitState) {
      eventBus.emit('farm-updated', friendFarm);
    }
  }, [friendFarm, visitState]);

  // Return to own farm
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
        setModal({
          type: 'steal',
          plotId: ev.plotId,
          plotIndex: ev.plotIndex,
          targetUserId: visitState.userId,
          targetUsername: visitState.username,
        });
      }
    });

    const unsubFriends = eventBus.on('show-friends', () => {
      setModal({ type: 'friends' });
    });

    const unsubVisit = eventBus.on('visit-farm', ({ userId, username }) => {
      setVisitState({ userId, username });
      setModal(null);
    });

    const unsubBack = eventBus.on('back-to-my-farm', () => {
      returnToOwnFarm();
    });

    return () => { unsubPlot(); unsubFriends(); unsubVisit(); unsubBack(); };
  }, [myFarm, friendFarm, visitState, returnToOwnFarm]);

  const activeFarm = visitState ? friendFarm : myFarm;

  return (
    <>
      {/* Phaser canvas - full screen background layer */}
      <GameCanvas />

      {/* React UI overlays */}
      <HUD />

      {visitState && (
        <div style={{
          position: 'fixed', top: 52, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, background: 'rgba(198,40,40,0.85)', borderRadius: 20,
          padding: '5px 16px', fontSize: 13, color: '#fff', fontWeight: 600,
          border: '1px solid rgba(255,255,255,0.2)',
        }}>
          🥷 Raiding @{visitState.username}'s farm
        </div>
      )}

      <BottomBar onShowFriends={() => setModal({ type: 'friends' })} />

      {/* Modals */}
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
    </>
  );
}
