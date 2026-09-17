import { useState } from 'react';
import { Wallet, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { useMPCWallet } from '@/hooks/useMPCWallet';
import { soundManager } from '@/sounds/SoundManager';
import WebApp from '@twa-dev/sdk';

interface WalletHUDProps {
  onOpenDashboard: () => void;
}

export function WalletHUD({ onOpenDashboard }: WalletHUDProps) {
  const { shortAddress, totalAssetsUsd, formatFiat, isBackedUp, hasWallet } = useMPCWallet();
  const [hideBalance, setHideBalance] = useState<boolean>(() => {
    return localStorage.getItem('bb_wallet_hud_hide_balance') === '1';
  });

  const toggleHide = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      (WebApp as any)?.HapticFeedback?.selectionChanged?.();
    } catch {}
    const next = !hideBalance;
    setHideBalance(next);
    localStorage.setItem('bb_wallet_hud_hide_balance', next ? '1' : '0');
  };

  const handleClick = () => {
    soundManager.play('click');
    try {
      (WebApp as any)?.HapticFeedback?.selectionChanged?.();
    } catch {}
    onOpenDashboard();
  };

  if (!hasWallet) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      type="button"
      className="pointer-events-auto relative group flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl glass border border-white/10 hover:border-amber-400/40 hover:bg-white/10 active:scale-95 transition-all cursor-pointer shadow-sm"
      title={`Decentralized Keyless Wallet: ${shortAddress} • Tap to open Assets Dashboard`}
    >
      {/* Wallet Icon with Network Indicator */}
      <div className="relative flex items-center justify-center">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500/30 to-yellow-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
          <Wallet size={13} className="text-amber-300" />
        </div>
        {/* Network & Security Pulse indicator */}
        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black animate-pulse" />
      </div>

      {/* Address & Fiat Balance */}
      <div className="flex flex-col items-start text-left min-w-0">
        <div className="flex items-center gap-1 leading-none">
          <span className="text-white/80 font-black text-[11px] sm:text-xs tracking-tight font-mono">
            {hideBalance ? '••••••' : formatFiat(totalAssetsUsd)}
          </span>
          <button
            type="button"
            onClick={toggleHide}
            className="text-white/30 hover:text-white/70 p-0.5 transition-colors"
            title={hideBalance ? 'Show balance' : 'Hide balance'}
          >
            {hideBalance ? <EyeOff size={10} /> : <Eye size={10} />}
          </button>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-white/40 font-mono leading-none mt-0.5">
          <span className="truncate max-w-[62px] sm:max-w-[75px]">{shortAddress}</span>
          {!isBackedUp && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Cloud backup recommended" />
          )}
        </div>
      </div>
    </button>
  );
}
