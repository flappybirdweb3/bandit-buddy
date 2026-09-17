import { useState } from 'react';
import { X, TrendingUp, Coins, Star } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGame } from '@/providers/GameProvider';
import { api } from '@/api/client';
import { soundManager } from '@/sounds/SoundManager';
import type { FarmPlot } from '@/types/game.types';

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
    <div className="flex items-center gap-1">
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

  const handleClose = () => {
    soundManager.play('click');
    triggerHaptic('light');
    onClose();
  };

  const handleUpgrade = async () => {
    if (!canAfford || upgrading || isMaxLevel) return;
    setUpgrading(true);
    setError('');
    triggerHaptic('medium');
    try {
      const res = await api.upgradePlot(plotId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['myFarm'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
      ]);
      soundManager.play('upgrade');
      triggerHaptic('success');
      setResult({ level: res.level, multiplier: res.multiplier });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upgrade failed');
      soundManager.play('click');
      triggerHaptic('error');
      setUpgrading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-zinc-950/95 border-t border-white/10 rounded-t-3xl mx-auto p-5 shadow-2xl flex flex-col slide-up"
        style={{
          maxHeight: 'min(90vh, 780px)',
          paddingBottom: 'max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Upgrade Plot</h2>
              <p className="text-white/40 text-xs">Plot #{((plot.plotIndex ?? 0) + 1)} — Boost permanent crop yield</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {result ? (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="text-5xl animate-bounce">⭐</div>
            <div>
              <div className="text-white font-black text-xl">Plot Upgraded!</div>
              <div className="text-white/60 text-sm mt-1">Now at Level {result.level}</div>
            </div>
            <div className="bg-zinc-900/80 border border-amber-500/20 rounded-2xl px-5 py-3 flex items-center gap-3">
              <LevelStars level={result.level} />
              <span className="text-green-400 font-bold text-sm">+{result.multiplier}x Yield Multiplier</span>
            </div>
            <button
              onClick={handleClose}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-base active:scale-95 shadow-lg transition-all"
            >
              Awesome!
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-1">
            {/* Plot status */}
            {plot.seed && (
              <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="text-3xl shrink-0">{plot.isRipe ? '🌾' : '🌱'}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm">{plot.seed.name}</div>
                  <div className="text-white/50 text-xs mt-0.5">
                    {plot.isRipe ? 'Ready to harvest!' : `Ready in ${formatTime(remainingMs)}`}
                  </div>
                </div>
              </div>
            )}

            {/* Level info */}
            <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Current Level</span>
                <LevelStars level={currentLevel} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Yield Multiplier</span>
                <span className="text-amber-300 font-bold text-sm">{UPGRADE_MULTIPLIERS[currentLevel - 1]}x</span>
              </div>

              {!isMaxLevel && nextMultiplier !== null && (
                <>
                  <div className="h-px bg-white/10" />
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">After Upgrade</span>
                    <LevelStars level={currentLevel + 1} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-sm">New Multiplier</span>
                    <span className="text-green-400 font-bold text-sm flex items-center gap-1">
                      <TrendingUp size={14} />
                      {nextMultiplier}x (+{((nextMultiplier - UPGRADE_MULTIPLIERS[currentLevel - 1]) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </>
              )}
            </div>

            {isMaxLevel ? (
              <div className="text-center text-amber-400 font-bold text-sm py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                ⭐ Max Level Reached! (4.0x Yield)
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <span className="text-white/50 text-xs">Upgrade Cost</span>
                  <div className="flex items-center gap-1.5">
                    <Coins size={13} className="text-amber-400" />
                    <span className="text-amber-300 font-bold text-sm">{cost}G</span>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <span className="text-white/50 text-xs">Your Balance</span>
                  <div className="flex items-center gap-1.5">
                    <Coins size={13} className="text-amber-400" />
                    <span className={`font-bold text-sm ${canAfford ? 'text-amber-300' : 'text-red-400'}`}>
                      {profile?.goldBalance.toFixed(0) ?? 0}G
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleUpgrade}
                  disabled={!canAfford || upgrading}
                  className={[
                    'w-full py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg',
                    canAfford && !upgrading
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-amber-500/20'
                      : 'bg-white/10 text-white/30 cursor-not-allowed',
                  ].join(' ')}
                >
                  {upgrading ? (
                    <span className="animate-pulse">Upgrading...</span>
                  ) : (
                    <>
                      <Star size={18} className="fill-current text-amber-900" />
                      <span>Upgrade to Level {currentLevel + 1} ({cost}G)</span>
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
