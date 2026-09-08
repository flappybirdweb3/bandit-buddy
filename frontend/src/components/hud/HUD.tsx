import { Component, useState } from 'react';
import { Wallet, Settings, Zap, Coins } from 'lucide-react';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount } from 'wagmi';
import { useGame } from '@/providers/GameProvider';
import { SettingsModal } from '@/components/modals/SettingsModal';
import type { ReactNode } from 'react';

class WalletErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <button className="glass rounded-xl p-1.5 text-white/40 pointer-events-none" disabled>
        <Wallet size={13} />
      </button>
    );
    return this.props.children;
  }
}

function WalletButton() {
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();
  const shortAddr = address ? `${address.slice(0, 4)}…${address.slice(-3)}` : null;
  return (
    <button
      className={`pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
        isConnected ? 'glass-green text-green-300' : 'glass-purple text-violet-300'
      }`}
      onClick={() => open()}
    >
      <Wallet size={13} />
      <span className="hidden sm:inline">{isConnected ? shortAddr : 'Connect'}</span>
    </button>
  );
}

export function HUD() {
  const { profile } = useGame();
  const [showSettings, setShowSettings] = useState(false);

  if (!profile) return null;

  const energyPct = Math.min(100, (profile.energy / 100) * 100);
  const energyColor =
    energyPct > 50 ? 'bg-green-400' : energyPct > 20 ? 'bg-amber-400' : 'bg-red-400';

  // XP / level mock (trust_score used as level proxy)
  const level = Math.max(1, Math.floor(profile.trustScore / 10));
  const xpPct = (profile.trustScore % 10) * 10;

  return (
    <>
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none px-3 pt-2 pb-1">
      <div className="glass rounded-2xl flex items-center gap-2 px-3 py-2">

        {/* Avatar + Level */}
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white font-bold text-sm border-2 border-white/20">
            {(profile.username ?? 'B')[0].toUpperCase()}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-400 text-black text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {level}
          </div>
        </div>

        {/* XP + Energy bars */}
        <div className="flex flex-col gap-1 flex-shrink-0 w-20">
          {/* XP bar */}
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          {/* Energy bar */}
          <div className="flex items-center gap-1">
            <Zap size={9} className={energyPct > 50 ? 'text-green-400' : energyPct > 20 ? 'text-amber-400' : 'text-red-400'} />
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${energyColor} rounded-full transition-all`}
                style={{ width: `${energyPct}%` }}
              />
            </div>
            <span className="text-[9px] text-white/60 font-semibold">{profile.energy}</span>
          </div>
        </div>

        {/* GOLD */}
        <div className="glass-gold rounded-xl flex items-center gap-1.5 px-2.5 py-1.5 flex-shrink-0">
          <Coins size={14} className="text-amber-400" />
          <span className="text-amber-300 font-bold text-sm leading-none">
            {profile.goldBalance >= 1000
              ? `${(profile.goldBalance / 1000).toFixed(1)}k`
              : profile.goldBalance.toFixed(0)}
          </span>
        </div>

        {/* $FARM badge */}
        <div className="glass-purple rounded-xl flex items-center gap-1.5 px-2.5 py-1.5 flex-shrink-0">
          <span className="text-[9px] font-black text-violet-300 tracking-tight">$FARM</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Wallet button — pointer-events-auto */}
        <WalletErrorBoundary>
          <WalletButton />
        </WalletErrorBoundary>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="pointer-events-auto glass rounded-xl p-1.5 text-white/60 hover:text-white active:scale-95 transition-all"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>

    {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
