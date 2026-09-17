import { useState } from 'react';
import { X, Shovel, AlertTriangle } from 'lucide-react';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import { soundManager } from '@/sounds/SoundManager';
import { SEED_EMOJI } from '@/constants/seeds';

interface Props {
  plotId: string;
  plotIndex: number;
  cropName: string;
  isRipe?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConfirmDigModal({
  plotId,
  plotIndex,
  cropName,
  isRipe = false,
  onClose,
  onSuccess,
}: Props) {
  const [digging, setDigging] = useState(false);
  const [error, setError] = useState('');

  const emoji = SEED_EMOJI[cropName] ?? '🌱';

  const handleDig = async () => {
    if (digging) return;
    setDigging(true);
    setError('');
    try {
      eventBus.emit('dig-animation', { plotIndex });
      soundManager.play('click');
      await api.dig(plotId);
      eventBus.emit('show-toast', { message: `⛏️ Removed ${cropName}`, type: 'info' });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dig plot');
      setDigging(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-zinc-950/95 border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden mx-auto slide-up p-5 pb-8"
        style={{
          paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 24px)) + 30px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4 flex-shrink-0" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <Shovel size={18} />
            </div>
            <h2 className="text-white font-black text-lg">Clear Plot #{plotIndex + 1}</h2>
          </div>
          <button
            onClick={onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Warning card */}
        <div className="glass-red rounded-2xl p-4 mb-4 border border-red-500/30 bg-red-500/10 text-center">
          <div className="text-4xl mb-2">{emoji}</div>
          <div className="text-white font-black text-base mb-1">
            Remove {cropName}?
          </div>
          <p className="text-red-200/90 text-xs leading-relaxed max-w-sm mx-auto">
            {isRipe
              ? '⚠️ This crop is ripe and ready to harvest! Digging it up will permanently destroy it without receiving any yield or Gold.'
              : '⚠️ All growth progress and the planted seed will be permanently lost.'}
          </p>
        </div>

        {error && (
          <div className="glass rounded-xl p-2.5 mb-3 border border-red-500/30 bg-red-500/10 text-red-300 text-xs text-center flex items-center justify-center gap-1.5">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl glass font-bold text-sm text-white/80 hover:text-white active:scale-95 transition-all"
          >
            Keep Crop
          </button>
          <button
            type="button"
            onClick={handleDig}
            disabled={digging}
            className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm shadow-lg shadow-red-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Shovel size={16} />
            {digging ? 'Clearing...' : 'Yes, Dig Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
