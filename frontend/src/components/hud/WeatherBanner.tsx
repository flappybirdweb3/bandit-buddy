import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronRight } from 'lucide-react';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { WeatherEvent } from '@/types/game.types';

const EFFECT_LABELS: Record<string, string> = {
  harvest_gold_bonus: '+15% Gold',
  grow_speed_bonus:   '+25% Speed',
  gold_multiplier:    '×2 Gold',
  pest_damage:        '⚠️ Spray Crops',
  steal_penalty:      'Steals −20%',
  festival:           '+30% Gold',
};

const EFFECT_COLORS: Record<string, string> = {
  harvest_gold_bonus: 'text-amber-300 bg-amber-400/15 border-amber-400/30',
  grow_speed_bonus:   'text-blue-300 bg-blue-400/15 border-blue-400/30',
  gold_multiplier:    'text-yellow-300 bg-yellow-400/15 border-yellow-400/30',
  pest_damage:        'text-red-300 bg-red-400/15 border-red-400/30',
  steal_penalty:      'text-purple-300 bg-purple-400/15 border-purple-400/30',
  festival:           'text-green-300 bg-green-400/15 border-green-400/30',
};

const TIPS: Record<string, string[]> = {
  harvest_gold_bonus: [
    'Harvest all your crops today to maximize the gold bonus.',
    'Plant fast-growing crops to get more harvests in.',
  ],
  grow_speed_bonus: [
    'Plant long-growing crops like Corn, Tomato & Pumpkin for the biggest time save.',
    'Great day to plant everything you have seeds for.',
  ],
  gold_multiplier: [
    'Harvest and claim everything today — all rewards are doubled!',
    'Buy more seeds and plant as many plots as possible.',
  ],
  pest_damage: [
    'Use the Spray tool (🐛) on each plot to protect your crops.',
    'Unsprayed crops will lose 10% of their yield at harvest.',
  ],
  steal_penalty: [
    'Thieves struggle in the storm — your crops are safer today.',
    'Raiding other farms is less effective, consider farming instead.',
  ],
  festival: [
    'Stealing is disabled today — enjoy a theft-free harvest!',
    'Harvest as much as possible to gain the +30% gold bonus.',
  ],
};

function WeatherDetailSheet({ event, onClose }: { event: WeatherEvent; onClose: () => void }) {
  const effectColor = EFFECT_COLORS[event.effect] ?? 'text-white/60 bg-white/10 border-white/20';
  const tips = TIPS[event.effect] ?? [];

  const msLeft    = Math.max(0, new Date(event.expiresAt).getTime() - Date.now());
  const hoursLeft = Math.floor(msLeft / 3_600_000);
  const minsLeft  = Math.floor((msLeft % 3_600_000) / 60_000);

  return createPortal(
    <div className="fixed inset-0 z-[200] pointer-events-auto">
      {/* Backdrop — stop propagation so the click doesn't reach the Phaser canvas */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center">
        <div
          className="relative w-full max-w-md glass rounded-t-3xl slide-up"
          style={{ paddingBottom: 'max(180px, calc(180px + env(safe-area-inset-bottom)))' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{event.emoji}</span>
              <div>
                <h2 className="text-white font-black text-lg leading-tight">{event.name}</h2>
                <p className="text-white/40 text-xs">Daily Weather Event</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="glass rounded-full p-2 text-white/50 active:scale-90 transition-all"
            >
              <X size={15} />
            </button>
          </div>

          {/* Effect badge */}
          <div className="mx-5 mb-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-bold ${effectColor}`}>
              <span>{event.emoji}</span>
              <span>{EFFECT_LABELS[event.effect] ?? event.effect}</span>
            </div>
          </div>

          {/* Description */}
          <div className="mx-5 mb-4 glass rounded-2xl p-4">
            <p className="text-white/80 text-sm leading-relaxed">{event.description}</p>
          </div>

          {/* Tips */}
          {tips.length > 0 && (
            <div className="mx-5 mb-4">
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">Tips for today</p>
              <div className="space-y-2">
                {tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 glass rounded-xl px-3 py-2">
                    <span className="text-green-400 text-sm mt-0.5">→</span>
                    <p className="text-white/70 text-sm leading-snug">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timer */}
          <div className="mx-5 flex items-center justify-between glass rounded-2xl px-4 py-3">
            <div>
              <p className="text-white/30 text-[10px] uppercase tracking-widest">Resets in</p>
              <p className="text-white font-black text-lg">
                {hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/30 text-[10px] uppercase tracking-widest">Date</p>
              <p className="text-white/60 text-sm font-bold">{event.date}</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function WeatherBanner() {
  const [showDetail, setShowDetail] = useState(false);

  const { data: weather } = useQuery({
    queryKey: ['weather'],
    queryFn: api.getWeather,
    staleTime: 10 * 60_000,
    refetchInterval: 30 * 60_000,
  });

  useEffect(() => {
    if (showDetail) {
      eventBus.emit('ui-overlay', true);
      return;
    }
    // Delay re-enabling Phaser input to prevent touch bleedthrough
    const t = setTimeout(() => eventBus.emit('ui-overlay', false), 200);
    return () => clearTimeout(t);
  }, [showDetail]);

  if (!weather) return null;

  const effectColor = EFFECT_COLORS[weather.effect] ?? 'text-white/60 bg-white/10 border-white/20';
  const isPestDay   = weather.effect === 'pest_damage';

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className={[
          'relative flex items-center justify-center w-7 h-7 rounded-xl border transition-all active:scale-95 pointer-events-auto flex-shrink-0',
          isPestDay ? 'bg-red-400/20 border-red-400/40 animate-pulse' : effectColor,
        ].join(' ')}
        title={EFFECT_LABELS[weather.effect]}
      >
        <span className="text-base leading-none">{weather.emoji}</span>
        {isPestDay && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>

      {showDetail && (
        <WeatherDetailSheet event={weather} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}
