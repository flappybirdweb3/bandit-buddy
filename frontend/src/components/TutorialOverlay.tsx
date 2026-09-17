import { useState } from 'react';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { soundManager } from '@/sounds/SoundManager';

export const TUTORIAL_KEY = 'bb_tutorial_done';

// ── Step definitions ──────────────────────────────────────────────
interface Step {
  emoji: string;
  title: string;
  body: string;
  badge?: string;
  hint?: string;
  cardPos: 'center' | 'below-hud' | 'above-tools';
  highlight?: 'hud' | 'farm' | 'tools' | 'explore';
  showMascot?: boolean;
  isFinal?: boolean;
}

const STEPS: Step[] = [
  {
    emoji: '🦝',
    badge: 'Introduction',
    title: 'Welcome to Bandit Buddy!',
    body: "You are a Bandit Farmer on BNB Smart Chain. Plant crops, protect your farm, raid neighbors for gold, and harvest on-chain rewards!",
    cardPos: 'center',
    showMascot: true,
  },
  {
    emoji: '💰',
    badge: 'Resource Management',
    title: 'GOLD & Energy Bar',
    body: "Your GOLD balance and ⚡ Energy are tracked in the top HUD. Gold buys seeds, tools & plot expansions. Energy powers farm tasks and raids (regens +10/hr).",
    cardPos: 'below-hud',
    hint: 'Overview of your top status bar',
    highlight: 'hud',
  },
  {
    emoji: '🌱',
    badge: 'Farming Basics',
    title: 'Planting Your Crops',
    body: "Select the 🌱 Plant tool from your dock, then tap any empty soil plot to choose seeds. Your starter crop Turnip is ready to plant from Level 0!",
    cardPos: 'center',
    hint: 'Tap empty plots with Plant tool active',
    highlight: 'farm',
  },
  {
    emoji: '🛠️',
    badge: 'Farm Equipment',
    title: '7 Farming Dock Tools',
    body: "👆 Select (inspect) · ⛏️ Dig (clear) · 🌱 Plant (sow seeds) · 💧 Water (moisten dry soil) · 🐛 Bug Spray (cure pests) · ✂️ Weed Kill (pull weeds) · 🦝 Steal (raid crops).",
    cardPos: 'above-tools',
    hint: 'Bottom tool dock at your fingertips',
    highlight: 'tools',
  },
  {
    emoji: '🌐',
    badge: 'Social & Raiding',
    title: 'Explore & Raid Farms',
    body: "Tap 🌐 Explore to discover farms with ripe crops across the world, or check 👥 NEIGHBORS. Equip the 🦝 Steal tool and tap ripe plots to take up to 20% of their harvest!",
    cardPos: 'above-tools',
    hint: 'Explore feature & Neighbors bar',
    highlight: 'explore',
  },
  {
    emoji: '🏆',
    badge: 'Ready to Play',
    title: "You're Ready, Bandit!",
    body: "Tend your farm daily, complete quests, help allies for trust score, raid rivals, and claim $FARM tokens. Happy farming! 🦝",
    cardPos: 'center',
    isFinal: true,
  },
];

// ── Highlight box ─────────────────────────────────────────────────
function HighlightBox({ area }: { area: NonNullable<Step['highlight']> }) {
  const base = 'fixed pointer-events-none rounded-2xl border-2 border-amber-400/80 animate-pulse transition-all duration-300';
  const shadow = '0 0 0 4px rgba(251,191,36,0.2), 0 0 32px rgba(251,191,36,0.3)';

  if (area === 'hud') {
    return (
      <div
        className={base}
        style={{
          top: 'max(6px, var(--tg-safe-area-inset-top, env(safe-area-inset-top, 6px)))',
          left: 10,
          right: 10,
          height: 60,
          borderRadius: 20,
          boxShadow: shadow,
        }}
      />
    );
  }

  if (area === 'farm') {
    return (
      <div
        className={base}
        style={{
          top: 'calc(max(16px, var(--tg-safe-area-inset-top, env(safe-area-inset-top, 16px))) + 68px)',
          left: 12,
          right: 12,
          bottom: 'calc(max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px))) + 210px)',
          borderRadius: 24,
          boxShadow: shadow,
        }}
      />
    );
  }

  if (area === 'tools') {
    return (
      <div
        className={base}
        style={{
          bottom: 'max(8px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 8px)))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(350px, 94vw)',
          height: 52,
          borderRadius: 999,
          boxShadow: shadow,
        }}
      />
    );
  }

  if (area === 'explore') {
    return (
      <div
        className={base}
        style={{
          bottom: 'calc(max(12px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 12px))) + 52px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(380px, 95vw)',
          height: 82,
          borderRadius: 22,
          boxShadow: shadow,
        }}
      />
    );
  }

  return null;
}

// ── Tutorial card ─────────────────────────────────────────────────
function TutorialCard({
  step,
  index,
  total,
  onNext,
  onBack,
  onSkip,
  onJump,
}: {
  step: Step;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onJump: (i: number) => void;
}) {
  const getCardStyle = (): React.CSSProperties => {
    if (step.cardPos === 'below-hud') {
      return {
        top: 'calc(max(16px, var(--tg-safe-area-inset-top, env(safe-area-inset-top, 16px))) + 74px)',
        left: 16,
        right: 16,
        maxWidth: 420,
        margin: '0 auto',
      };
    }
    if (step.cardPos === 'above-tools') {
      return {
        bottom: 'calc(max(16px, var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px))) + 148px)',
        left: 16,
        right: 16,
        maxWidth: 420,
        margin: '0 auto',
      };
    }
    return {
      top: '50%',
      left: 16,
      right: 16,
      maxWidth: 420,
      margin: '0 auto',
      transform: 'translateY(-50%)',
    };
  };

  return (
    <div
      className="fixed z-[350] rounded-3xl p-5 flex flex-col gap-3.5 shadow-2xl transition-all duration-300"
      style={{
        ...getCardStyle(),
        background: 'rgba(18, 26, 20, 0.94)',
        backdropFilter: 'blur(24px)',
        border: '1.5px solid rgba(74, 222, 128, 0.35)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 24px rgba(74,222,128,0.15)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top row: badge + progress dots + skip button */}
      <div className="flex items-center justify-between gap-2">
        {step.badge ? (
          <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
            {step.badge}
          </span>
        ) : <div />}

        {/* Interactive Progress dots */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index
                  ? 'bg-amber-400 w-5'
                  : i < index
                  ? 'bg-white/40 w-1.5 hover:bg-white/60'
                  : 'bg-white/15 w-1.5 hover:bg-white/30'
              }`}
              title={`Jump to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Skip button */}
        <button
          onClick={onSkip}
          className="rounded-full p-1.5 text-white/40 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
          title="Skip tutorial"
        >
          <X size={15} />
        </button>
      </div>

      {/* Mascot banner on welcome / final */}
      {step.showMascot && (
        <div className="flex justify-center my-1">
          <div className="w-20 h-20 rounded-full overflow-hidden relative flex-shrink-0 bg-radial from-green-500/20 to-black/70 border-2 border-green-400/40 shadow-lg animate-[bb-bob_2.5s_ease-in-out_infinite]">
            <img
              src="/mascot.png"
              alt="Bandit Mascot"
              className="w-28 max-w-none absolute left-1/2 -top-1 -translate-x-1/2 select-none pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* Content section */}
      <div className="flex items-start gap-3 mt-0.5">
        {!step.showMascot && (
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-2xl flex-shrink-0 shadow-inner">
            {step.emoji}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-white font-black text-base leading-tight mb-1.5 ${step.showMascot ? 'text-center' : ''}`}>
            {step.title}
          </p>
          <p className="text-white/70 text-xs leading-relaxed">
            {step.body}
          </p>
        </div>
      </div>

      {/* Hint info */}
      {step.hint && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-1.5 flex items-center justify-center gap-1.5">
          <span className="text-amber-300 text-[11px] font-semibold text-center">
            {step.hint}
          </span>
        </div>
      )}

      {/* Action CTA Buttons (Back + Next) */}
      <div className="flex items-center gap-2 pt-1">
        {index > 0 && (
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-white/80 active:scale-95 transition-all border border-white/10"
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>
        )}

        <button
          onClick={onNext}
          className={`py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all ${
            index > 0 ? 'flex-[2]' : 'w-full'
          } ${
            step.isFinal
              ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-black shadow-[0_0_24px_rgba(74,222,128,0.4)]'
              : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:brightness-110 shadow-[0_4px_16px_rgba(16,185,129,0.3)]'
          }`}
        >
          {step.isFinal ? (
            <>
              <span>🚀</span>
              <span>Start Farming!</span>
            </>
          ) : (
            <>
              <span>Next</span>
              <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>

      {/* Step counter */}
      <p className="text-white/30 text-[10px] text-center font-medium">
        Step {index + 1} of {total}
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────
export function TutorialOverlay({
  onDone,
  storageKey,
}: {
  onDone: () => void;
  storageKey?: string;
}) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  const triggerHaptic = (style: 'selection' | 'success') => {
    try {
      const haptic = (window as any).Telegram?.WebApp?.HapticFeedback;
      if (style === 'selection') {
        haptic?.selectionChanged?.();
      } else {
        haptic?.notificationOccurred?.('success');
      }
    } catch {}
  };

  const complete = () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    if (storageKey) {
      localStorage.setItem(storageKey, '1');
    }
    triggerHaptic('success');
    soundManager.play('level_up');
    onDone();
  };

  const advance = () => {
    triggerHaptic('selection');
    soundManager.play('click');
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      complete();
    }
  };

  const goBack = () => {
    triggerHaptic('selection');
    soundManager.play('click');
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const jumpTo = (target: number) => {
    triggerHaptic('selection');
    soundManager.play('click');
    setStep(Math.max(0, Math.min(STEPS.length - 1, target)));
  };

  return (
    <div className="fixed inset-0 z-[300]">
      {/* Backdrop — blocks game input during tutorial */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: 'rgba(0, 0, 0, 0.68)', backdropFilter: 'blur(1.5px)' }}
      />

      {/* Spotlight highlight box */}
      {current.highlight && <HighlightBox area={current.highlight} />}

      {/* Tutorial card */}
      <TutorialCard
        step={current}
        index={step}
        total={STEPS.length}
        onNext={advance}
        onBack={goBack}
        onSkip={complete}
        onJump={jumpTo}
      />
    </div>
  );
}
