import { useState } from 'react';
import { SEED_EMOJI } from "@/constants/seeds";
import { X, Hand, Coins, Zap, ShieldAlert, AlertTriangle, KeyRound, Bug, CloudRain } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSteal } from '@/hooks/usePlotActions';
import { useGame } from '@/providers/GameProvider';
import { eventBus } from '@/game/EventBus';
import { api } from '@/api/client';
import type { FarmPlot, StealResult } from '@/types/game.types';

interface Props {
  plot: FarmPlot;
  plotIndex: number;
  targetUserId: string;
  targetUsername: string;
  hasGuardDog: boolean;
  guardDogType: string | null;
  guardDogDefense?: number;
  isRevenge?: boolean;
  onClose: () => void;
  onSwitchToAttack?: () => void;
}

const PET_EMOJI: Record<string, string> = {
  // NFT breeds (actual dog_type values stored in DB)
  Chihuahua: '🐕', Corgi: '🦊', Husky: '🐺',
  Rottweiler: '🦮', Doberman: '🐾', Pitbull: '💀',
  // Legacy keys (backward compat)
  dog_stray: '🐶', dog_beagle: '🐕', dog_husky: '🐺',
  dog_shepherd: '🦮', elephant: '🐘',
  guard_pup: '🐕', guard_hound: '🐺',
};
const PET_NAME: Record<string, string> = {
  // NFT breeds
  Chihuahua: 'Chihuahua', Corgi: 'Corgi', Husky: 'Husky',
  Rottweiler: 'Rottweiler', Doberman: 'Doberman', Pitbull: 'Pitbull',
  // Legacy keys
  dog_stray: 'Stray Dog', dog_beagle: 'Beagle', dog_husky: 'Husky',
  dog_shepherd: 'German Shepherd', elephant: 'Elephant',
  guard_pup: 'Guard Pup', guard_hound: 'Guard Hound',
};

const WEATHER_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  steal_penalty: { emoji: '🌧️', label: 'Rain: −20% steal chance', color: 'text-blue-300' },
  festival:      { emoji: '🎉', label: 'Festival: stealing disabled', color: 'text-red-400' },
};

export function StealModal({
  plot,
  plotIndex,
  targetUserId,
  targetUsername,
  hasGuardDog,
  guardDogType,
  guardDogDefense = 0,
  isRevenge = false,
  onClose,
  onSwitchToAttack,
}: Props) {
  const steal = useSteal(plotIndex);
  const { profile } = useGame();
  const [result, setResult] = useState<StealResult | null>(null);
  const [useMasterKey, setUseMasterKey] = useState(false);

  // Master Key inventory check
  const { data: barnData } = useQuery({
    queryKey: ['barnData'],
    queryFn: api.getBarnInventory,
    staleTime: 15_000,
  });
  const masterKeyCount = barnData?.tools?.find((t) => t.itemType === 'master_key')?.available ?? 0;

  // Weather check
  const { data: weather } = useQuery({
    queryKey: ['weather'],
    queryFn: api.getWeather,
    staleTime: 5 * 60_000,
  });
  const weatherInfo = weather ? WEATHER_LABELS[weather.effect] : null;

  const handleSteal = async () => {
    const res = await steal.mutateAsync({
      targetUserId,
      plotId: plot.id,
      useMasterKey: useMasterKey && masterKeyCount > 0,
      isRevenge,
    });
    setResult(res);
    eventBus.emit('play-sound', res.success ? 'steal_win' : 'steal_fail');
  };

  const energy = profile?.energy ?? 0;
  const dailySteals = profile?.dailyStealCount ?? 0;
  const maxSteals = profile?.maxDailySteals ?? 5;
  const effectiveYield = plot.seed ? plot.seed.baseYield * (plot.multiplier ?? 1) : 0;
  const stealAmount = plot.seed
    ? Math.min(effectiveYield * 0.05, plot.stealableRemaining).toFixed(2)
    : '0';
  const effectiveDefense = (useMasterKey && masterKeyCount > 0) ? 0 : guardDogDefense;
  const successRate = Math.max(0, 75 - effectiveDefense);

  const emoji = plot.seed ? (SEED_EMOJI[plot.seed.iconKey] ?? '🌿') : '🌿';

  /* ── Result screen ── */
  if (result) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col justify-end px-7 py-2" style={{ paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 32px)) + 100px)' }} onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div
          className="relative w-full max-w-2xl glass mx-auto rounded-3xl overflow-hidden slide-up p-6 pb-10 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

          <div className="text-6xl mb-4">{result.success ? '💰' : '🐕'}</div>

          <h2 className={`font-black text-2xl mb-2 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
            {result.success ? 'Heist Success!' : 'Dog Bite!'}
          </h2>
          <p className="text-white/70 text-sm mb-6">{result.message}</p>

          <div className={`rounded-2xl py-4 mb-4 ${result.success ? 'glass-green' : 'glass-red'}`}>
            <div className={`font-black text-3xl ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              {result.goldChange >= 0 ? '+' : ''}{result.goldChange.toFixed(2)}
            </div>
            <div className="text-white/50 text-xs mt-1">GOLD</div>
          </div>

          {/* Insurance Reimbursement Receipt */}
          {result.insurancePayout != null && result.insurancePayout > 0 && (
            <div className="glass rounded-xl px-3 py-2 mb-3 flex items-center gap-2 justify-center border border-cyan-400/40 bg-cyan-500/10">
              <span className="text-cyan-300 text-xs font-bold">
                🛡️ Divine Aegis: Victim reimbursed +{result.insurancePayout.toFixed(2)} GOLD (80%)
              </span>
            </div>
          )}

          {/* UX-5: Show 24h protection info after successful steal */}
          {result.success && (
            <div className="glass rounded-xl px-3 py-2 mb-4 flex items-center gap-2 justify-center">
              <ShieldAlert size={12} className="text-blue-400" />
              <span className="text-white/50 text-[10px]">
                This farm is now protected for <span className="text-blue-300 font-bold">24 hours</span>
              </span>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full glass py-3.5 rounded-2xl text-white font-bold active:scale-95 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  /* ── Confirm screen ── */
  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end px-7 py-2" style={{ paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 32px)) + 100px)' }} onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl glass mx-auto rounded-3xl overflow-hidden slide-up p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Hand size={18} className="text-red-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Raid Farm</h2>
              <p className="text-white/40 text-xs">@{targetUsername}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* UX-2: Daily steal counter */}
            <div className="glass rounded-full px-2.5 py-1 flex items-center gap-1">
              <Hand size={10} className="text-red-400" />
              <span className={`text-[10px] font-bold ${dailySteals >= maxSteals ? 'text-red-400' : 'text-white/50'}`}>
                {dailySteals}/{maxSteals}
              </span>
            </div>
            <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* UX-4: Weather effect warning */}
        {weatherInfo && (
          <div className="glass rounded-xl px-3 py-2 mb-3 flex items-center gap-2 border border-white/10">
            <CloudRain size={12} className={weatherInfo.color} />
            <span className={`text-[10px] font-bold ${weatherInfo.color}`}>
              {weatherInfo.emoji} {weatherInfo.label}
            </span>
          </div>
        )}

        {/* UX-3: Revenge Raid Banner */}
        {isRevenge && (
          <div className="glass-red rounded-2xl p-3 mb-3 flex items-center justify-between border border-red-500/40 bg-red-500/15 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <div className="flex items-center gap-1.5 text-red-300 text-xs font-black">
              <span>⚔️ REVENGE RAID ACTIVE</span>
            </div>
            <span className="text-[10px] font-black text-red-300 bg-red-500/30 border border-red-400/40 px-2.5 py-0.5 rounded-full animate-pulse">
              35% CAP
            </span>
          </div>
        )}

        {/* Crop preview */}
        <div className="glass rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{emoji}</span>
            <div>
              <div className="text-white font-bold">{plot.seed?.name ?? 'Unknown'}</div>
              <div className="text-white/40 text-xs">Ripe & ready to steal</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCell icon={<Coins size={12} className="text-amber-400" />}
              label="You steal" value={`+${stealAmount}G`} positive />
            {/* UX-1: Show current energy with cost */}
            <StatCell icon={<Zap size={12} className="text-blue-400" />}
              label="Energy cost" value={`-10 ⚡`}
              subtitle={`You have ${energy} ⚡`}
              warning={energy < 10} />
            <StatCell icon={<Coins size={12} className="text-white/40" />}
              label="Steal pool left" value={`${plot.stealableRemaining.toFixed(1)}G`} />
            <StatCell icon={<ShieldAlert size={12} className={hasGuardDog && effectiveDefense > 0 ? 'text-amber-400' : 'text-green-400'} />}
              label="Success rate"
              value={`${successRate}%`}
              positive={effectiveDefense === 0} />
          </div>
        </div>

        {/* BUG-6: Master Key toggle (bypass guard dogs) */}
        {hasGuardDog && masterKeyCount > 0 && (
          <button
            onClick={() => setUseMasterKey(!useMasterKey)}
            className={`w-full rounded-2xl p-3 mb-3 flex items-center gap-2.5 border transition-all ${
              useMasterKey
                ? 'bg-amber-500/15 border-amber-400/40'
                : 'glass border-white/10 hover:border-amber-400/30'
            }`}
          >
            <KeyRound size={16} className={useMasterKey ? 'text-amber-400' : 'text-white/40'} />
            <div className="text-left flex-1">
              <p className={`text-xs font-bold ${useMasterKey ? 'text-amber-300' : 'text-white/60'}`}>
                Use Master Key
              </p>
              <p className="text-white/40 text-[10px]">
                Bypass guard dog · {masterKeyCount} key{masterKeyCount > 1 ? 's' : ''} left
              </p>
            </div>
            <div className={`w-8 h-5 rounded-full transition-colors flex items-center px-0.5 ${
              useMasterKey ? 'bg-amber-500 justify-end' : 'bg-white/15 justify-start'
            }`}>
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </div>
          </button>
        )}

        {/* Dog warning — dynamic based on target's actual dog */}
        {hasGuardDog && effectiveDefense > 0 ? (
          <div className="glass-red rounded-2xl p-3 mb-5 flex gap-2.5 items-start border border-amber-400/30 bg-amber-500/10">
            <span className="text-xl flex-shrink-0">{PET_EMOJI[guardDogType ?? ''] ?? '🐕'}</span>
            <div>
              <p className="text-amber-300 font-bold text-xs leading-tight mb-1">
                {PET_NAME[guardDogType ?? ''] ?? 'Guard Pet'} on duty!
              </p>
              {effectiveDefense >= 75 ? (
                <p className="text-red-400 text-[11px] font-bold">
                  🔒 This farm is fully protected by guard dogs — theft impossible!
                </p>
              ) : (
                <p className="text-white/60 text-[11px] leading-relaxed">
                  Success rate reduced to{' '}
                  <span className="text-amber-300 font-bold">{successRate}%</span>.
                  {' '}Failure costs{' '}
                  <span className="text-red-400 font-bold">20 ⚡</span> and{' '}
                  <span className="text-red-400 font-bold">5% of your GOLD</span>.
                </p>
              )}
            </div>
          </div>
        ) : hasGuardDog && useMasterKey ? (
          <div className="glass rounded-2xl p-3 mb-5 flex gap-2.5 items-start border border-amber-400/30 bg-amber-500/10">
            <KeyRound size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-300 text-xs leading-relaxed">
              🗝️ Master Key active — guard dog bypassed! <span className="text-green-400 font-bold">75% success.</span>
            </p>
          </div>
        ) : (
          <div className="glass-red rounded-2xl p-3 mb-5 flex gap-2.5 items-start">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-white/70 text-xs leading-relaxed">
              No guard dog detected — 75% success chance!
              Failure still costs <span className="text-red-400 font-bold">20 ⚡</span> and{' '}
              <span className="text-red-400 font-bold">5% of your GOLD</span>.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 glass py-3.5 rounded-2xl text-white/70 font-bold active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSteal}
            disabled={steal.isPending || energy < 10 || dailySteals >= maxSteals || (weather?.effect === 'festival') || effectiveDefense >= 75}
            className="flex-[2] bg-gradient-to-r from-red-600 to-rose-500 py-3.5 rounded-2xl text-white font-black active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 tool-steal-glow"
          >
            <Hand size={18} />
            {steal.isPending
              ? 'Sneaking…'
              : weather?.effect === 'festival'
              ? 'Festival Day'
              : energy < 10
              ? 'No Energy'
              : dailySteals >= maxSteals
              ? 'Limit Reached'
              : effectiveDefense >= 75
              ? 'Fully Guarded'
              : 'Steal Now!'}
          </button>
        </div>

        {/* BUG-5: Sabotage link — switch to AttackModal for ripe plots */}
        {onSwitchToAttack && (
          <button
            onClick={onSwitchToAttack}
            className="w-full text-center mt-3 text-white/30 text-[10px] hover:text-white/60 active:scale-95 transition-all flex items-center justify-center gap-1"
          >
            <Bug size={10} /> Sabotage this crop instead (throw bugs/weeds)
          </button>
        )}

        {steal.error && (
          <p className="text-red-400 text-xs text-center mt-3">{steal.error.message}</p>
        )}
      </div>
    </div>
  );
}

function StatCell({ icon, label, value, positive, subtitle, warning }: {
  icon: React.ReactNode; label: string; value: string; positive?: boolean; subtitle?: string; warning?: boolean;
}) {
  return (
    <div className="bg-white/5 rounded-xl px-3 py-2">
      <div className="flex items-center gap-1 mb-0.5">{icon}<span className="text-white/40 text-[10px]">{label}</span></div>
      <div className={`font-bold text-sm ${warning ? 'text-red-400' : positive ? 'text-green-400' : 'text-white'}`}>{value}</div>
      {subtitle && <div className={`text-[9px] mt-0.5 ${warning ? 'text-red-400/70' : 'text-white/25'}`}>{subtitle}</div>}
    </div>
  );
}
