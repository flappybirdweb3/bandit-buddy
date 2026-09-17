import { useState } from 'react';
import { X, Zap, CloudRain, Hand, HeartHandshake, Sparkles, Droplets, Bug, Flower2 } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useGame } from '@/providers/GameProvider';
import { soundManager } from '@/sounds/SoundManager';
import { SEED_EMOJI } from '@/constants/seeds';
import type { FarmPlot } from '@/types/game.types';

interface Props {
  plot: FarmPlot;
  targetUserId: string;
  targetUsername: string;
  onClose: () => void;
  onSwitchToSteal?: () => void;
}

const WEATHER_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  pest_damage: { emoji: '🐛', label: 'Pest Season: bugs deal extra damage', color: 'text-green-300' },
};

export function AttackModal({ plot, targetUserId, targetUsername, onClose, onSwitchToSteal }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const qc = useQueryClient();
  const { profile } = useGame();

  const energy = profile?.energy ?? 0;
  const ATTACK_COST = 15;
  const HELP_COST = 5;

  // Weather check
  const { data: weather } = useQuery({
    queryKey: ['weather'],
    queryFn: api.getWeather,
    staleTime: 5 * 60_000,
  });
  const weatherInfo = weather ? WEATHER_LABELS[weather.effect] : null;

  // Attack mutation (Sabotage)
  const attack = useMutation({
    mutationFn: (type: 'bugs' | 'weeds') => api.throwAttack(targetUserId, plot.id, type),
    onSuccess: (result) => {
      soundManager.play('attack');
      setToast(result.message);
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['friendFarm', targetUserId] });
      qc.invalidateQueries({ queryKey: ['dailyQuests'] });
      qc.invalidateQueries({ queryKey: ['achievements'] });
      setTimeout(() => { setToast(null); onClose(); }, 1800);
    },
    onError: (err: Error) => {
      setToast(`❌ ${err.message}`);
      setTimeout(() => setToast(null), 2500);
    },
  });

  // Help mutations (Rewarded social actions!)
  const helpAction = useMutation({
    mutationFn: async (action: 'spray' | 'weed' | 'water') => {
      if (action === 'spray') return api.bugSpray(plot.id);
      if (action === 'weed') return api.weedKill(plot.id);
      return api.water(plot.id);
    },
    onSuccess: (res: any) => {
      soundManager.play('coin');
      setToast(res.message ?? '🤝 You helped your neighbor!');
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['friendFarm', targetUserId] });
      qc.invalidateQueries({ queryKey: ['dailyQuests'] });
      qc.invalidateQueries({ queryKey: ['achievements'] });
      setTimeout(() => { setToast(null); onClose(); }, 1800);
    },
    onError: (err: Error) => {
      setToast(`❌ ${err.message}`);
      setTimeout(() => setToast(null), 2500);
    },
  });

  const seedName = plot.seed?.name ?? 'Crop';
  const seedEmoji = plot.seed ? (SEED_EMOJI[plot.seed.iconKey] ?? '🌱') : '🌱';
  const isBusy = attack.isPending || helpAction.isPending;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end px-7 py-2" style={{ paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 32px)) + 100px)' }} onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl glass mx-auto rounded-3xl overflow-hidden slide-up p-5 pb-8 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{seedEmoji}</span>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Crop Interaction</h2>
              <p className="text-white/50 text-xs">
                @{targetUsername}'s <span className="text-amber-300 font-bold">{seedName}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Energy bar */}
        <div className="glass rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap size={13} className={energy < HELP_COST ? 'text-red-400' : 'text-blue-400'} />
            <span className="text-[11px] font-bold text-white/80">Your Energy: {energy} ⚡</span>
          </div>
          <span className="text-white/40 text-[10px]">Costs 5⚡ (Help) / 15⚡ (Attack)</span>
        </div>

        {/* Weather alert if applicable */}
        {weatherInfo && (
          <div className="glass rounded-xl px-3 py-2 mb-3 flex items-center gap-2 border border-white/10">
            <CloudRain size={12} className={weatherInfo.color} />
            <span className={`text-[10px] font-bold ${weatherInfo.color}`}>
              {weatherInfo.emoji} {weatherInfo.label}
            </span>
          </div>
        )}

        {/* Toast feedback */}
        {toast && (
          <div className={`mb-3 px-3 py-2 rounded-xl text-xs font-bold text-center animate-bounce ${
            toast.startsWith('❌')
              ? 'bg-red-500/20 border border-red-400/40 text-red-300'
              : 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
          }`}>
            {toast}
          </div>
        )}

        {/* ── SECTION 1: HELP NEIGHBOR (REWARDED!) ── */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <HeartHandshake size={14} className="text-emerald-400" />
            <span className="text-emerald-400 text-xs font-black uppercase tracking-wider">Help Neighbor</span>
            <span className="text-white/30 text-[10px] ml-auto">Earn Gold & Trust!</span>
          </div>

          {(plot.hasBugs || plot.hasWeeds || !plot.wateredThisCycle || plot.hasDrySoil) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Help Kill Bugs */}
              {plot.hasBugs && (
                <button
                  disabled={isBusy || energy < HELP_COST}
                  onClick={() => helpAction.mutate('spray')}
                  className="glass rounded-2xl p-3 flex items-center gap-2.5 border border-emerald-400/30 hover:border-emerald-400 active:scale-95 transition-all text-left group"
                >
                  <span className="text-2xl">🧹</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-emerald-300 flex items-center gap-1">
                      Spray Bugs <Sparkles size={11} className="text-amber-400" />
                    </p>
                    <p className="text-[10px] text-white/50">−5⚡ · <span className="text-amber-300 font-bold">+15 Gold & +1 Trust</span></p>
                  </div>
                </button>
              )}

              {/* Help Pull Weeds */}
              {plot.hasWeeds && (
                <button
                  disabled={isBusy || energy < HELP_COST}
                  onClick={() => helpAction.mutate('weed')}
                  className="glass rounded-2xl p-3 flex items-center gap-2.5 border border-emerald-400/30 hover:border-emerald-400 active:scale-95 transition-all text-left group"
                >
                  <span className="text-2xl">🌾</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-emerald-300 flex items-center gap-1">
                      Pull Weeds <Sparkles size={11} className="text-amber-400" />
                    </p>
                    <p className="text-[10px] text-white/50">−5⚡ · <span className="text-amber-300 font-bold">+15 Gold & +1 Trust</span></p>
                  </div>
                </button>
              )}

              {/* Help Water Soil */}
              {(!plot.wateredThisCycle || plot.hasDrySoil) && (
                <button
                  disabled={isBusy || energy < HELP_COST}
                  onClick={() => helpAction.mutate('water')}
                  className="glass rounded-2xl p-3 flex items-center gap-2.5 border border-blue-400/30 hover:border-blue-400 active:scale-95 transition-all text-left group"
                >
                  <span className="text-2xl">💧</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-blue-300 flex items-center gap-1">
                      Water Crop <Sparkles size={11} className="text-amber-400" />
                    </p>
                    <p className="text-[10px] text-white/50">−5⚡ · <span className="text-amber-300 font-bold">+10 Gold & +1 Trust</span></p>
                  </div>
                </button>
              )}
            </div>
          ) : (
            <div className="glass rounded-2xl p-3 text-center border border-white/5">
              <p className="text-white/50 text-[11px]">✨ This crop is healthy and clean! Nothing to help with right now.</p>
            </div>
          )}
        </div>

        {/* ── SECTION 2: SABOTAGE (THE BANDIT WAY) ── */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <span className="text-xs">👿</span>
            <span className="text-red-400 text-xs font-black uppercase tracking-wider">Sabotage Crop</span>
            <span className="text-white/30 text-[10px] ml-auto">−15⚡ energy</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Bag of Bugs */}
            <button
              disabled={isBusy || plot.hasBugs || energy < ATTACK_COST}
              onClick={() => attack.mutate('bugs')}
              className={[
                'relative flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all active:scale-95 text-center',
                plot.hasBugs || energy < ATTACK_COST
                  ? 'glass opacity-40 cursor-not-allowed'
                  : 'glass hover:bg-white/10 border border-red-400/30 hover:border-red-400/60',
              ].join(' ')}
            >
              <span className="text-3xl leading-none">🐛</span>
              <div>
                <p className="text-white font-black text-xs">Throw Bugs</p>
                <p className="text-red-300 text-[10px] leading-tight">−20% yield</p>
              </div>
              <span className="text-[10px] text-amber-300 font-bold mt-0.5">15 ⚡</span>
              {plot.hasBugs && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-[1px]">
                  <span className="text-[10px] text-white/80 font-bold">Has Bugs</span>
                </div>
              )}
            </button>

            {/* Bag of Weeds */}
            <button
              disabled={isBusy || plot.hasWeeds || energy < ATTACK_COST}
              onClick={() => attack.mutate('weeds')}
              className={[
                'relative flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all active:scale-95 text-center',
                plot.hasWeeds || energy < ATTACK_COST
                  ? 'glass opacity-40 cursor-not-allowed'
                  : 'glass hover:bg-white/10 border border-emerald-600/30 hover:border-emerald-500/60',
              ].join(' ')}
            >
              <span className="text-3xl leading-none">🌿</span>
              <div>
                <p className="text-white font-black text-xs">Throw Weeds</p>
                <p className="text-red-300 text-[10px] leading-tight">−30% yield</p>
              </div>
              <span className="text-[10px] text-amber-300 font-bold mt-0.5">15 ⚡</span>
              {plot.hasWeeds && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-[1px]">
                  <span className="text-[10px] text-white/80 font-bold">Has Weeds</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Switch to Steal for ripe crops */}
        {plot.isRipe && plot.stealableRemaining > 0 && onSwitchToSteal && (
          <button
            onClick={onSwitchToSteal}
            className="w-full text-center mt-2 py-1 text-white/50 text-[11px] hover:text-white active:scale-95 transition-all flex items-center justify-center gap-1 font-bold"
          >
            <Hand size={12} className="text-red-400" /> This crop is ripe — <span className="text-red-400 underline">Steal it instead!</span>
          </button>
        )}
      </div>
    </div>
  );
}
