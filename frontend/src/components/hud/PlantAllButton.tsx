import { useState } from 'react';
import { SEED_EMOJI } from "@/constants/seeds";
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sprout } from 'lucide-react';
import { useGame } from '@/providers/GameProvider';
import { api } from '@/api/client';
import { soundManager } from '@/sounds/SoundManager';

interface Props {
  seedId: string;
  seedName: string;
}

export function PlantAllButton({ seedId, seedName }: Props) {
  const { myFarm } = useGame();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const emptyCount = myFarm?.plots.filter((p) => p.isEmpty).length ?? 0;

  if (emptyCount < 2) return null;

  const handlePlantAll = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.plantAll(seedId);
      soundManager.play('plant');
      const emoji = SEED_EMOJI[seedName] ?? '🌿';
      const text = res.skipped > 0
        ? `${emoji} Planted ${res.planted} (${res.skipped} skipped — not enough gold)`
        : `${emoji} Planted ${res.planted} ${seedName} for ${res.totalCost}G`;
      setToast({ text, ok: true });
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['dailyQuests'] });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Plant failed';
      setToast({ text: msg, ok: false });
      setTimeout(() => setToast(null), 2500);
    } finally {
      setLoading(false);
    }
  };

  const emoji = SEED_EMOJI[seedName] ?? '🌿';

  return (
    <>
      <button
        onClick={handlePlantAll}
        disabled={loading}
        className={[
          'pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all active:scale-95',
          loading
            ? 'glass text-white/40 cursor-not-allowed'
            : 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:bg-green-400',
        ].join(' ')}
      >
        <span className="text-base leading-none">{loading ? <Sprout size={16} className="animate-spin" /> : emoji}</span>
        <span>{loading ? 'Planting…' : `Plant All (${emptyCount})`}</span>
      </button>

      {toast && createPortal(
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] pointer-events-none">
          <div className={`glass rounded-2xl px-4 py-3 flex items-center gap-2 shadow-xl animate-fade-in-down border ${toast.ok ? 'border-green-400/30' : 'border-red-400/30'}`}>
            <p className="text-white font-bold text-sm whitespace-nowrap">{toast.text}</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
