import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Wheat } from 'lucide-react';
import { useGame } from '@/providers/GameProvider';
import { eventBus } from '@/game/EventBus';
import { api } from '@/api/client';
import { soundManager } from '@/sounds/SoundManager';

export function HarvestAllButton() {
  const { myFarm } = useGame();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const ripePlots = myFarm?.plots.filter((p) => p.isRipe) ?? [];
  const count = ripePlots.length;

  if (count < 2) return null;

  const handleHarvestAll = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.harvestAll();
      soundManager.play('harvest');
      if (res.levelUp) {
        eventBus.emit('level-up', { newLevel: res.newLevel });
      }
      const units = (res as any).totalCrops ?? (res as any).totalGold ?? 0;
      setToast(`+${Math.floor(units)} crops moved to Storage!`);
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['dailyQuests'] });
      qc.invalidateQueries({ queryKey: ['barnData'] });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Harvest failed';
      setToast(msg);
      setTimeout(() => setToast(null), 2500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleHarvestAll}
        disabled={loading}
        className={[
          'pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all active:scale-95',
          loading
            ? 'glass text-white/40 cursor-not-allowed'
            : 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:bg-amber-400',
        ].join(' ')}
      >
        <Wheat size={16} className={loading ? 'animate-spin' : ''} />
        <span>{loading ? 'Harvesting…' : `Harvest All (${count})`}</span>
      </button>

      {toast && createPortal(
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] pointer-events-auto">
          <div
            onClick={() => { setToast(null); eventBus.emit('show-storage'); }}
            className="glass-green rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl animate-fade-in-down border border-green-400/40 cursor-pointer active:scale-95 transition-all"
          >
            <span className="text-2xl">🌾</span>
            <div className="text-left">
              <p className="text-white font-bold text-xs leading-tight">{toast}</p>
              <p className="text-amber-300 font-bold text-[11px] underline mt-0.5">Tap to open Storage & sell for Gold ➔</p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
