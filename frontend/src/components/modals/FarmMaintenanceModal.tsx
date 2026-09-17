import { useState } from 'react';
import { X, Hammer, Shield, Home, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useGame } from '@/providers/GameProvider';
import { soundManager } from '@/sounds/SoundManager';

interface Props { onClose: () => void }

function triggerSelection() {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  } catch {}
}

function triggerLight() {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
  } catch {}
}

function triggerImpact() {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('medium');
  } catch {}
}

function triggerSuccess() {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
  } catch {}
}

function triggerError() {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('error');
  } catch {}
}

function DurabilityBar({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  const color = value > 60 ? 'bg-green-500' : value > 30 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = value > 60 ? 'text-green-400' : value > 30 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="glass rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-white/80 text-sm font-bold">{label}</span>
        </div>
        <span className={`font-black text-sm ${textColor}`}>{value}%</span>
      </div>
      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      {value <= 30 && (
        <p className="text-red-400 text-[10px] mt-1.5 font-medium">
          {value === 0
            ? label === 'Fence' ? '⚠️ 0% — Guard dogs are completely bypassed!' : '⚠️ 0% — Barn unprotected!'
            : '⚠️ Durability low — repair recommended'}
        </p>
      )}
    </div>
  );
}

export function FarmMaintenanceModal({ onClose }: Props) {
  const { profile } = useGame();
  const queryClient = useQueryClient();
  const [repairAmt, setRepairAmt] = useState<Record<'fence' | 'barn', number>>({ fence: 30, barn: 30 });
  const [repairResult, setRepairResult] = useState<{ text: string; isError?: boolean } | null>(null);

  const handleClose = () => {
    triggerLight();
    soundManager.play('click');
    onClose();
  };

  const { data: building, isLoading } = useQuery({
    queryKey: ['buildings'],
    queryFn: api.getBuildingStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const repairMutation = useMutation({
    mutationFn: ({ target, amount }: { target: 'fence' | 'barn'; amount: number }) =>
      api.repairBuilding(target, amount),
    onSuccess: (data) => {
      triggerSuccess();
      soundManager.play('upgrade');
      setRepairResult({ text: `✅ ${data.message} (spent ${data.goldSpent}G)`, isError: false });
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => {
      triggerError();
      soundManager.play('error');
      setRepairResult({ text: `❌ ${err.message}`, isError: true });
    },
  });

  const costPer10 = building?.repairCostPer10Pct ?? 50;
  const gold = profile?.goldBalance ?? 0;

  function getCost(pct: number) { return Math.round((pct / 10) * costPer10); }
  function canAfford(pct: number) { return gold >= getCost(pct); }

  const isAlertNeeded = !!building && (building.fenceDurability < 30 || building.barnDurability < 30);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-zinc-950/95 backdrop-blur-2xl border-t border-white/10 mx-auto rounded-t-3xl overflow-hidden slide-up p-5 flex flex-col shadow-2xl"
        style={{
          maxHeight: 'min(90vh, 760px)',
          paddingBottom: 'max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)))'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-amber-400">
              <Hammer size={16} />
            </div>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Farm Maintenance</h2>
              <p className="text-white/40 text-xs">Repair fence & barn to protect your crops</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-white/40">
            <Loader2 size={18} className="animate-spin" /> Loading status…
          </div>
        )}

        {building && !isLoading && (
          <div className="overflow-y-auto flex-1 flex flex-col gap-3 pr-0.5">
            {/* Warning Banner */}
            {isAlertNeeded && (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-2.5 flex-shrink-0">
                <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-amber-300 font-bold">
                    {building.fenceDurability === 0
                      ? 'Fence Broken! Guard dogs bypassed completely!'
                      : building.fenceDurability < 30
                      ? 'Fence Durability Critical (< 30%)!'
                      : 'Barn Durability Low!'}
                  </p>
                  <p className="text-amber-200/70 mt-0.5 text-[11px] leading-relaxed">
                    {building.fenceDurability === 0
                      ? 'Thieves have 100% raid success until fence is repaired!'
                      : 'Raiders have increased success rates. Repair now to protect crops.'}
                  </p>
                </div>
              </div>
            )}

            {/* Durability Bars */}
            <div className="flex flex-col gap-2.5">
              <DurabilityBar
                value={building.fenceDurability}
                label="Fence Security"
                icon={<Shield size={15} className="text-blue-400" />}
              />
              <DurabilityBar
                value={building.barnDurability}
                label="Barn Storage"
                icon={<Home size={15} className="text-amber-400" />}
              />
            </div>

            <p className="text-white/35 text-[10px] text-center my-0.5">
              Durability decays ~14% per day • Fence at 0% = guard dogs bypassed
            </p>

            {/* Repair Controls */}
            {(['fence', 'barn'] as const).map((target) => {
              const amt = repairAmt[target];
              const cost = getCost(amt);
              const busy = repairMutation.isPending;
              const affordable = canAfford(amt);
              const currentVal = target === 'fence' ? building.fenceDurability : building.barnDurability;
              const isFull = currentVal >= 100;

              return (
                <div key={target} className="glass rounded-2xl p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {target === 'fence'
                        ? <Shield size={14} className="text-blue-400" />
                        : <Home size={14} className="text-amber-400" />}
                      <span className="text-white/80 text-sm font-bold capitalize">Repair {target}</span>
                    </div>
                    <span className="text-white/40 text-xs">
                      Current: <strong className="text-white/80">{currentVal}%</strong>
                    </span>
                  </div>

                  {!isFull ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        {[10, 20, 30, 50].map((pct) => (
                          <button
                            key={pct}
                            onClick={() => {
                              triggerSelection();
                              soundManager.play('click');
                              setRepairAmt((prev) => ({ ...prev, [target]: pct }));
                            }}
                            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                              amt === pct
                                ? 'bg-amber-500/25 border border-amber-400/40 text-amber-300'
                                : 'glass text-white/40 hover:text-white/70'
                            }`}
                          >
                            +{pct}%
                          </button>
                        ))}
                      </div>

                      <button
                        disabled={busy || !affordable}
                        onClick={() => {
                          triggerImpact();
                          repairMutation.mutate({ target, amount: amt });
                        }}
                        className="w-full py-2.5 rounded-xl font-black text-xs active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-md"
                        style={{
                          background: affordable ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(255,255,255,0.06)',
                          color: affordable ? '#fff' : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Hammer size={13} />}
                        Repair {amt}% • {cost}G
                      </button>

                      {!affordable && (
                        <p className="text-red-400/80 text-[10px] text-center">
                          Need {cost}G (you have {Math.floor(gold)}G)
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-green-400/80 bg-green-500/10 rounded-xl border border-green-500/20">
                      <Sparkles size={13} /> Fully Maintained (100%)
                    </div>
                  )}
                </div>
              );
            })}

            {repairResult && (
              <div
                className={`rounded-xl px-3 py-2 text-xs text-center border ${
                  repairResult.isError
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : 'bg-green-500/10 border-green-500/30 text-green-300'
                }`}
              >
                {repairResult.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
