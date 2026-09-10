import { Coins, Zap, LayoutGrid, ChevronRight, Loader2 } from 'lucide-react';
import { useGame } from '@/providers/GameProvider';
import { RaccoonMascot } from '@/components/mascot/RaccoonMascot';

interface Props {
  onEnter: () => void;
}

export function WelcomeScreen({ onEnter }: Props) {
  const { profile, isLoading } = useGame();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3"
        style={{ background: 'linear-gradient(160deg, #0d2b0d 0%, #1a3a1a 40%, #1e3a5f 100%)' }}>
        <div className="relative">
          <RaccoonMascot size={110} className="drop-shadow-2xl" animate />
          {/* Floating coins */}
          <span className="absolute -top-2 -right-3 text-2xl animate-bounce" style={{ animationDelay: '0s' }}>💰</span>
          <span className="absolute top-4 -left-4 text-xl animate-bounce" style={{ animationDelay: '0.3s' }}>🪙</span>
        </div>
        <BanditBuddyLogo size="sm" />
        <div className="flex items-center gap-2 mt-1">
          <Loader2 className="text-green-400 animate-spin" size={18} />
          <p className="text-white/50 text-sm">Loading your farm…</p>
        </div>
      </div>
    );
  }

  const initial = ((profile?.username ?? '?')[0]).toUpperCase();

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(160deg, #0a1f0a 0%, #1a3a1a 35%, #1e3a5f 75%, #0d1a2e 100%)' }} />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle, #4ade80 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {/* Glow behind mascot */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #22c55e, transparent 70%)' }} />

      {/* Floating decorations */}
      <div className="absolute top-[6%]  left-[8%]  text-3xl opacity-25 animate-bounce select-none" style={{ animationDelay: '0.1s' }}>🌾</div>
      <div className="absolute top-[10%] right-[9%] text-2xl opacity-20 animate-bounce select-none" style={{ animationDelay: '0.5s' }}>🪙</div>
      <div className="absolute top-[18%] left-[75%] text-xl opacity-15 animate-bounce select-none" style={{ animationDelay: '0.9s' }}>🌽</div>
      <div className="absolute bottom-[28%] left-[6%] text-2xl opacity-20 animate-bounce select-none" style={{ animationDelay: '1.3s' }}>💰</div>
      <div className="absolute bottom-[30%] right-[5%] text-2xl opacity-20 animate-bounce select-none" style={{ animationDelay: '0.4s' }}>🍅</div>

      {/* Content */}
      <div className="relative flex flex-col items-center h-full px-6 pt-10 pb-10 gap-0">

        {/* Mascot + Logo block */}
        <div className="flex flex-col items-center gap-1 mb-6">
          <RaccoonMascot size={130} className="drop-shadow-2xl" />
          <BanditBuddyLogo size="lg" />
          <p className="text-white/40 text-xs font-medium tracking-widest uppercase mt-1">
            Plant · Harvest · Steal · Earn
          </p>
        </div>

        {/* Player card */}
        <div
          className="w-full max-w-sm rounded-3xl p-5 mb-6 flex flex-col gap-4"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {/* Avatar + name row */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white font-black text-2xl shadow-lg flex-shrink-0 select-none border border-green-400/20">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-white font-black text-lg leading-tight truncate">
                @{profile?.username ?? 'Farmer'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-green-400/80 bg-green-400/10 rounded-full px-2 py-0.5 border border-green-400/20">
                  🦝 Bandit Farmer
                </span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              icon={<Coins size={14} className="text-amber-400" />}
              value={Math.floor(profile?.goldBalance ?? 0).toLocaleString()}
              label="GOLD"
              color="text-amber-300"
            />
            <StatCard
              icon={<Zap size={14} className="text-blue-400" />}
              value={String(profile?.energy ?? 0)}
              label="ENERGY"
              color="text-blue-300"
            />
            <StatCard
              icon={<LayoutGrid size={14} className="text-green-400" />}
              value={String(profile?.plotCount ?? 0)}
              label="PLOTS"
              color="text-green-300"
            />
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA */}
        <div className="w-full max-w-sm">
          <button
            onClick={onEnter}
            className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 60%, #15803d 100%)',
              color: '#fff',
              boxShadow: '0 6px 28px rgba(34,197,94,0.40), 0 0 0 1px rgba(74,222,128,0.2)',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            <span className="text-xl">🦝</span>
            <span>Enter Farm</span>
            <ChevronRight size={20} />
          </button>
          <p className="text-white/20 text-[10px] text-center mt-2.5">
            BSC Testnet · Play to Earn · Web3
          </p>
        </div>
      </div>
    </div>
  );
}

function BanditBuddyLogo({ size }: { size: 'sm' | 'lg' }) {
  return (
    <div className={`flex flex-col items-center ${size === 'lg' ? 'gap-0.5' : 'gap-0'}`}>
      <div className={`font-black tracking-tight leading-none select-none ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}>
        <span style={{
          background: 'linear-gradient(135deg, #4ade80, #22c55e, #86efac)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 2px 8px rgba(34,197,94,0.5))',
        }}>Bandit</span>
        {' '}
        <span style={{
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #fde68a)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 2px 8px rgba(245,158,11,0.5))',
        }}>Buddy</span>
      </div>
      {size === 'lg' && (
        <div className="flex items-center gap-1 mt-1">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-green-400/50" />
          <span className="text-[9px] text-white/30 tracking-[0.2em] uppercase font-semibold">Web3 Farm Heist</span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-400/50" />
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, color }: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-2.5 text-center"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex justify-center mb-1">{icon}</div>
      <p className={`font-black text-sm ${color}`}>{value}</p>
      <p className="text-white/25 text-[8px] mt-0.5 tracking-wider">{label}</p>
    </div>
  );
}
