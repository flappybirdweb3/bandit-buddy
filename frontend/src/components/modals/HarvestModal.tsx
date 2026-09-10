import { X, Coins, ShieldAlert, Bug, Leaf, Droplet } from 'lucide-react';
import { SEED_EMOJI } from "@/constants/seeds";
import { useHarvest } from '@/hooks/usePlotActions';
import { eventBus } from '@/game/EventBus';
import type { FarmPlot } from '@/types/game.types';

interface Props { plot: FarmPlot; plotIndex: number; onClose: () => void }

export function HarvestModal({ plot, plotIndex, onClose }: Props) {
  const harvest = useHarvest();

  const baseYield  = plot.seed?.baseYield ?? 0;
  let   infestMult = 1.0;
  if (plot.hasBugs)  infestMult -= 0.20;
  if (plot.hasWeeds) infestMult -= 0.30;
  infestMult = Math.max(0, infestMult);
  const dryMult    = plot.hasDrySoil ? 0.85 : 1.0;
  const afterInfest = baseYield * infestMult * dryMult;
  const netYield   = Math.max(0, afterInfest - plot.totalStolen);
  const emoji      = plot.seed ? (SEED_EMOJI[plot.seed.iconKey] ?? '🌿') : '🌿';
  const stolenPct  = baseYield > 0 ? Math.round((plot.totalStolen / baseYield) * 100) : 0;
  const hasDeductions = plot.hasBugs || plot.hasWeeds || plot.hasDrySoil || plot.totalStolen > 0;

  const handleHarvest = async () => {
    await harvest.mutateAsync(plot.id);
    eventBus.emit('play-sound', 'harvest');
    eventBus.emit('harvest-animation', { plotIndex, gold: netYield });
    setTimeout(() => eventBus.emit('play-sound', 'coin'), 180);
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

        {/* Base yield */}
        <div className="glass-gold rounded-2xl p-3 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-xs">Base yield</span>
            <span className="text-amber-300 font-black text-lg">+{baseYield.toFixed(0)}G</span>
          </div>
        </div>

        {/* Deductions */}
        {hasDeductions && (
          <div className="glass rounded-2xl p-3 mb-3 flex flex-col gap-2">
            {plot.hasBugs && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-red-400 text-xs">
                  <Bug size={11} /> Bugs (−20%)
                </div>
                <span className="text-red-400 font-bold text-xs">−{(baseYield * 0.20).toFixed(0)}G</span>
              </div>
            )}
            {plot.hasWeeds && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-lime-400 text-xs">
                  <Leaf size={11} /> Weeds (−30%)
                </div>
                <span className="text-lime-400 font-bold text-xs">−{(baseYield * 0.30).toFixed(0)}G</span>
              </div>
            )}
            {plot.hasDrySoil && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-orange-400 text-xs">
                  <Droplet size={11} /> Dry soil (−15%)
                </div>
                <span className="text-orange-400 font-bold text-xs">−{(baseYield * 0.15).toFixed(0)}G</span>
              </div>
            )}
            {plot.totalStolen > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-red-400 text-xs">
                  <ShieldAlert size={11} /> Stolen ({stolenPct}%)
                </div>
                <span className="text-red-400 font-bold text-xs">−{plot.totalStolen.toFixed(0)}G</span>
              </div>
            )}
          </div>
        )}

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
