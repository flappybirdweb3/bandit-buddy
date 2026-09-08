import { X, Clock, TrendingUp, Coins, ShieldAlert, Sprout } from 'lucide-react';
import { useGame } from '@/providers/GameProvider';
import { eventBus } from '@/game/EventBus';

interface Props { onClose: () => void }

const SEED_EMOJI: Record<string, string> = {
  wheat: '🌾', carrot: '🥕', corn: '🌽', tomato: '🍅', pumpkin: '🎃',
};

function fmtTime(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${(sec / 3600).toFixed(0)}h`;
}

export function ShopModal({ onClose }: Props) {
  const { seeds, profile } = useGame();
  const gold = profile?.goldBalance ?? 0;

  const handleSelect = (seedId: string, seedName: string) => {
    eventBus.emit('seed-preselected', { seedId, seedName });
    eventBus.emit('tool-changed', 'seed');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sprout size={18} className="text-green-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Seed Shop</h2>
              <p className="text-white/40 text-xs">Tap seed → then tap empty plot</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="glass-gold rounded-xl px-3 py-1.5 flex items-center gap-1.5">
              <Coins size={13} className="text-amber-400" />
              <span className="text-amber-300 font-bold text-sm">{gold.toFixed(0)}G</span>
            </div>
            <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Seed list — vertical cards for better readability */}
        <div className="flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {seeds.map((seed) => {
            const canAfford = gold >= seed.costGold;
            const roi = Math.round((seed.baseYield - seed.costGold) / seed.costGold * 100);
            const stealCap = (seed.baseYield * 0.2).toFixed(0);

            return (
              <button
                key={seed.id}
                disabled={!canAfford}
                onClick={() => handleSelect(seed.id, seed.name)}
                className={[
                  'flex items-center gap-4 rounded-2xl p-3.5 text-left transition-all active:scale-[0.98]',
                  canAfford
                    ? 'glass hover:bg-white/10 border border-white/10 hover:border-green-500/40'
                    : 'glass opacity-40 cursor-not-allowed',
                ].join(' ')}
              >
                {/* Emoji */}
                <span className="text-4xl flex-shrink-0">{SEED_EMOJI[seed.iconKey] ?? '🌿'}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-white font-black text-sm">{seed.name}</span>
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-400/15 border border-amber-400/30 rounded-full px-1.5 py-0.5">
                      +{roi}% ROI
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <Stat icon={<Coins size={10} className="text-amber-400" />} label={`${seed.costGold}G cost`} />
                    <Stat icon={<TrendingUp size={10} className="text-green-400" />} label={`${seed.baseYield}G yield`} />
                    <Stat icon={<Clock size={10} className="text-blue-400" />} label={fmtTime(seed.growTimeSec)} />
                    <Stat icon={<ShieldAlert size={10} className="text-red-400" />} label={`${stealCap}G steal cap`} />
                  </div>
                </div>

                {/* CTA */}
                <div className={[
                  'flex-shrink-0 px-3 py-2 rounded-xl text-xs font-black',
                  canAfford
                    ? 'bg-green-500/25 text-green-300 border border-green-500/40'
                    : 'bg-red-500/20 text-red-400',
                ].join(' ')}>
                  {canAfford ? 'Select' : 'No gold'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {icon}
      <span className="text-white/50 text-[10px]">{label}</span>
    </div>
  );
}
