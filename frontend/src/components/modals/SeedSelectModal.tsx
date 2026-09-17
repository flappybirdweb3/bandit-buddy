import { useState, useEffect } from 'react';
import { SEED_EMOJI } from "@/constants/seeds";
import { createPortal } from 'react-dom';
import { X, Clock, TrendingUp, Coins, ShieldAlert, Lock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGame } from '@/providers/GameProvider';
import { usePlant } from '@/hooks/usePlotActions';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import { soundManager } from '@/sounds/SoundManager';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') {
  try {
    const haptic = window.Telegram?.WebApp?.HapticFeedback;
    if (!haptic) return;
    if (type === 'success' || type === 'warning' || type === 'error') {
      haptic.notificationOccurred(type);
    } else {
      haptic.impactOccurred(type);
    }
  } catch {
    // Ignore unsupported environments
  }
}

interface Props {
  plotId: string;
  preSelectedSeedId?: string;
  onClose: () => void;
}

function fmtTime(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

export function SeedSelectModal({ plotId, preSelectedSeedId, onClose }: Props) {
  const { seeds, profile, myFarm } = useGame();
  const plant = usePlant();
  const qc = useQueryClient();
  const [plantingAll, setPlantingAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const emptyCount = myFarm?.plots.filter((p) => p.isEmpty).length ?? 0;
  const currentPlot = myFarm?.plots.find((p) => p.id === plotId);
  const currentFertility = currentPlot?.soilFertility ?? 100;
  const isSoilExhausted = currentFertility <= 0;

  const handleClose = () => {
    soundManager.play('click');
    triggerHaptic('light');
    onClose();
  };

  // Auto-plant immediately when a seed was already selected (only if soil is not exhausted)
  useEffect(() => {
    if (!preSelectedSeedId) return;
    const plot = myFarm?.plots.find((p) => p.id === plotId);
    if ((plot?.soilFertility ?? 100) <= 0) {
      eventBus.emit('seed-cleared');
      return; // Do NOT auto-plant on exhausted soil; show the modal with the warning instead
    }
    const seed = seeds.find((s) => s.id === preSelectedSeedId);
    const plotIndex = myFarm?.plots.findIndex((p) => p.id === plotId) ?? -1;
    plant.mutateAsync({ plotId, seedId: preSelectedSeedId })
      .then(() => {
        soundManager.play('plant');
        triggerHaptic('medium');
        if (seed) eventBus.emit('seed-preselected', { seedId: seed.id, seedName: seed.name });
        if (plotIndex >= 0) eventBus.emit('plant-animation', { plotIndex });
        onClose();
      })
      .catch(() => {
        eventBus.emit('seed-cleared');
        onClose();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlant = async (seedId: string) => {
    if (isSoilExhausted) {
      triggerHaptic('warning');
      setToast('🌱 Soil exhausted! Buy Basic Compost from the Shop to restore fertility.');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const seed = seeds.find((s) => s.id === seedId);
    const plotIndex = myFarm?.plots.findIndex((p) => p.id === plotId) ?? -1;
    await plant.mutateAsync({ plotId, seedId });
    soundManager.play('plant');
    triggerHaptic('medium');
    if (seed) eventBus.emit('seed-preselected', { seedId: seed.id, seedName: seed.name });
    if (plotIndex >= 0) eventBus.emit('plant-animation', { plotIndex });
    onClose();
  };

  const handlePlantAll = async (seedId: string) => {
    const seed = seeds.find((s) => s.id === seedId);
    setPlantingAll(true);
    triggerHaptic('medium');
    try {
      const res = await api.plantAll(seedId);
      soundManager.play('plant');
      triggerHaptic('success');
      if (seed) eventBus.emit('seed-preselected', { seedId: seed.id, seedName: seed.name });
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['dailyQuests'] });
      const emoji = SEED_EMOJI[seed?.iconKey ?? ''] ?? '🌿';
      const msg = res.skipped > 0
        ? `${emoji} Planted ${res.planted} (${res.skipped} skipped — low gold)`
        : `${emoji} Planted ${res.planted} ${seed?.name} for ${res.totalCost}G!`;
      setToast(msg);
      setTimeout(() => { setToast(null); onClose(); }, 1800);
    } catch (err) {
      triggerHaptic('error');
      setToast(err instanceof Error ? err.message : 'Plant failed');
      setTimeout(() => setToast(null), 2000);
      setPlantingAll(false);
    }
  };

  // Don't show UI while auto-planting
  if (preSelectedSeedId) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex flex-col justify-end"
        onClick={handleClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        <div
          className="relative w-full max-w-xl bg-zinc-950/95 border-t border-white/10 rounded-t-3xl mx-auto p-5 shadow-2xl flex flex-col slide-up"
          style={{
            maxHeight: 'min(90vh, 800px)',
            paddingBottom: 'max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)))',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 shrink-0">
            <div>
              <h2 className="text-white font-black text-lg leading-tight">Seed Shop</h2>
              <p className="text-white/50 text-xs mt-0.5">
                {emptyCount > 1 ? `${emptyCount} empty plots — tap Plant or Plant All` : 'Select a crop to plant on this plot'}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                <Coins size={13} className="text-amber-400" />
                <span className="text-amber-300 font-bold text-sm">
                  {profile?.goldBalance.toFixed(0) ?? 0}
                </span>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/60 hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Soil Exhausted Warning Banner */}
          {isSoilExhausted && (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-3.5 flex flex-col gap-2 mb-3 shrink-0">
              <div className="flex items-start gap-2.5">
                <span className="text-2xl shrink-0">☠️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-amber-300 font-bold text-xs leading-tight">Soil is Exhausted (0% Fertility)</p>
                  <p className="text-white/70 text-[11px] mt-0.5 leading-relaxed">
                    Plot #{((currentPlot?.plotIndex ?? 0) + 1)} has depleted soil. Plant growth is blocked until soil fertility is restored.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  eventBus.emit('show-shop', { tab: 'boost' });
                }}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-xs hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg"
              >
                <span>🌱 Buy Compost in Shop (30G)</span>
              </button>
            </div>
          )}

          {/* Seed grid */}
          <div className="grid grid-cols-2 gap-2.5 overflow-y-auto pr-1 max-h-[50vh] sm:max-h-80">
            {seeds.map((seed) => {
              const playerLevel  = Math.floor((profile?.trustScore ?? 0) / 10);
              const locked       = playerLevel < (seed.levelRequired ?? 0);
              const canAfford    = !locked && (profile?.goldBalance ?? 0) >= seed.costGold;
              const canAffordAll = emptyCount > 1 && canAfford;
              const roi          = Math.round((seed.baseYield - seed.costGold) / seed.costGold * 100);
              const maxSteal     = (seed.baseYield * 0.2).toFixed(0);

              return (
                <div
                  key={seed.id}
                  className={[
                    'relative rounded-2xl p-3 flex flex-col gap-2 transition-all border',
                    locked
                      ? 'bg-zinc-900/30 border-white/5 opacity-40'
                      : seed.isSeasonal
                      ? 'border-purple-500/40 bg-purple-950/20 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                      : canAfford
                      ? 'bg-zinc-900/80 border-green-500/20 shadow-sm'
                      : 'bg-zinc-900/40 border-white/5 opacity-60',
                  ].join(' ')}
                >
                  {/* Badges: Seasonal Tag + ROI or Level required */}
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    {seed.isSeasonal && (
                      <span className="rounded-full px-1.5 py-0.5 bg-purple-500/30 border border-purple-400/50 text-[8px] font-black text-purple-200 uppercase tracking-wider">
                        🍁 Seasonal
                      </span>
                    )}
                    <div className={`rounded-full px-1.5 py-0.5 ${
                      locked
                        ? 'bg-red-400/20 border border-red-400/30'
                        : 'bg-amber-400/20 border border-amber-400/30'
                    }`}>
                      <span className={`text-[9px] font-bold ${locked ? 'text-red-300' : 'text-amber-300'}`}>
                        {locked ? `Lv ${seed.levelRequired}` : `+${roi}%`}
                      </span>
                    </div>
                  </div>

                  {/* Icon + Name */}
                  <div className="flex items-center gap-2">
                    <span className="text-3xl leading-none">{SEED_EMOJI[seed.iconKey] ?? '🌿'}</span>
                    {locked && <Lock size={12} className="text-white/50 shrink-0" />}
                  </div>
                  <span className="text-white font-bold text-sm leading-tight">{seed.name}</span>

                  {/* Stats */}
                  <div className="flex flex-col gap-1 bg-black/20 rounded-xl p-1.5">
                    <StatRow icon={<Coins size={10} className="text-amber-400" />} label={`${seed.costGold}G`} />
                    <StatRow icon={<Clock size={10} className="text-blue-400" />} label={fmtTime(seed.growTimeSec)} />
                    <StatRow icon={<TrendingUp size={10} className="text-green-400" />} label={`+${seed.baseYield}G`} />
                    <StatRow icon={<ShieldAlert size={10} className="text-red-400" />} label={`${maxSteal}G cap`} />
                  </div>

                  {/* Action buttons */}
                  {!locked && (
                    <div className={`grid gap-1.5 mt-auto ${canAffordAll && !isSoilExhausted ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <button
                        disabled={!canAfford || plant.isPending || plantingAll || isSoilExhausted}
                        onClick={() => canAfford && handlePlant(seed.id)}
                        className={[
                          'py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center',
                          isSoilExhausted
                            ? 'bg-amber-500/20 text-amber-300'
                            : canAfford
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-black font-black'
                            : 'bg-red-500/20 text-red-400',
                        ].join(' ')}
                      >
                        {isSoilExhausted ? 'Exhausted' : canAfford ? 'Plant' : 'Need Gold'}
                      </button>
                      {canAffordAll && !isSoilExhausted && (
                        <button
                          disabled={plant.isPending || plantingAll}
                          onClick={() => handlePlantAll(seed.id)}
                          className="py-2 rounded-xl text-xs font-black bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center border border-white/10"
                        >
                          {plantingAll ? '…' : `All (${emptyCount})`}
                        </button>
                      )}
                    </div>
                  )}
                  {locked && (
                    <div className="mt-auto py-2 rounded-xl text-xs font-bold text-center text-white/30 bg-white/5">
                      Level {seed.levelRequired} required
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {plant.error && (
            <p className="text-red-400 text-xs text-center mt-3 shrink-0">{plant.error.message}</p>
          )}
        </div>
      </div>

      {toast && createPortal(
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] pointer-events-none">
          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2 shadow-2xl animate-fade-in-down">
            <p className="text-white font-bold text-sm whitespace-nowrap">{toast}</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function StatRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-white/60 text-[10px]">{label}</span>
    </div>
  );
}
