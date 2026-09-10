import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/api/client';
import { useGame } from '@/providers/GameProvider';
import { eventBus } from '@/game/EventBus';
import { soundManager } from '@/sounds/SoundManager';

type FertTier = 'normal' | 'super' | 'advanced';

const TIERS: {
  key: FertTier;
  label: string;
  emoji: string;
  timeLabel: string;
  reductionSec: number;
  color: string;
  bgColor: string;
}[] = [
  { key: 'normal',   label: 'Normal',   emoji: '🌿', timeLabel: '−1 hour',   reductionSec: 3600,  color: 'text-green-300',  bgColor: 'bg-green-900/40 border-green-700/50' },
  { key: 'super',    label: 'Super',    emoji: '🚀', timeLabel: '−2.5 hours', reductionSec: 9000,  color: 'text-blue-300',   bgColor: 'bg-blue-900/40 border-blue-700/50' },
  { key: 'advanced', label: 'Advanced', emoji: '💎', timeLabel: '−5 hours',   reductionSec: 18000, color: 'text-purple-300', bgColor: 'bg-purple-900/40 border-purple-700/50' },
];

interface Props {
  plotId: string;
  plotIndex: number;
  onClose: () => void;
}

export function FertilizerModal({ plotId, plotIndex, onClose }: Props) {
  const { profile } = useGame();
  const qc = useQueryClient();

  const charges: Record<FertTier, number> = {
    normal:   profile?.normalFertCharges   ?? 0,
    super:    profile?.superFertCharges    ?? 0,
    advanced: profile?.advancedFertCharges ?? 0,
  };

  const mutation = useMutation({
    mutationFn: (tier: FertTier) => api.fertilize(plotId, tier),
    onSuccess: (res) => {
      soundManager.play('upgrade');
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      eventBus.emit('show-toast', { message: res.message, type: 'success' });
      onClose();
    },
    onError: (err: Error) => {
      eventBus.emit('show-toast', { message: err.message, type: 'error' });
    },
  });

  const totalCharges = charges.normal + charges.super + charges.advanced;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center pb-24 px-4" onClick={onClose}>
      <div
        className="glass rounded-2xl p-4 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-base">Choose Fertilizer</h2>
            <p className="text-white/50 text-xs">Plot #{plotIndex + 1} — reduces grow time</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {totalCharges === 0 ? (
          <div className="text-center py-6">
            <p className="text-white/40 text-sm mb-1">No fertilizer charges</p>
            <p className="text-white/30 text-xs">Buy from the Shop to boost crops</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {TIERS.map((tier) => {
              const qty = charges[tier.key];
              const disabled = qty === 0 || mutation.isPending;
              return (
                <button
                  key={tier.key}
                  disabled={disabled}
                  onClick={() => mutation.mutate(tier.key)}
                  className={[
                    'flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-95',
                    tier.bgColor,
                    disabled ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-110',
                  ].join(' ')}
                >
                  <span className="text-2xl">{tier.emoji}</span>
                  <div className="flex-1 text-left">
                    <div className={`font-bold text-sm ${tier.color}`}>{tier.label} Fertilizer</div>
                    <div className="text-white/50 text-xs">{tier.timeLabel} grow time</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black text-sm ${qty > 0 ? tier.color : 'text-white/30'}`}>
                      ×{qty}
                    </div>
                    <div className="text-white/30 text-[10px]">charges</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-white/30 text-[10px] text-center mt-3">
          Can apply multiple times per crop • also protects vs pest weather
        </p>
      </div>
    </div>
  );
}
