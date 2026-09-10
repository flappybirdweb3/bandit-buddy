import { useState } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { Copy, Check, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import { getStoredWalletPk } from '@/hooks/useAutoWallet';

interface Props { onClose: () => void }

export function WalletSetupModal({ onClose }: Props) {
  const pk = getStoredWalletPk();
  const address = pk ? privateKeyToAccount(pk).address : null;

  const [showKey, setShowKey] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const copy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm glass rounded-3xl p-6 slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 glass rounded-full p-1.5 text-white/40 hover:text-white active:scale-90 transition-all"
        >
          <X size={14} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <div className="text-center">
            <h2 className="text-white font-black text-base">Wallet Created!</h2>
            <p className="text-white/50 text-xs mt-1">
              A BSC wallet was auto-generated for you. Save your private key — it's the only way to recover your wallet.
            </p>
          </div>
        </div>

        {/* Address */}
        <div className="mb-3">
          <div className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1.5">Your wallet address</div>
          <div className="glass rounded-xl flex items-center gap-2 px-3 py-2.5">
            <span className="flex-1 text-white/70 text-xs font-mono truncate">
              {address}
            </span>
            <button
              onClick={() => address && copy(address, setCopiedAddr)}
              className="flex-shrink-0 text-white/40 hover:text-white active:scale-90 transition-all"
            >
              {copiedAddr ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Private Key */}
        <div className="mb-4">
          <div className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1.5">
            Private key
            <span className="ml-1.5 text-amber-400 normal-case font-normal">— back this up now!</span>
          </div>
          <div className="glass rounded-xl flex items-center gap-2 px-3 py-2.5">
            <span className={`flex-1 text-xs font-mono break-all ${showKey ? 'text-white/70' : 'text-white/20 select-none tracking-widest'}`}>
              {showKey ? pk : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
            </span>
            <div className="flex-shrink-0 flex gap-2">
              <button
                onClick={() => setShowKey(!showKey)}
                className="text-white/40 hover:text-white active:scale-90 transition-all"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              {showKey && (
                <button
                  onClick={() => pk && copy(pk, setCopiedKey)}
                  className="text-white/40 hover:text-white active:scale-90 transition-all"
                >
                  {copiedKey ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>
          <p className="text-amber-400/70 text-[10px] mt-1.5 leading-relaxed">
            ⚠️ Never share this key with anyone. Store it in a secure place. If you lose it, you lose access to your wallet.
          </p>
        </div>

        {/* Confirm + close */}
        <label className="flex items-start gap-2.5 cursor-pointer mb-4">
          <div
            onClick={() => setConfirmed(!confirmed)}
            className={`w-5 h-5 rounded-md flex-shrink-0 border-2 transition-all flex items-center justify-center mt-0.5 ${
              confirmed ? 'bg-green-500 border-green-500' : 'border-white/20 bg-transparent'
            }`}
          >
            {confirmed && <Check size={12} className="text-white" />}
          </div>
          <span className="text-white/50 text-xs leading-relaxed">
            I have copied and saved my private key in a secure location
          </span>
        </label>

        <button
          disabled={!confirmed}
          onClick={onClose}
          className={`w-full py-3 rounded-2xl font-black text-sm transition-all ${
            confirmed
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white active:scale-95'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
        >
          Got it, let's farm!
        </button>
      </div>
    </div>
  );
}
