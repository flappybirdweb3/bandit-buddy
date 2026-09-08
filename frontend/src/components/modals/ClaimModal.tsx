import { useState } from 'react';
import { X, Gem, Wallet, ArrowRight, CheckCircle, ExternalLink } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useClaimTokens } from '@/hooks/useClaimTokens';
import { useGame } from '@/providers/GameProvider';

interface Props { onClose: () => void }

export function ClaimModal({ onClose }: Props) {
  const { profile } = useGame();
  const { address, isConnected } = useAccount();
  const { open: openWallet } = useWeb3Modal();
  const { claim, txHash, isRequesting, walletPending, confirming, confirmed, error } = useClaimTokens();
  const [amount, setAmount] = useState('');

  const maxClaimable = Math.floor(profile?.goldBalance ?? 0);
  const parsed = parseInt(amount, 10) || 0;
  const canClaim = parsed >= 1 && parsed <= maxClaimable && isConnected && !isRequesting;

  const statusText = !isConnected
    ? 'Connect wallet to claim'
    : isRequesting ? 'Requesting backend signature…'
    : walletPending ? 'Approve in wallet…'
    : confirming ? 'Confirming on BSC…'
    : `Claim ${parsed || 0} $FARM`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Gem size={18} className="text-violet-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Claim $FARM</h2>
              <p className="text-white/40 text-xs">Convert GOLD to on-chain token</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Wallet row */}
        <div className="glass rounded-2xl flex items-center gap-3 p-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isConnected ? 'bg-green-500/20' : 'bg-white/10'}`}>
            <Wallet size={15} className={isConnected ? 'text-green-400' : 'text-white/40'} />
          </div>
          <div className="flex-1">
            <div className="text-white/40 text-[10px]">BSC Wallet</div>
            <div className="text-white text-sm font-semibold">
              {isConnected ? `${address?.slice(0, 6)}…${address?.slice(-4)}` : 'Not connected'}
            </div>
          </div>
          <button
            onClick={() => openWallet()}
            className="glass-purple text-violet-300 text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-all"
          >
            {isConnected ? 'Switch' : 'Connect'}
          </button>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="glass-gold rounded-2xl p-3 text-center">
            <div className="text-amber-300 font-black text-2xl">{maxClaimable}</div>
            <div className="text-white/40 text-[10px] mt-1">GOLD Balance</div>
          </div>
          <div className="glass-purple rounded-2xl p-3 text-center">
            <div className="text-violet-300 font-black text-lg flex items-center justify-center gap-1">
              1 <ArrowRight size={14} className="text-white/30" /> 1
            </div>
            <div className="text-white/40 text-[10px] mt-1">GOLD = $FARM rate</div>
          </div>
        </div>

        {/* Amount input */}
        <div className="glass rounded-2xl flex items-center overflow-hidden mb-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Amount (max ${maxClaimable})`}
            min={1}
            max={maxClaimable}
            className="flex-1 bg-transparent px-4 py-3.5 text-white text-base outline-none placeholder:text-white/30"
          />
          <button
            onClick={() => setAmount(String(maxClaimable))}
            className="text-amber-400 font-bold text-sm px-4 py-3.5 border-l border-white/10"
          >
            MAX
          </button>
        </div>

        {/* Trust score warning */}
        {profile && profile.trustScore < 30 && (
          <div className="glass-red rounded-2xl p-3 mb-4 text-red-300 text-xs">
            ⚠️ Trust score too low ({profile.trustScore}/30). Play more to unlock claiming.
          </div>
        )}

        {/* Success */}
        {confirmed && txHash && (
          <div className="glass-green rounded-2xl p-4 mb-4 text-center">
            <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
            <div className="text-green-300 font-bold text-sm">Claimed successfully!</div>
            <a
              href={`https://testnet.bscscan.com/tx/${txHash}`}
              target="_blank" rel="noreferrer"
              className="text-violet-400 text-xs flex items-center justify-center gap-1 mt-1"
            >
              View on BSCScan <ExternalLink size={11} />
            </a>
          </div>
        )}

        {/* Claim button */}
        <button
          disabled={!canClaim}
          onClick={() => claim(parsed)}
          className="w-full bg-gradient-to-r from-violet-600 to-purple-500 py-4 rounded-2xl text-white font-black text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Gem size={16} />
          {statusText}
        </button>

        {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}

        <p className="text-white/20 text-[10px] text-center mt-4 leading-relaxed">
          GOLD deducted immediately. $FARM arrives after BSC confirmation (~3s).
        </p>
      </div>
    </div>
  );
}
