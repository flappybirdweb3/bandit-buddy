import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Sparkles, ShoppingBag } from 'lucide-react';
import { api } from '@/api/client';
import { useGame } from '@/providers/GameProvider';
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
  { key: 'normal',   label: 'Normal',   emoji: '🌿', timeLabel: '−1 hour',   reductionSec: 3600,  color: 'text-green-300',  bgColor: 'bg-green-950/40 border-green-700/40 hover:border-green-500/60' },
  { key: 'super',    label: 'Super',    emoji: '🚀', timeLabel: '−2.5 hours', reductionSec: 9000,  color: 'text-blue-300',   bgColor: 'bg-blue-950/40 border-blue-700/40 hover:border-blue-500/60' },
  { key: 'advanced', label: 'Advanced', emoji: '💎', timeLabel: '−5 hours',   reductionSec: 18000, color: 'text-purple-300', bgColor: 'bg-purple-950/40 border-purple-700/40 hover:border-purple-500/60' },
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

  const handleClose = () => {
    soundManager.play('click');
    triggerHaptic('light');
    onClose();
  };

  const mutation = useMutation({
    mutationFn: (tier: FertTier) => api.fertilize(plotId, tier),
    onSuccess: (res) => {
      soundManager.play('upgrade');
      triggerHaptic('success');
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      eventBus.emit('show-toast', { message: res.message, type: 'success' });
      onClose();
    },
    onError: (err: Error) => {
      soundManager.play('click');
      triggerHaptic('error');
      eventBus.emit('show-toast', { message: err.message, type: 'error' });
    },
  });

  const totalCharges = charges.normal + charges.super + charges.advanced;

  const handleOpenShop = () => {
    handleClose();
    eventBus.emit('show-shop', { tab: 'boost' });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-zinc-950/95 border-t border-white/10 rounded-t-3xl mx-auto p-5 shadow-2xl flex flex-col slide-up"
        style={{
          maxHeight: 'min(90vh, 720px)',
          paddingBottom: 'max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Apply Fertilizer</h2>
              <p className="text-white/50 text-xs">Plot #{plotIndex + 1} — Accelerate crop growth</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {totalCharges === 0 ? (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="text-4xl">🧪</div>
            <div>
              <p className="text-white font-bold text-sm">No Fertilizer Charges Available</p>
              <p className="text-white/40 text-xs mt-0.5">Stock up in the Shop to instantly speed up your crops</p>
            </div>
            <button
              onClick={handleOpenShop}
              className="mt-2 w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-sm flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-amber-500/20 transition-all"
            >
              <ShoppingBag size={16} />
              <span>Buy Fertilizer in Shop</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pt-1">
            {TIERS.map((tier) => {
              const qty = charges[tier.key];
              const disabled = qty === 0 || mutation.isPending;
              return (
                <button
                  key={tier.key}
                  disabled={disabled}
                  onClick={() => {
                    triggerHaptic('medium');
                    mutation.mutate(tier.key);
                  }}
                  className={[
                    'flex items-center gap-3 p-3.5 rounded-2xl border transition-all active:scale-95 text-left',
                    tier.bgColor,
                    disabled ? 'opacity-35 cursor-not-allowed' : 'shadow-md',
                  ].join(' ')}
                >
                  <span className="text-3xl shrink-0">{tier.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-black text-sm ${tier.color}`}>{tier.label} Fertilizer</div>
                    <div className="text-white/60 text-xs flex items-center gap-1 mt-0.5">
                      <Sparkles size={11} className="text-amber-400 shrink-0" />
                      <span>{tier.timeLabel} harvest time</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 bg-black/30 border border-white/5 rounded-xl px-2.5 py-1.5">
                    <div className={`font-black text-sm ${qty > 0 ? tier.color : 'text-white/30'}`}>
                      ×{qty}
                    </div>
                    <div className="text-white/40 text-[9px] uppercase tracking-wider font-semibold">
                      {qty === 1 ? 'charge' : 'charges'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-center gap-2 text-white/40 text-[11px] text-center">
          <span>⚡ Stackable per crop</span>
          <span>•</span>
          <span>🛡️ Weather pest protection</span>
        </div>
      </div>
    </div>
  );
}
