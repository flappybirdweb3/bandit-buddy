import { useState } from 'react';
import { X, Zap } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { soundManager } from '@/sounds/SoundManager';
import type { FarmPlot } from '@/types/game.types';

interface Props {
  plot: FarmPlot;
  targetUserId: string;
  targetUsername: string;
  onClose: () => void;
}

export function AttackModal({ plot, targetUserId, targetUsername, onClose }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const qc = useQueryClient();

  const attack = useMutation({
    mutationFn: (type: 'bugs' | 'weeds') => api.throwAttack(targetUserId, plot.id, type),
    onSuccess: (result) => {
      soundManager.play('attack');
      setToast(result.message);
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['friendFarm', targetUserId] });
      setTimeout(() => { setToast(null); onClose(); }, 1800);
    },
    onError: (err: Error) => {
      setToast(`❌ ${err.message}`);
      setTimeout(() => setToast(null), 2500);
    },
  });

  const seedName = plot.seed?.name ?? 'Crop';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-black text-lg leading-none">Attack Farm</h2>
            <p className="text-white/50 text-xs mt-0.5">
              🎯 @{targetUsername}'s <span className="text-amber-300">{seedName}</span>
            </p>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {toast && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold text-center ${
            toast.startsWith('❌')
              ? 'bg-red-500/20 border border-red-400/40 text-red-300'
              : 'bg-green-500/20 border border-green-400/40 text-green-300'
          }`}>
            {toast}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Bag of Bugs */}
          <button
            disabled={attack.isPending || plot.hasBugs}
            onClick={() => attack.mutate('bugs')}
            className={[
              'relative flex flex-col items-center gap-2 rounded-2xl p-4 transition-all active:scale-95',
              plot.hasBugs
                ? 'glass opacity-40 cursor-not-allowed'
                : 'glass hover:bg-white/10 border border-red-400/30 hover:border-red-400/60',
            ].join(' ')}
          >
            <span className="text-4xl leading-none">🐛</span>
            <div className="text-center">
              <p className="text-white font-black text-sm">Bag of Bugs</p>
              <p className="text-red-300 text-[10px] mt-0.5">−20% harvest yield</p>
            </div>
            <div className="flex items-center gap-1 mt-1 bg-amber-400/15 border border-amber-400/30 rounded-full px-2 py-0.5">
              <Zap size={9} className="text-amber-400" />
              <span className="text-amber-300 text-[10px] font-bold">15 energy</span>
            </div>
            {plot.hasBugs && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/20">
                <span className="text-xs text-white/60 font-bold">Already infested</span>
              </div>
            )}
          </button>

          {/* Bag of Weeds */}
          <button
            disabled={attack.isPending || plot.hasWeeds}
            onClick={() => attack.mutate('weeds')}
            className={[
              'relative flex flex-col items-center gap-2 rounded-2xl p-4 transition-all active:scale-95',
              plot.hasWeeds
                ? 'glass opacity-40 cursor-not-allowed'
                : 'glass hover:bg-white/10 border border-green-600/30 hover:border-green-500/60',
            ].join(' ')}
          >
            <span className="text-4xl leading-none">🌿</span>
            <div className="text-center">
              <p className="text-white font-black text-sm">Bag of Weeds</p>
              <p className="text-red-300 text-[10px] mt-0.5">−30% harvest yield</p>
            </div>
            <div className="flex items-center gap-1 mt-1 bg-amber-400/15 border border-amber-400/30 rounded-full px-2 py-0.5">
              <Zap size={9} className="text-amber-400" />
              <span className="text-amber-300 text-[10px] font-bold">15 energy</span>
            </div>
            {plot.hasWeeds && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/20">
                <span className="text-xs text-white/60 font-bold">Already infested</span>
              </div>
            )}
          </button>
        </div>

        <p className="text-white/25 text-[10px] text-center mt-4">
          Free to use · Costs energy · Victim can spray/weed-kill to remove
        </p>
      </div>
    </div>
  );
}
