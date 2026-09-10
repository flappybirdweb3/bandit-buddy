import { useState } from 'react';
import { X, TrendingUp, Coins, Star } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGame } from '@/providers/GameProvider';
import { api } from '@/api/client';
import { soundManager } from '@/sounds/SoundManager';
import type { FarmPlot } from '@/types/game.types';

const UPGRADE_COSTS = [200, 500, 1000, 2000];
const UPGRADE_MULTIPLIERS = [1.0, 1.5, 2.0, 3.0, 4.0];
const MAX_LEVEL = 5;

interface Props {
  plotId: string;
  plot: FarmPlot;
  onClose: () => void;
}

function LevelStars({ level, max = MAX_LEVEL }: { level: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={14}
          className={i < level ? 'text-amber-400 fill-amber-400' : 'text-white/20'}
        />
      ))}
    </div>
  );
}

function formatTime(ms: number) {
  if (ms <= 0) return 'Ready!';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function PlotUpgradeModal({ plotId, plot, onClose }: Props) {
  const { profile } = useGame();
  const queryClient = useQueryClient();
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ level: number; multiplier: number } | null>(null);

  const currentLevel = plot.level ?? 1;
  const isMaxLevel = currentLevel >= MAX_LEVEL;
  const cost = !isMaxLevel ? UPGRADE_COSTS[currentLevel - 1] : null;
  const nextMultiplier = !isMaxLevel ? UPGRADE_MULTIPLIERS[currentLevel] : null;
  const canAfford = cost !== null && (profile?.goldBalance ?? 0) >= cost;

  const remainingMs = plot.harvestableAt
    ? Math.max(0, new Date(plot.harvestableAt).getTime() - Date.now())
    : 0;

  const handleUpgrade = async () => {
    if (!canAfford || upgrading || isMaxLevel) return;
    setUpgrading(true);
    setError('');
    try {
      const res = await api.upgradePlot(plotId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['myFarm'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
      ]);
      soundManager.play('upgrade');
      setResult({ level: res.level, multiplier: res.multiplier });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upgrade failed');
      setUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-0" />

        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-white font-black text-base">Upgrade Plot</h2>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {result ? (
          <div className="px-5 pb-4 flex flex-col items-center gap-4 text-center">
            <div className="text-5xl">⭐</div>
            <div>
              <div className="text-white font-black text-lg">Plot Upgraded!</div>
              <div className="text-white/50 text-sm mt-1">Now at Level {result.level}</div>
            </div>
            <div className="glass rounded-2xl px-5 py-3 flex items-center gap-3">
              <LevelStars level={result.level} />
              <span className="text-green-400 font-bold text-sm">{result.multiplier}x yield</span>
            </div>
            <button onClick={onClose} className="w-full py-3 rounded-2xl bg-amber-500 text-black font-black text-base active:scale-95 transition-all">
              Nice!
            </button>
          </div>
        ) : (
          <div className="px-5 pb-4 flex flex-col gap-4">
            {/* Plot status */}
            {plot.seed && (
              <div className="glass rounded-2xl p-3 flex items-center gap-3">
                <div className="text-2xl">{plot.isRipe ? '🌾' : '🌱'}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm">{plot.seed.name}</div>
                  <div className="text-white/40 text-xs mt-0.5">
                    {plot.isRipe ? 'Ready to harvest!' : `Ready in ${formatTime(remainingMs)}`}
                  </div>
                </div>
              </div>
            )}

            {/* Level info */}
            <div className="glass rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Current Level</span>
                <LevelStars level={currentLevel} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Yield multiplier</span>
                <span className="text-white font-bold text-sm">{UPGRADE_MULTIPLIERS[currentLevel - 1]}x</span>
              </div>

              {!isMaxLevel && nextMultiplier !== null && (
                <>
                  <div className="h-px bg-white/10" />
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">After Upgrade</span>
                    <LevelStars level={currentLevel + 1} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-sm">New multiplier</span>
                    <span className="text-green-400 font-bold text-sm flex items-center gap-1">
                      <TrendingUp size={13} />
                      {nextMultiplier}x
                    </span>
                  </div>
                </>
              )}
            </div>

            {isMaxLevel ? (
              <div className="text-center text-amber-400 font-bold text-sm py-2">
                ⭐ Max Level Reached!
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <span className="text-white/40 text-xs">Upgrade cost</span>
                  <div className="flex items-center gap-1.5">
                    <Coins size={12} className="text-amber-400" />
                    <span className="text-amber-300 font-bold text-sm">{cost}G</span>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <span className="text-white/40 text-xs">Your balance</span>
                  <div className="flex items-center gap-1.5">
                    <Coins size={12} className="text-amber-400" />
                    <span className={`font-bold text-sm ${canAfford ? 'text-amber-300' : 'text-red-400'}`}>
                      {profile?.goldBalance.toFixed(0) ?? 0}G
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="text-red-400 text-xs text-center bg-red-500/10 rounded-xl px-3 py-2">{error}</div>
                )}

                <button
                  onClick={handleUpgrade}
                  disabled={!canAfford || upgrading}
                  className={[
                    'w-full py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95',
                    canAfford && !upgrading
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black'
                      : 'bg-white/10 text-white/30 cursor-not-allowed',
                  ].join(' ')}
                >
                  {upgrading ? (
                    <span className="animate-pulse">Upgrading...</span>
                  ) : (
                    <>
                      <Star size={18} className="fill-current" />
                      <span>Upgrade to Level {currentLevel + 1}</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
