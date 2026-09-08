import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useHarvest } from '@/hooks/usePlotActions';
import type { FarmPlot } from '@/types/game.types';

interface Props {
  plot: FarmPlot;
  onClose: () => void;
}

export function HarvestModal({ plot, onClose }: Props) {
  const harvest = useHarvest();

  const handleHarvest = async () => {
    try {
      await harvest.mutateAsync(plot.id);
      onClose();
    } catch {}
  };

  const netYield = plot.seed
    ? Math.max(0, plot.seed.baseYield - plot.totalStolen)
    : 0;

  return (
    <Modal title="🌾 Ready to Harvest!" onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>
          {plot.seed?.name === 'Wheat' ? '🌾' : plot.seed?.name === 'Carrot' ? '🥕' :
           plot.seed?.name === 'Corn' ? '🌽' : plot.seed?.name === 'Tomato' ? '🍅' :
           plot.seed?.name === 'Pumpkin' ? '🎃' : '🌿'}
        </div>

        <h3 style={{ color: '#fff', margin: '0 0 16px', fontSize: 20 }}>
          {plot.seed?.name}
        </h3>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20,
        }}>
          <StatCard label="Full Yield" value={`+${plot.seed?.baseYield.toFixed(0)} G`} color="#ffd700" />
          <StatCard label="Stolen" value={`-${plot.totalStolen.toFixed(0)} G`} color="#ff5722" />
          <StatCard label="You Earn" value={`+${netYield.toFixed(0)} G`} color="#76ff03" large />
        </div>

        {plot.totalStolen > 0 && (
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 16 }}>
            🐾 Thieves stole {plot.totalStolen.toFixed(0)} GOLD from this crop
          </p>
        )}

        <Button fullWidth onClick={handleHarvest} disabled={harvest.isPending}>
          {harvest.isPending ? '⏳ Harvesting...' : `🌾 Harvest ${netYield.toFixed(0)} GOLD`}
        </Button>

        {harvest.error && (
          <p style={{ color: '#ff5722', fontSize: 13, marginTop: 10 }}>
            {harvest.error.message}
          </p>
        )}
      </div>
    </Modal>
  );
}

function StatCard({ label, value, color, large }: {
  label: string; value: string; color: string; large?: boolean;
}) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '8px 12px',
      gridColumn: large ? 'span 2' : undefined,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ color, fontWeight: 700, fontSize: large ? 22 : 16 }}>{value}</div>
    </div>
  );
}
