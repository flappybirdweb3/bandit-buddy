import { useState } from 'react';
import { X, Zap, Loader2, Gift, Star, ExternalLink } from 'lucide-react';
import { useGame } from '@/providers/GameProvider';

interface Props { onClose: () => void }

// Dog tier info (mirrors BanditDogFusion.sol weights)
const DOG_TIERS = [
  { tokenId: 1, name: 'Chihuahua',  defense: 10,  rarity: 'Common',    emoji: '🐶', color: 'text-gray-300',   bg: 'bg-gray-500/15',   border: 'border-gray-400/25', weight: '60%'  },
  { tokenId: 2, name: 'Corgi',      defense: 20,  rarity: 'Common',    emoji: '🐕', color: 'text-green-300',  bg: 'bg-green-500/15',  border: 'border-green-400/25', weight: '24%' },
  { tokenId: 3, name: 'Husky',      defense: 35,  rarity: 'Rare',      emoji: '🐺', color: 'text-blue-300',   bg: 'bg-blue-500/15',   border: 'border-blue-400/25', weight: '10%'  },
  { tokenId: 4, name: 'Rottweiler', defense: 50,  rarity: 'Epic',      emoji: '🦮', color: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-400/25', weight: '4%' },
  { tokenId: 5, name: 'Doberman',   defense: 65,  rarity: 'Legendary', emoji: '🐩', color: 'text-amber-300',  bg: 'bg-amber-500/15',  border: 'border-amber-400/25', weight: '1.5%' },
  { tokenId: 6, name: 'Pitbull',    defense: 80,  rarity: 'Mythic',    emoji: '💪', color: 'text-red-300',    bg: 'bg-red-500/15',    border: 'border-red-400/25', weight: '0.5%'  },
] as const;

const PULL_COST_FARM = 50;

export function GachaModal({ onClose }: Props) {
  const { profile } = useGame();
  const [phase, setPhase] = useState<'idle' | 'committing' | 'waiting' | 'revealing' | 'result'>('idle');
  const [pityCount, setPityCount] = useState(0);
  type DogTier = typeof DOG_TIERS[number];
  const [revealedTier, setRevealedTier] = useState<DogTier | null>(null);

  const hasWallet = !!profile?.walletAddress;

  // Simulate commit-reveal flow (actual on-chain in production)
  const handlePull = async () => {
    if (!hasWallet) return;
    setPhase('committing');
    await new Promise((r) => setTimeout(r, 1200));
    setPhase('waiting');
    await new Promise((r) => setTimeout(r, 1800));
    setPhase('revealing');

    // Client-side tier simulation (real: contract reveal)
    const roll = Math.random() * 100;
    let tierIdx = 0;
    if (roll < 0.5)     tierIdx = 5;
    else if (roll < 2)  tierIdx = 4;
    else if (roll < 6)  tierIdx = 3;
    else if (roll < 16) tierIdx = 2;
    else if (roll < 40) tierIdx = 1;
    // Pity override
    const newPity = pityCount + 1;
    if (newPity >= 10 && tierIdx < 2) tierIdx = 2;
    const tier: DogTier = { ...DOG_TIERS[tierIdx] };
    setPityCount(tier.tokenId >= 3 ? 0 : newPity);

    await new Promise((r) => setTimeout(r, 800));
    setRevealedTier(tier);
    setPhase('result');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gift size={18} className="text-violet-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Guard Dog Gacha</h2>
              <p className="text-white/40 text-xs">{PULL_COST_FARM} $FARM per pull • Pity at 10 pulls</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Pity tracker */}
        <div className="glass rounded-2xl p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-amber-400" />
            <span className="text-white/60 text-xs font-bold">Pity Counter</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-sm ${i < pityCount ? 'bg-amber-400' : 'bg-white/10'}`}
                />
              ))}
            </div>
            <span className="text-white/40 text-[10px]">{pityCount}/10</span>
          </div>
        </div>

        {/* Pull area */}
        {phase === 'idle' && !revealedTier && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 mb-5 flex flex-col items-center gap-4">
            <div className="text-6xl">🎲</div>
            <p className="text-white/40 text-sm text-center leading-relaxed">
              Each pull costs <span className="text-amber-300 font-bold">{PULL_COST_FARM} $FARM</span><br/>
              Guaranteed Rare (Husky+) every 10 pulls
            </p>
          </div>
        )}

        {(phase === 'committing' || phase === 'waiting' || phase === 'revealing') && (
          <div className="rounded-3xl border border-violet-400/30 bg-violet-500/10 p-8 mb-5 flex flex-col items-center gap-4">
            <Loader2 size={48} className="text-violet-400 animate-spin" />
            <p className="text-violet-300 text-sm font-bold">
              {phase === 'committing' ? '🔒 Committing to blockchain…' :
               phase === 'waiting'    ? '⏳ Waiting for confirmation…' :
                                        '✨ Revealing your dog…'}
            </p>
          </div>
        )}

        {phase === 'result' && revealedTier && (
          <div className={`rounded-3xl border p-8 mb-5 flex flex-col items-center gap-3 ${revealedTier.bg} ${revealedTier.border}`}>
            <div className="text-7xl animate-bounce">{revealedTier.emoji}</div>
            <div className="text-center">
              <p className={`text-xl font-black ${revealedTier.color}`}>{revealedTier.name}</p>
              <p className="text-white/40 text-xs mt-1">{revealedTier.rarity} • -{revealedTier.defense}% steal chance</p>
            </div>
          </div>
        )}

        {/* Odds table */}
        <div className="glass rounded-2xl p-3 mb-5">
          <p className="text-white/40 text-[10px] font-bold mb-2 text-center">PULL RATES</p>
          <div className="grid grid-cols-3 gap-1.5">
            {DOG_TIERS.map((d) => (
              <div key={d.tokenId} className={`rounded-xl p-2 text-center ${d.bg}`}>
                <p className="text-lg">{d.emoji}</p>
                <p className={`text-[9px] font-bold ${d.color}`}>{d.rarity}</p>
                <p className="text-white/30 text-[8px]">{d.weight}</p>
              </div>
            ))}
          </div>
        </div>

        {!hasWallet && (
          <p className="text-amber-400/80 text-xs text-center mb-3">
            Link a BSC wallet in Settings to pull
          </p>
        )}

        {phase === 'result' ? (
          <div className="flex gap-2">
            <button
              onClick={() => { setPhase('idle'); setRevealedTier(null); }}
              className="flex-1 py-4 rounded-2xl text-sm font-black active:scale-95 transition-all flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff' }}
            >
              <Gift size={14} /> Pull Again
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl glass text-white/60 font-bold text-sm active:scale-95"
            >
              Close
            </button>
          </div>
        ) : (
          <button
            disabled={!hasWallet || phase !== 'idle'}
            onClick={handlePull}
            className="w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{
              background: hasWallet && phase === 'idle'
                ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : undefined,
              color: '#fff',
              boxShadow: hasWallet && phase === 'idle' ? '0 0 20px rgba(124,58,237,0.4)' : undefined,
            }}
          >
            {phase !== 'idle'
              ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
              : <><Zap size={15} /> Pull ({PULL_COST_FARM} $FARM)</>
            }
          </button>
        )}

        <p className="text-white/20 text-[10px] text-center mt-3 leading-relaxed">
          Uses commit-reveal RNG on BSC • $FARM burned on pull
        </p>
      </div>
    </div>
  );
}
