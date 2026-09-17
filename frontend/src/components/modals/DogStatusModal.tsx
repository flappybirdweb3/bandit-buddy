import { useState } from 'react';
import { X, Shield, Clock, AlertTriangle, CheckCircle, Bone, ExternalLink } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useGame } from '@/providers/GameProvider';
import { soundManager } from '@/sounds/SoundManager';
import { eventBus } from '@/game/EventBus';

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

const BREED_DATA: Record<string, { name: string; emoji: string; desc: string }> = {
  Chihuahua: { name: 'Chihuahua', emoji: '🐕', desc: 'Feisty and loud alarm barker' },
  Corgi:     { name: 'Corgi', emoji: '🦊', desc: 'Fast ankles-biter and swift patrol' },
  Husky:     { name: 'Husky', emoji: '🐺', desc: 'Vigilant guard with piercing howl' },
  Rottweiler:{ name: 'Rottweiler', emoji: '🦮', desc: 'Heavyweight guardian with high bite force' },
  Doberman:  { name: 'Doberman', emoji: '🐾', desc: 'Stealthy protector with razor-sharp reflexes' },
  Pitbull:   { name: 'Pitbull', emoji: '💀', desc: 'Relentless defender against crop raiders' },
  dog_stray: { name: 'Stray Dog', emoji: '🐶', desc: 'Faithful companion rescued from the wild' },
  dog_beagle:{ name: 'Beagle', emoji: '🐕', desc: 'Keen scent tracker detecting thieves from afar' },
  dog_husky: { name: 'Husky', emoji: '🐺', desc: 'Vigilant guard with piercing howl' },
  dog_shepherd:{ name: 'Shepherd', emoji: '🦮', desc: 'Disciplined farm guard and herd protector' },
  elephant:  { name: 'Guard Elephant', emoji: '🐘', desc: 'Colossal mythical farm protector' },
  guard_pup: { name: 'Guard Pup', emoji: '🐕', desc: 'Young pup learning to guard the crops' },
  guard_hound:{ name: 'Guard Hound', emoji: '🐺', desc: 'Trained hound hunting night raiders' },
};

const FEED_COST_GOLD = 10;

interface Props {
  dogId?: string | null;
  dogType?: string | null;
  defense: number;
  lastFedAt?: string | null;
  isVisiting?: boolean;
  onClose: () => void;
}

export function DogStatusModal({
  dogId,
  dogType,
  defense,
  lastFedAt,
  isVisiting = false,
  onClose,
}: Props) {
  const { profile } = useGame();
  const queryClient = useQueryClient();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const breed = BREED_DATA[dogType ?? ''] ?? {
    name: dogType ?? 'Guard Dog',
    emoji: '🐕',
    desc: 'Faithful farm guardian on duty',
  };

  const fedTime = lastFedAt ? new Date(lastFedAt).getTime() : 0;
  const hoursSinceFed = fedTime > 0 ? (Date.now() - fedTime) / 3_600_000 : 999;
  const isWellFed = hoursSinceFed < 24;
  const isHungry = hoursSinceFed >= 24 && hoursSinceFed < 48;
  const isStarving = hoursSinceFed >= 48;

  const currentDefMultiplier = isStarving ? 0 : isHungry ? 0.5 : 1.0;
  const effectiveDefense = Math.floor(defense * currentDefMultiplier);

  const canAffordFeed = (profile?.goldBalance ?? 0) >= FEED_COST_GOLD;

  const handleClose = () => {
    soundManager.play('click');
    triggerHaptic('light');
    onClose();
  };

  const feedMutation = useMutation({
    mutationFn: async () => {
      if (!dogId) throw new Error('Guard dog ID not found');
      return api.feedDog(dogId);
    },
    onSuccess: (data) => {
      soundManager.play('dog_bark');
      soundManager.play('coin');
      triggerHaptic('success');
      setToastMsg(`🍖 ${data.message} (-${FEED_COST_GOLD}G)`);
      queryClient.invalidateQueries({ queryKey: ['myFarm'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['barnData'] });
      setTimeout(() => {
        setToastMsg(null);
        onClose();
      }, 1800);
    },
    onError: (err: Error) => {
      soundManager.play('error');
      triggerHaptic('error');
      setToastMsg(`❌ ${err.message || 'Feeding failed'}`);
      setTimeout(() => setToastMsg(null), 3000);
    },
  });

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-zinc-950/95 border-t border-white/10 rounded-t-3xl mx-auto p-5 shadow-2xl flex flex-col slide-up"
        style={{
          maxHeight: 'min(90vh, 750px)',
          paddingBottom: 'max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{breed.emoji}</span>
            <div>
              <h2 className="text-white font-black text-base leading-tight">
                {isVisiting ? "Neighbor's Guard Dog" : 'Farm Guard Dog'}
              </h2>
              <p className="text-white/50 text-xs">{breed.name} • On Guard Duty</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Main Dog Card */}
        <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 my-2">
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-3xl shrink-0 shadow-inner">
              {breed.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-base truncate">{breed.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {effectiveDefense}% DEF
                </span>
              </div>
              <p className="text-white/50 text-xs mt-0.5 leading-snug">{breed.desc}</p>
            </div>
          </div>

          {/* Defense Power Meter */}
          <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60 flex items-center gap-1">
                <Shield size={13} className="text-amber-400" />
                Theft Defense Power
              </span>
              <span className="text-amber-300 font-black text-sm">
                {effectiveDefense}%
                {currentDefMultiplier < 1 && (
                  <span className="text-red-400 text-[11px] font-semibold ml-1">
                    ({currentDefMultiplier * 100}%)
                  </span>
                )}
              </span>
            </div>
            <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isStarving
                    ? 'bg-red-500'
                    : isHungry
                    ? 'bg-amber-400'
                    : 'bg-gradient-to-r from-green-400 to-emerald-500'
                }`}
                style={{ width: `${Math.min(100, effectiveDefense)}%` }}
              />
            </div>
          </div>

          {/* Hunger Status Badge */}
          {!isVisiting && (
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-white/50 flex items-center gap-1">
                <Clock size={12} className="text-white/40" />
                Hunger Status:
              </span>
              {isWellFed ? (
                <span className="text-green-400 font-bold flex items-center gap-1">
                  <CheckCircle size={13} />
                  Well Fed (Next meal in {Math.max(1, Math.ceil(24 - hoursSinceFed))}h)
                </span>
              ) : isHungry ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <AlertTriangle size={13} />
                  Hungry (-50% Defense Penalty)
                </span>
              ) : (
                <span className="text-red-400 font-bold flex items-center gap-1">
                  <AlertTriangle size={13} />
                  Starving (0% Defense — Feed now!)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Informational tip */}
        <div className="bg-white/5 rounded-xl p-3 text-white/50 text-[11px] leading-relaxed mb-3">
          {isVisiting ? (
            <p>
              🛡️ This dog guards against crop raiders. If a theft attempt is caught, the raider loses energy and gold paid directly to the owner!
            </p>
          ) : (
            <p>
              🍖 Dogs require food every 24 hours to stay at 100% defense capability. An unfed dog loses 50% power, and after 48h falls asleep (0% DEF)!
            </p>
          )}
        </div>

        {/* Toast / status message */}
        {toastMsg && (
          <div className="text-center text-xs font-bold py-2 mb-2 rounded-xl bg-zinc-900 border border-white/10 text-amber-300 animate-pulse">
            {toastMsg}
          </div>
        )}

        {/* Action Buttons */}
        {!isVisiting ? (
          <div className="flex flex-col gap-2">
            {(isHungry || isStarving) && dogId ? (
              <button
                onClick={() => feedMutation.mutate()}
                disabled={feedMutation.isPending || !canAffordFeed}
                className={[
                  'w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 shadow-lg transition-all',
                  canAffordFeed && !feedMutation.isPending
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-amber-500/20'
                    : 'bg-white/10 text-white/30 cursor-not-allowed',
                ].join(' ')}
              >
                <Bone size={16} />
                <span>
                  {feedMutation.isPending
                    ? 'Feeding Dog...'
                    : `Feed Dog (${FEED_COST_GOLD} Gold)`}
                </span>
              </button>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  handleClose();
                  eventBus.emit('show-storage');
                }}
                className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all border border-white/10"
              >
                <ExternalLink size={14} />
                <span>Kennel in Storage</span>
              </button>

              <button
                onClick={handleClose}
                className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 font-bold text-xs active:scale-95 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm active:scale-95 transition-all border border-white/10"
          >
            Understood
          </button>
        )}
      </div>
    </div>
  );
}
