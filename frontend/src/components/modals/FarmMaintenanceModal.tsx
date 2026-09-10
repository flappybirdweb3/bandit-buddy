import { useState } from 'react';
import { X, Hammer, Shield, Home, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useGame } from '@/providers/GameProvider';

interface Props { onClose: () => void }

function DurabilityBar({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  const color = value > 60 ? 'bg-green-500' : value > 30 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = value > 60 ? 'text-green-400' : value > 30 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-white/70 text-sm font-bold">{label}</span>
        </div>
        <span className={`font-black text-sm ${textColor}`}>{value}%</span>
      </div>
      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      {value <= 30 && (
        <p className="text-red-400/80 text-[10px] mt-1.5">
          {value === 0
            ? label === 'Fence' ? '⚠️ Guard dogs are bypassed!' : '⚠️ Barn unprotected!'
            : '⚠️ Low — repair soon'}
        </p>
      )}
    </div>
  );
}

export function FarmMaintenanceModal({ onClose }: Props) {
  const { profile } = useGame();
  const queryClient = useQueryClient();
  const [repairAmt, setRepairAmt] = useState<Record<'fence' | 'barn', number>>({ fence: 30, barn: 30 });
  const [repairResult, setRepairResult] = useState<string | null>(null);

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
      setRepairResult(`✅ ${data.message} (spent ${data.goldSpent}G)`);
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => setRepairResult(`❌ ${err.message}`),
  });

  const costPer10 = building?.repairCostPer10Pct ?? 50;
  const gold = profile?.goldBalance ?? 0;

  function getCost(pct: number) { return Math.round((pct / 10) * costPer10); }
  function canAfford(pct: number) { return gold >= getCost(pct); }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Hammer size={18} className="text-amber-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Farm Maintenance</h2>
              <p className="text-white/40 text-xs">Repair fence & barn to protect your crops</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12 gap-2 text-white/40">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        )}

        {building && !isLoading && (
          <>
            <div className="flex flex-col gap-3 mb-5">
              <DurabilityBar
                value={building.fenceDurability}
                label="Fence"
                icon={<Shield size={15} className="text-blue-400" />}
              />
              <DurabilityBar
                value={building.barnDurability}
                label="Barn"
                icon={<Home size={15} className="text-amber-400" />}
              />
            </div>

            <p className="text-white/30 text-[10px] text-center mb-4">
              Durability decays ~14% per day • Fence at 0% = guard dogs bypassed
            </p>

            {(['fence', 'barn'] as const).map((target) => {
              const amt = repairAmt[target];
              const cost = getCost(amt);
              const busy = repairMutation.isPending;
              return (
                <div key={target} className="glass rounded-2xl p-4 mb-3">
                  <div className="flex items-center gap-2 mb-3">
                    {target === 'fence'
                      ? <Shield size={14} className="text-blue-400" />
                      : <Home size={14} className="text-amber-400" />}
                    <span className="text-white/70 text-sm font-bold capitalize">Repair {target}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {[10, 20, 30, 50].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setRepairAmt((prev) => ({ ...prev, [target]: pct }))}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          amt === pct ? 'bg-white/20 text-white' : 'glass text-white/40'
                        }`}
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={busy || !canAfford(amt)}
                    onClick={() => repairMutation.mutate({ target, amount: amt })}
                    className="w-full py-3 rounded-xl font-black text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{
                      background: canAfford(amt) ? 'linear-gradient(135deg, #d97706, #b45309)' : undefined,
                      color: '#fff',
                    }}
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />}
                    Repair {amt}% — {cost}G
                  </button>
                  {!canAfford(amt) && (
                    <p className="text-red-400/70 text-[10px] text-center mt-1">Need {cost}G (have {Math.floor(gold)}G)</p>
                  )}
                </div>
              );
            })}
          </>
        )}

        {repairResult && (
          <div className="mt-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/70 text-center">
            {repairResult}
          </div>
        )}
      </div>
    </div>
  );
}
