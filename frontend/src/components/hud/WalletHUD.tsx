import { Wallet } from 'lucide-react';
import { useMPCWallet } from '@/hooks/useMPCWallet';
import { soundManager } from '@/sounds/SoundManager';
import WebApp from '@twa-dev/sdk';

interface WalletHUDProps {
  onOpenDashboard: () => void;
}

export function WalletHUD({ onOpenDashboard }: WalletHUDProps) {
  const { hasWallet, isBackedUp } = useMPCWallet();

  const handleClick = () => {
    soundManager.play('click');
    try {
      (WebApp as any)?.HapticFeedback?.selectionChanged?.();
    } catch {}
    onOpenDashboard();
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      className="pointer-events-auto relative glass rounded-xl p-1.5 text-white/60 hover:text-white active:scale-95 transition-all"
    >
      <Wallet size={14} />
      <span
        className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-1 ring-black ${
          !hasWallet
            ? 'bg-amber-400 animate-pulse'
            : isBackedUp
            ? 'bg-emerald-400'
            : 'bg-amber-400 animate-pulse'
        }`}
      />
    </button>
  );
}
