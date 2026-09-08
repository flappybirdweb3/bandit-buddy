import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useSteal } from '@/hooks/usePlotActions';
import type { FarmPlot, StealResult } from '@/types/game.types';

interface Props {
  plot: FarmPlot;
  plotIndex: number;
  targetUserId: string;
  targetUsername: string;
  onClose: () => void;
}

export function StealModal({ plot, plotIndex, targetUserId, targetUsername, onClose }: Props) {
  const steal = useSteal(plotIndex);
  const [result, setResult] = useState<StealResult | null>(null);

  const handleSteal = async () => {
    try {
      const res = await steal.mutateAsync({ targetUserId, plotId: plot.id });
      setResult(res);
    } catch {}
  };

  if (result) {
    return (
      <Modal title={result.success ? '✅ Heist Successful!' : '🐕 Caught!'} onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '16px 0 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>
            {result.success ? '💰' : '🤕'}
          </div>
          <p style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>
            {result.message}
          </p>
          <div style={{
            background: result.success ? 'rgba(118,255,3,0.1)' : 'rgba(255,87,34,0.1)',
            border: `1px solid ${result.success ? 'rgba(118,255,3,0.3)' : 'rgba(255,87,34,0.3)'}`,
            borderRadius: 12, padding: '12px 16px', margin: '16px 0',
          }}>
            <div style={{ color: result.success ? '#76ff03' : '#ff5722', fontWeight: 700, fontSize: 22 }}>
              {result.goldChange >= 0 ? '+' : ''}{result.goldChange.toFixed(2)} GOLD
            </div>
          </div>
          <Button fullWidth onClick={onClose}>Close</Button>
        </div>
      </Modal>
    );
  }

  const stealAmount = plot.seed
    ? Math.min(plot.seed.baseYield * 0.05, plot.stealableRemaining)
    : 0;

  return (
    <Modal title={`🥷 Rob ${targetUsername}`} onClose={onClose}>
      <div style={{ padding: '4px 0 16px' }}>
        <div style={{
          background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 16, marginBottom: 16,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          <InfoRow label="Target" value={plot.seed?.name ?? '-'} icon="🌾" />
          <InfoRow label="Steal ≈" value={`+${stealAmount.toFixed(1)} G`} icon="💰" color="#76ff03" />
          <InfoRow label="Remaining" value={`${plot.stealableRemaining.toFixed(1)} G`} icon="📊" />
          <InfoRow label="Cost" value="10 ⚡" icon="" color="#fff176" />
        </div>

        <div style={{
          background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.3)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13,
          color: 'rgba(255,255,255,0.7)',
        }}>
          ⚠️ Base success rate: <strong style={{ color: '#ffd700' }}>80%</strong><br />
          A guard dog could bite you and steal <strong style={{ color: '#ff5722' }}>5% of your GOLD</strong>!
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleSteal} disabled={steal.isPending} style={{ flex: 2 }}>
            {steal.isPending ? '🥷 Sneaking...' : '🥷 Steal Now!'}
          </Button>
        </div>

        {steal.error && (
          <p style={{ color: '#ff5722', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
            {steal.error.message}
          </p>
        )}
      </div>
    </Modal>
  );
}

function InfoRow({ label, value, icon, color }: {
  label: string; value: string; icon: string; color?: string;
}) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{icon} {label}</div>
      <div style={{ color: color || '#fff', fontWeight: 700, fontSize: 14 }}>{value}</div>
    </div>
  );
}
