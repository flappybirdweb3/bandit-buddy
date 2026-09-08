import { useEffect } from 'react';
import { X, Clock, TrendingUp, Coins, ShieldAlert } from 'lucide-react';
import { useGame } from '@/providers/GameProvider';
import { usePlant } from '@/hooks/usePlotActions';

interface Props {
  plotId: string;
  preSelectedSeedId?: string;
  onClose: () => void;
}

const SEED_EMOJI: Record<string, string> = {
  wheat: '🌾', carrot: '🥕', corn: '🌽', tomato: '🍅', pumpkin: '🎃',
};

function fmtTime(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

export function SeedSelectModal({ plotId, preSelectedSeedId, onClose }: Props) {
  const { seeds, profile } = useGame();
  const plant = usePlant();

  useEffect(() => {
    if (preSelectedSeedId) {
      plant.mutateAsync({ plotId, seedId: preSelectedSeedId }).then(onClose).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlant = async (seedId: string) => {
    await plant.mutateAsync({ plotId, seedId });
    onClose();
  };

  return (
    /* Backdrop */
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
            <p className="text-white/50 text-xs mt-0.5">Bandit Buddy Farm Store</p>
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
            const canAfford = (profile?.goldBalance ?? 0) >= seed.costGold;
            const roi = Math.round((seed.baseYield - seed.costGold) / seed.costGold * 100);
            const maxSteal = (seed.baseYield * 0.2).toFixed(0);

            return (
              <button
                key={seed.id}
                disabled={!canAfford || plant.isPending}
                onClick={() => canAfford && handlePlant(seed.id)}
                className={[
                  'relative rounded-2xl p-3 text-left transition-all active:scale-95 flex flex-col gap-2',
                  canAfford
                    ? 'glass-green hover:border-green-400/50'
                    : 'glass opacity-50',
                ].join(' ')}
              >
                {/* ROI badge */}
                <div className="absolute top-2 right-2 bg-amber-400/20 border border-amber-400/30 rounded-full px-1.5 py-0.5">
                  <span className="text-amber-300 text-[9px] font-bold">+{roi}%</span>
                </div>

                {/* Icon */}
                <span className="text-3xl">{SEED_EMOJI[seed.iconKey] ?? '🌿'}</span>

                {/* Name */}
                <span className="text-white font-bold text-sm leading-tight">{seed.name}</span>

                {/* Stats row */}
                <div className="flex flex-col gap-1">
                  <StatRow icon={<Coins size={10} className="text-amber-400" />}
                    label={`${seed.costGold}G`} />
                  <StatRow icon={<Clock size={10} className="text-blue-400" />}
                    label={fmtTime(seed.growTimeSec)} />
                  <StatRow icon={<TrendingUp size={10} className="text-green-400" />}
                    label={`+${seed.baseYield}G yield`} />
                  <StatRow icon={<ShieldAlert size={10} className="text-red-400" />}
                    label={`${maxSteal}G steal cap`} />
                </div>

                {/* Plant button */}
                <div className={[
                  'text-center py-1.5 rounded-xl text-xs font-bold mt-1',
                  canAfford
                    ? 'bg-green-500/30 text-green-300'
                    : 'bg-red-500/20 text-red-400',
                ].join(' ')}>
                  {canAfford ? 'Plant' : 'Need Gold'}
                </div>
              </button>
            );
          })}
        </div>

        {plant.error && (
          <p className="text-red-400 text-xs text-center mt-3">{plant.error.message}</p>
        )}
      </div>
    </div>
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
