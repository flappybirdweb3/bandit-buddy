import { X, Coins, ShieldAlert } from 'lucide-react';
import { useHarvest } from '@/hooks/usePlotActions';
import type { FarmPlot } from '@/types/game.types';

interface Props { plot: FarmPlot; onClose: () => void }

const SEED_EMOJI: Record<string, string> = {
  wheat: '🌾', carrot: '🥕', corn: '🌽', tomato: '🍅', pumpkin: '🎃',
};

export function HarvestModal({ plot, onClose }: Props) {
  const harvest = useHarvest();

  const netYield = plot.seed ? Math.max(0, plot.seed.baseYield - plot.totalStolen) : 0;
  const emoji = plot.seed ? (SEED_EMOJI[plot.seed.iconKey] ?? '🌿') : '🌿';
  const stolenPct = plot.seed
    ? Math.round((plot.totalStolen / plot.seed.baseYield) * 100)
    : 0;

  const handleHarvest = async () => {
    await harvest.mutateAsync(plot.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up p-5 pb-10 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        <button onClick={onClose} className="absolute top-4 right-4 glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
          <X size={16} />
        </button>

        {/* Crop */}
        <div className="text-6xl mb-2">{emoji}</div>
        <h2 className="text-white font-black text-xl mb-1">{plot.seed?.name}</h2>
        <p className="text-white/40 text-xs mb-5">Ready to harvest!</p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="glass-gold rounded-2xl p-3">
            <div className="text-amber-300 font-black text-xl">+{plot.seed?.baseYield.toFixed(0)}</div>
            <div className="text-white/40 text-[10px] mt-0.5">Full Yield (G)</div>
          </div>
          <div className="glass-red rounded-2xl p-3">
            <div className="text-red-400 font-black text-xl">-{plot.totalStolen.toFixed(0)}</div>
            <div className="text-white/40 text-[10px] mt-0.5">Stolen ({stolenPct}%)</div>
          </div>
        </div>

        {/* Net yield highlight */}
        <div className="glass-green rounded-2xl py-4 px-6 mb-5 flex items-center justify-center gap-3">
          <Coins size={20} className="text-amber-400" />
          <div>
            <div className="text-green-400 font-black text-3xl leading-none">+{netYield.toFixed(0)}</div>
            <div className="text-white/40 text-xs mt-0.5">GOLD you receive</div>
          </div>
        </div>

        {plot.totalStolen > 0 && (
          <div className="flex items-center justify-center gap-1.5 text-white/40 text-xs mb-5">
            <ShieldAlert size={12} className="text-red-400" />
            Thieves stole {plot.totalStolen.toFixed(0)} GOLD — get guard dogs next time!
          </div>
        )}

        <button
          onClick={handleHarvest}
          disabled={harvest.isPending}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-500 py-4 rounded-2xl text-white font-black active:scale-95 transition-all disabled:opacity-40"
        >
          {harvest.isPending ? 'Harvesting…' : `Harvest ${netYield.toFixed(0)} GOLD`}
        </button>

        {harvest.error && (
          <p className="text-red-400 text-xs mt-3">{harvest.error.message}</p>
        )}
      </div>
    </div>
  );
}
