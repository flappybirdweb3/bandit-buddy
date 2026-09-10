import { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { RaccoonMascot } from '@/components/mascot/RaccoonMascot';

export const TUTORIAL_KEY = 'bb_tutorial_done';

// ── Step definitions ──────────────────────────────────────────────
interface Step {
  emoji: string;
  title: string;
  body: string;
  hint?: string;           // small directional hint text
  cardPos: 'center' | 'top' | 'bottom';
  highlight?: 'hud' | 'farm' | 'tools' | 'neighbors';
  showMascot?: boolean;
  isFinal?: boolean;
}

const STEPS: Step[] = [
  {
    emoji: '🦝',
    title: 'Welcome to Bandit Buddy!',
    body: "You're a bandit farmer on BSC. Plant crops, steal from neighbors, and earn $FARM tokens.",
    cardPos: 'center',
    showMascot: true,
  },
  {
    emoji: '💰',
    title: 'GOLD & Energy',
    body: "Your GOLD balance and ⚡ energy live up here. GOLD is your currency. Energy limits steals — it regens 10 per hour.",
    cardPos: 'top',
    hint: '👆 tap here to see stats',
    highlight: 'hud',
  },
  {
    emoji: '🌱',
    title: 'Plant Your First Crop',
    body: "Select the 🌱 Seed tool, then tap any empty plot on your farm. Wheat matures in just 5 minutes!",
    cardPos: 'bottom',
    hint: '👆 your farm plots',
    highlight: 'farm',
  },
  {
    emoji: '🛠️',
    title: 'Farm Tools',
    body: "🌱 Seed = plant  ·  💧 Water = speed up  ·  ⛏️ Dig = remove  ·  🌿 Spray = boost yield  ·  🦝 Steal = raid neighbors",
    cardPos: 'bottom',
    hint: '👇 tool dock',
    highlight: 'tools',
  },
  {
    emoji: '🦝',
    title: 'Steal From Neighbors',
    body: "Open NEIGHBORS to find farms with ripe crops 🌾. Visit their farm, switch to the Steal tool, and tap their plots to raid. Each hit steals 5% of their crop!",
    cardPos: 'bottom',
    hint: '👆 FriendsBar above',
    highlight: 'neighbors',
  },
  {
    emoji: '🏆',
    title: "You're Ready, Bandit!",
    body: "Farm daily, steal often, claim $FARM tokens on-chain, and climb the leaderboard. Good luck 🦝",
    cardPos: 'center',
    isFinal: true,
  },
];

// ── Highlight box ─────────────────────────────────────────────────
function HighlightBox({ area }: { area: NonNullable<Step['highlight']> }) {
  const base = 'fixed pointer-events-none rounded-2xl border-2 border-white/50 animate-pulse';
  const shadow = '0 0 0 3px rgba(255,255,255,0.08), 0 0 24px rgba(255,255,255,0.15)';

  if (area === 'hud') return (
    <div className={base} style={{ top: 8, left: 8, right: 8, height: 60, boxShadow: shadow }} />
  );
  if (area === 'farm') return (
    <div className={base} style={{ top: '24%', left: 12, right: 12, height: '34vh', boxShadow: shadow }} />
  );
  if (area === 'tools') return (
    <div className={base} style={{ bottom: 106, left: '50%', transform: 'translateX(-50%)', width: 264, height: 58, borderRadius: 999, boxShadow: shadow }} />
  );
  if (area === 'neighbors') return (
    <div className={base} style={{ bottom: 168, left: 8, right: 8, height: 52, borderRadius: 999, boxShadow: shadow }} />
  );
  return null;
}

// ── Tutorial card ─────────────────────────────────────────────────
function TutorialCard({
  step, index, total, onNext, onSkip,
}: {
  step: Step;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const posStyle: React.CSSProperties =
    step.cardPos === 'top'    ? { top: 76, left: 16, right: 16 } :
    step.cardPos === 'bottom' ? { bottom: 170, left: 16, right: 16 } :
    { top: '50%', left: 16, right: 16, transform: 'translateY(-50%)' };

  return (
    <div
      className="fixed z-[350] glass rounded-3xl p-5 flex flex-col gap-4 slide-up"
      style={posStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute top-4 right-4 glass rounded-full p-1.5 text-white/30 hover:text-white/60 active:scale-90 transition-all"
      >
        <X size={14} />
      </button>

      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center pt-1">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
            i === index ? 'bg-amber-400 w-4' : i < index ? 'bg-white/40 w-1.5' : 'bg-white/15 w-1.5'
          }`} />
        ))}
      </div>

      {/* Mascot on welcome */}
      {step.showMascot && (
        <div className="flex justify-center -mb-2">
          <RaccoonMascot size={72} animate />
        </div>
      )}

      {/* Content */}
      <div className="flex items-start gap-3">
        {!step.showMascot && (
          <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-2xl flex-shrink-0">
            {step.emoji}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {step.showMascot && (
            <p className="text-white font-black text-base leading-tight text-center mb-1">{step.title}</p>
          )}
          {!step.showMascot && (
            <p className="text-white font-black text-sm leading-tight mb-1">{step.title}</p>
          )}
          <p className="text-white/55 text-xs leading-relaxed">{step.body}</p>
        </div>
      </div>

      {/* Hint */}
      {step.hint && (
        <p className="text-amber-300/70 text-[10px] font-semibold text-center -mt-1">{step.hint}</p>
      )}

      {/* CTA */}
      <button
        onClick={onNext}
        className={`w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all ${
          step.isFinal
            ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-black shadow-[0_0_20px_rgba(74,222,128,0.3)]'
            : 'bg-white/15 text-white hover:bg-white/20'
        }`}
      >
        {step.isFinal ? (
          <><span>🚀</span><span>Start Farming!</span></>
        ) : (
          <><span>Next</span><ChevronRight size={16} /></>
        )}
      </button>

      {/* Step counter */}
      <p className="text-white/20 text-[10px] text-center -mt-2">
        {index + 1} of {total}
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────
export function TutorialOverlay({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  const complete = () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    onDone();
  };

  const advance = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else complete();
  };

  return (
    <div className="fixed inset-0 z-[300]">
      {/* Backdrop — blocks game input during tutorial */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(1px)' }}
      />

      {/* Spotlight highlight */}
      {current.highlight && <HighlightBox area={current.highlight} />}

      {/* Tutorial card */}
      <TutorialCard
        step={current}
        index={step}
        total={STEPS.length}
        onNext={advance}
        onSkip={complete}
      />
    </div>
  );
}
