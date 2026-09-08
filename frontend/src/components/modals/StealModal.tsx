import { useState } from 'react';
import { X, Hand, Coins, Zap, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useSteal } from '@/hooks/usePlotActions';
import type { FarmPlot, StealResult } from '@/types/game.types';

interface Props {
  plot: FarmPlot;
  plotIndex: number;
  targetUserId: string;
  targetUsername: string;
  onClose: () => void;
}

const SEED_EMOJI: Record<string, string> = {
  wheat: '🌾', carrot: '🥕', corn: '🌽', tomato: '🍅', pumpkin: '🎃',
};

export function StealModal({ plot, plotIndex, targetUserId, targetUsername, onClose }: Props) {
  const steal = useSteal(plotIndex);
  const [result, setResult] = useState<StealResult | null>(null);

  const handleSteal = async () => {
    const res = await steal.mutateAsync({ targetUserId, plotId: plot.id });
    setResult(res);
  };

  const stealAmount = plot.seed
    ? Math.min(plot.seed.baseYield * 0.05, plot.stealableRemaining).toFixed(2)
    : '0';

  const emoji = plot.seed ? (SEED_EMOJI[plot.seed.iconKey] ?? '🌿') : '🌿';

  /* ── Result screen ── */
  if (result) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div
          className="relative w-full max-w-md glass rounded-t-3xl slide-up p-6 pb-10 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

          <div className="text-6xl mb-4">{result.success ? '💰' : '🐕'}</div>

          <h2 className={`font-black text-2xl mb-2 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
            {result.success ? 'Heist Success!' : 'Dog Bite!'}
          </h2>
          <p className="text-white/70 text-sm mb-6">{result.message}</p>

          <div className={`rounded-2xl py-4 mb-6 ${result.success ? 'glass-green' : 'glass-red'}`}>
            <div className={`font-black text-3xl ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              {result.goldChange >= 0 ? '+' : ''}{result.goldChange.toFixed(2)}
            </div>
            <div className="text-white/50 text-xs mt-1">GOLD</div>
          </div>

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
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up p-5 pb-8"
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
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

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
            <StatCell icon={<Zap size={12} className="text-blue-400" />}
              label="Energy cost" value="-10 ⚡" />
            <StatCell icon={<Coins size={12} className="text-white/40" />}
              label="Steal pool left" value={`${plot.stealableRemaining.toFixed(1)}G`} />
            <StatCell icon={<ShieldAlert size={12} className="text-green-400" />}
              label="Base success" value="80%" positive />
          </div>
        </div>

        {/* Dog bite warning */}
        <div className="glass-red rounded-2xl p-3 mb-5 flex gap-2.5 items-start">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-white/70 text-xs leading-relaxed">
            Guard dog may bite! Failure costs{' '}
            <span className="text-red-400 font-bold">20 ⚡ energy</span> and{' '}
            <span className="text-red-400 font-bold">5% of your GOLD</span>.
            Dog defense reduces your success rate.
          </p>
        </div>

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
            disabled={steal.isPending}
            className="flex-[2] bg-gradient-to-r from-red-600 to-rose-500 py-3.5 rounded-2xl text-white font-black active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 tool-steal-glow"
          >
            <Hand size={18} />
            {steal.isPending ? 'Sneaking…' : 'Steal Now!'}
          </button>
        </div>

        {steal.error && (
          <p className="text-red-400 text-xs text-center mt-3">{steal.error.message}</p>
        )}
      </div>
    </div>
  );
}

function StatCell({ icon, label, value, positive }: {
  icon: React.ReactNode; label: string; value: string; positive?: boolean;
}) {
  return (
    <div className="bg-white/5 rounded-xl px-3 py-2">
      <div className="flex items-center gap-1 mb-0.5">{icon}<span className="text-white/40 text-[10px]">{label}</span></div>
      <div className={`font-bold text-sm ${positive ? 'text-green-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}
