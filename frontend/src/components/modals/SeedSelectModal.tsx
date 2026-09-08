import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useGame } from '@/providers/GameProvider';
import { usePlant } from '@/hooks/usePlotActions';

interface Props {
  plotId: string;
  onClose: () => void;
}

const SEED_ICONS: Record<string, string> = {
  wheat: '🌾', carrot: '🥕', corn: '🌽', tomato: '🍅', pumpkin: '🎃',
};

export function SeedSelectModal({ plotId, onClose }: Props) {
  const { seeds, profile } = useGame();
  const plant = usePlant();

  const handlePlant = async (seedId: string) => {
    try {
      await plant.mutateAsync({ plotId, seedId });
      onClose();
    } catch (err) {
      // error shown inline
    }
  };

  const fmt = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    return `${Math.floor(sec / 3600)}h`;
  };

  return (
    <Modal title="🌱 Choose a Seed" onClose={onClose}>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 14 }}>
        Your GOLD: <strong style={{ color: '#ffd700' }}>{profile?.goldBalance.toFixed(0) ?? 0}</strong>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {seeds.map((seed) => {
          const canAfford = (profile?.goldBalance ?? 0) >= seed.costGold;
          const roi = ((seed.baseYield - seed.costGold) / seed.costGold * 100).toFixed(0);

          return (
            <div
              key={seed.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: canAfford ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.3)',
                borderRadius: 12, padding: '10px 14px',
                border: canAfford ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,0,0,0.2)',
                opacity: canAfford ? 1 : 0.6,
              }}
            >
              <span style={{ fontSize: 32 }}>{SEED_ICONS[seed.iconKey] || '🌿'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{seed.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>
                  ⏱ {fmt(seed.growTimeSec)} · 📈 +{roi}% ROI · Max steal: {(seed.baseYield * 0.2).toFixed(0)}G
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#ffd700', fontWeight: 700, fontSize: 14 }}>
                  🪙 {seed.costGold}
                </div>
                <div style={{ color: '#76ff03', fontSize: 12 }}>
                  +{seed.baseYield}G
                </div>
              </div>
              <Button
                variant={canAfford ? 'primary' : 'ghost'}
                disabled={!canAfford || plant.isPending}
                onClick={() => canAfford && handlePlant(seed.id)}
                style={{ padding: '8px 14px', fontSize: 13 }}
              >
                Plant
              </Button>
            </div>
          );
        })}
      </div>

      {plant.error && (
        <p style={{ color: '#ff5722', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
          {plant.error.message}
        </p>
      )}
    </Modal>
  );
}
