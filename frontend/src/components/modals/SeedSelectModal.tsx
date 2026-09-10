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

  // Auto-plant immediately when a seed was already selected
  useEffect(() => {
    if (!preSelectedSeedId) return;
    const seed = seeds.find((s) => s.id === preSelectedSeedId);
    const plotIndex = myFarm?.plots.findIndex((p) => p.id === plotId) ?? -1;
    plant.mutateAsync({ plotId, seedId: preSelectedSeedId })
      .then(() => {
        soundManager.play('plant');
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
    const seed = seeds.find((s) => s.id === seedId);
    const plotIndex = myFarm?.plots.findIndex((p) => p.id === plotId) ?? -1;
    await plant.mutateAsync({ plotId, seedId });
    soundManager.play('plant');
    if (seed) eventBus.emit('seed-preselected', { seedId: seed.id, seedName: seed.name });
    if (plotIndex >= 0) eventBus.emit('plant-animation', { plotIndex });
    onClose();
  };

  const handlePlantAll = async (seedId: string) => {
    const seed = seeds.find((s) => s.id === seedId);
    setPlantingAll(true);
    try {
      const res = await api.plantAll(seedId);
      soundManager.play('plant');
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
      setToast(err instanceof Error ? err.message : 'Plant failed');
      setTimeout(() => setToast(null), 2000);
      setPlantingAll(false);
    }
  };

  // Don't show UI while auto-planting
  if (preSelectedSeedId) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Sheet */}
        <div
          className="relative w-full max-w-md glass rounded-t-3xl slide-up p-4 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-black text-lg leading-none">Seed Shop</h2>
              <p className="text-white/50 text-xs mt-0.5">
                {emptyCount > 1 ? `${emptyCount} empty plots — tap Plant or Plant All` : 'Select a seed to plant'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="glass-gold rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                <Coins size={13} className="text-amber-400" />
                <span className="text-amber-300 font-bold text-sm">
                  {profile?.goldBalance.toFixed(0) ?? 0}
                </span>
              </div>
              <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Seed grid */}
          <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
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
                    'relative rounded-2xl p-3 flex flex-col gap-2',
                    locked ? 'glass opacity-40' : canAfford ? 'glass-green' : 'glass opacity-50',
                  ].join(' ')}
                >
                  {/* Badge: ROI or Level required */}
                  <div className={`absolute top-2 right-2 rounded-full px-1.5 py-0.5 ${
                    locked
                      ? 'bg-red-400/20 border border-red-400/30'
                      : 'bg-amber-400/20 border border-amber-400/30'
                  }`}>
                    <span className={`text-[9px] font-bold ${locked ? 'text-red-300' : 'text-amber-300'}`}>
                      {locked ? `Lv ${seed.levelRequired}` : `+${roi}%`}
                    </span>
                  </div>

                  {/* Icon + Name */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-3xl leading-none">{SEED_EMOJI[seed.iconKey] ?? '🌿'}</span>
                    {locked && <Lock size={12} className="text-white/50 flex-shrink-0" />}
                  </div>
                  <span className="text-white font-bold text-sm leading-tight">{seed.name}</span>

                  {/* Stats */}
                  <div className="flex flex-col gap-1">
                    <StatRow icon={<Coins size={10} className="text-amber-400" />} label={`${seed.costGold}G`} />
                    <StatRow icon={<Clock size={10} className="text-blue-400" />} label={fmtTime(seed.growTimeSec)} />
                    <StatRow icon={<TrendingUp size={10} className="text-green-400" />} label={`+${seed.baseYield}G`} />
                    <StatRow icon={<ShieldAlert size={10} className="text-red-400" />} label={`${maxSteal}G cap`} />
                  </div>

                  {/* Action buttons */}
                  {!locked && (
                    <div className={`grid gap-1.5 mt-1 ${canAffordAll ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <button
                        disabled={!canAfford || plant.isPending || plantingAll}
                        onClick={() => canAfford && handlePlant(seed.id)}
                        className={[
                          'py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95',
                          canAfford
                            ? 'bg-green-500/30 text-green-300 hover:bg-green-500/50'
                            : 'bg-red-500/20 text-red-400',
                        ].join(' ')}
                      >
                        {canAfford ? 'Plant' : 'Need Gold'}
                      </button>
                      {canAffordAll && (
                        <button
                          disabled={plant.isPending || plantingAll}
                          onClick={() => handlePlantAll(seed.id)}
                          className="py-1.5 rounded-xl text-xs font-bold bg-green-500 text-black hover:bg-green-400 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {plantingAll ? '…' : `All (${emptyCount})`}
                        </button>
                      )}
                    </div>
                  )}
                  {locked && (
                    <div className="mt-1 py-1.5 rounded-xl text-xs font-bold text-center text-white/30 bg-white/5">
                      Level {seed.levelRequired} required
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {plant.error && (
            <p className="text-red-400 text-xs text-center mt-3">{plant.error.message}</p>
          )}
        </div>
      </div>

      {toast && createPortal(
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] pointer-events-none">
          <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2 shadow-xl animate-fade-in-down">
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
    <div className="flex items-center gap-1">
      {icon}
      <span className="text-white/60 text-[10px]">{label}</span>
    </div>
  );
}
