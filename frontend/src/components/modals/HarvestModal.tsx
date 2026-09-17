import { X, Wheat, ShieldAlert, Bug, Leaf, Droplet, Star, Sparkles } from 'lucide-react';
import { SEED_EMOJI } from "@/constants/seeds";
import { useHarvest } from '@/hooks/usePlotActions';
import { eventBus } from '@/game/EventBus';
import { soundManager } from '@/sounds/SoundManager';
import type { FarmPlot } from '@/types/game.types';

interface Props { plot: FarmPlot; plotIndex: number; onClose: () => void }

const UPGRADE_MULTIPLIERS = [1.0, 1.5, 2.0, 3.0, 4.0];

export function HarvestModal({ plot, plotIndex, onClose }: Props) {
  const harvest = useHarvest();

  const levelMult  = UPGRADE_MULTIPLIERS[(plot.level ?? 1) - 1] ?? 1.0;
  const soilMult   = (plot.soilFertility ?? 100) / 100;
  const rawBase    = plot.seed?.baseYield ?? 0;
  const baseYield  = rawBase * levelMult;

  let infestMult = 1.0;
  if (plot.hasBugs)  infestMult -= 0.20;
  if (plot.hasWeeds) infestMult -= 0.30;
  infestMult = Math.max(0, infestMult);

  const dryMult    = plot.hasDrySoil ? 0.85 : 1.0;
  const afterMod   = baseYield * soilMult * infestMult * dryMult;
  const netYield   = Math.max(0, afterMod - plot.totalStolen);

  const emoji      = plot.seed ? (SEED_EMOJI[plot.seed.iconKey] ?? '🌿') : '🌿';
  const stolenPct  = baseYield > 0 ? Math.round((plot.totalStolen / baseYield) * 100) : 0;
  const hasDeductions = plot.hasBugs || plot.hasWeeds || plot.hasDrySoil || plot.totalStolen > 0 || (plot.soilFertility ?? 100) < 100;

  const handleClose = () => {
    soundManager.play('click');
    try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
    onClose();
  };

  const handleHarvest = async () => {
    try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('medium'); } catch {}
    await harvest.mutateAsync(plot.id);
    soundManager.play('harvest');
    try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success'); } catch {}
    eventBus.emit('harvest-animation', { plotIndex, cropYield: netYield, gold: netYield });
    eventBus.emit('show-toast', {
      message: `🌾 +${Math.round(netYield)} crops moved to Storage! (Open Storage to sell for Gold)`,
      type: 'success',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-zinc-950/95 border-t border-white/10 mx-auto rounded-t-3xl overflow-hidden slide-up p-5 text-center flex flex-col shadow-2xl"
        style={{
          maxHeight: 'min(90vh, 780px)',
          paddingBottom: 'max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 flex-shrink-0" />

        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-left">
            <span className="text-2xl">{emoji}</span>
            <div>
              <h2 className="text-white font-black text-base leading-tight">{plot.seed?.name}</h2>
              <p className="text-white/40 text-xs">Plot #{plotIndex + 1} • Ready to Harvest!</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 flex flex-col gap-3 pr-0.5">
          {/* Base yield */}
          <div className="glass-gold rounded-2xl p-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <span className="text-white/60 text-xs font-semibold">Base Yield</span>
                {(plot.level ?? 1) > 1 && (
                  <span className="text-amber-400 text-[10px] font-bold block">
                    ★ Level {plot.level} ({levelMult}x Multiplier)
                  </span>
                )}
              </div>
              <span className="text-amber-300 font-black text-lg">+{baseYield.toFixed(0)} {plot.seed?.name}</span>
            </div>
          </div>

          {/* Deductions */}
          {hasDeductions && (
            <div className="glass rounded-2xl p-3 flex flex-col gap-2 flex-shrink-0">
              {(plot.soilFertility ?? 100) < 100 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                    <Sparkles size={11} /> Low Fertility ({plot.soilFertility}%)
                  </div>
                  <span className="text-amber-400 font-bold text-xs">{(soilMult * 100).toFixed(0)}% yield</span>
                </div>
              )}
              {plot.hasBugs && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-red-400 text-xs">
                    <Bug size={11} /> Pest Infestation (−20%)
                  </div>
                  <span className="text-red-400 font-bold text-xs">−{(baseYield * 0.20).toFixed(0)}</span>
                </div>
              )}
              {plot.hasWeeds && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-lime-400 text-xs">
                    <Leaf size={11} /> Weeds (−30%)
                  </div>
                  <span className="text-lime-400 font-bold text-xs">−{(baseYield * 0.30).toFixed(0)}</span>
                </div>
              )}
              {plot.hasDrySoil && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-orange-400 text-xs">
                    <Droplet size={11} /> Dry Soil (−15%)
                  </div>
                  <span className="text-orange-400 font-bold text-xs">−{(baseYield * 0.15).toFixed(0)}</span>
                </div>
              )}
              {plot.totalStolen > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-red-400 text-xs">
                    <ShieldAlert size={11} /> Stolen ({stolenPct}%)
                  </div>
                  <span className="text-red-400 font-bold text-xs">−{plot.totalStolen.toFixed(0)}</span>
                </div>
              )}
            </div>
          )}

          {/* Net yield highlight */}
          <div className="glass-green rounded-2xl py-3 px-4 flex flex-col gap-2 flex-shrink-0">
            <div className="flex items-center justify-center gap-3">
              <Wheat size={24} className="text-green-400" />
              <div className="text-left">
                <div className="text-green-400 font-black text-3xl leading-none">+{netYield.toFixed(0)}</div>
                <div className="text-green-300/80 text-[11px] font-bold">Harvested Crops</div>
              </div>
            </div>
            <div className="bg-black/30 rounded-xl px-3 py-2 text-white/70 text-xs flex items-center justify-between gap-2 text-left">
              <span>📦 Crops are moved to <b>Storage</b>. Sell for GOLD or pack Crates.</span>
              <button
                type="button"
                onClick={() => { onClose(); eventBus.emit('show-storage'); }}
                className="text-xs glass px-2.5 py-1.5 rounded-lg text-amber-300 font-bold whitespace-nowrap active:scale-95 flex-shrink-0"
              >
                Storage ➔
              </button>
            </div>
          </div>

          {plot.totalStolen > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-white/40 text-xs flex-shrink-0">
              <ShieldAlert size={12} className="text-red-400" />
              Thieves stole {plot.totalStolen.toFixed(0)} crops — keep a Guard Dog to defend!
            </div>
          )}

          <button
            onClick={handleHarvest}
            disabled={harvest.isPending}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-500 py-3 rounded-2xl text-white font-black text-sm active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-green-500/20 flex-shrink-0"
          >
            {harvest.isPending ? 'Harvesting…' : `Harvest (+${netYield.toFixed(0)} ${plot.seed?.name})`}
          </button>

          {harvest.error && (
            <p className="text-red-400 text-xs">{harvest.error.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
