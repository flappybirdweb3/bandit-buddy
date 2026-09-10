import { useState, useEffect } from 'react';
import { X, Gem, Wallet, ArrowRight, CheckCircle2, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import { privateKeyToAccount } from 'viem/accounts';
import { formatEther } from 'viem';
import { useClaimTokens, getWalletBnbBalance } from '@/hooks/useClaimTokens';
import type { ClaimStep } from '@/hooks/useClaimTokens';
import { getStoredWalletPk } from '@/hooks/useAutoWallet';
import { useGame } from '@/providers/GameProvider';

interface Props { onClose: () => void }

const MIN_BNB_FOR_GAS = BigInt('2000000000000000'); // 0.002 BNB

// ── Step tracker ──────────────────────────────────────────────────
const CLAIM_STEPS: { id: ClaimStep[]; label: string }[] = [
  { id: ['requesting_sig'],        label: 'Sign' },
  { id: ['sending_tx'],            label: 'Send' },
  { id: ['confirming', 'success'], label: 'Confirm' },
];

function StepTracker({ step }: { step: ClaimStep }) {
  const activeIdx = CLAIM_STEPS.findIndex((s) => s.id.includes(step));
  if (activeIdx < 0) return null;

  return (
    <div className="flex items-center gap-2 mb-4">
      {CLAIM_STEPS.map((s, i) => {
        const done    = i < activeIdx || step === 'success';
        const current = i === activeIdx && step !== 'success';
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              done    ? 'bg-green-500 text-white' :
              current ? 'bg-violet-500 text-white ring-2 ring-violet-400/40' :
              'bg-white/10 text-white/30'
            }`}>
              {done ? <CheckCircle2 size={14} /> : (
                current
                  ? <Loader2 size={14} className="animate-spin" />
                  : <span className="text-[10px] font-bold">{i + 1}</span>
              )}
            </div>
            <span className={`text-[9px] font-semibold ${current ? 'text-violet-300' : done ? 'text-green-400' : 'text-white/25'}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ClaimModal({ onClose }: Props) {
  const { profile } = useGame();
  const { claim, step, txHash, error, reset } = useClaimTokens();
  const [amount, setAmount] = useState('');
  const [bnbBalance, setBnbBalance] = useState<bigint | null>(null);

  const pk = getStoredWalletPk();
  const address = pk ? privateKeyToAccount(pk).address : null;

  useEffect(() => {
    if (!address) return;
    getWalletBnbBalance(address).then(setBnbBalance).catch(() => setBnbBalance(null));
  }, [address]);

  const maxClaimable = Math.floor(profile?.goldBalance ?? 0);
  const parsed  = parseInt(amount, 10) || 0;
  const hasBnb  = bnbBalance === null || bnbBalance >= MIN_BNB_FOR_GAS;
  const isBusy  = step === 'requesting_sig' || step === 'sending_tx' || step === 'confirming';
  const trustOk = (profile?.trustScore ?? 0) >= 30;
  const canClaim = parsed >= 1 && parsed <= maxClaimable && hasBnb && !isBusy && trustOk && step !== 'success';

  const handleClose = () => { reset(); onClose(); };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gem size={18} className="text-violet-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Claim $FARM</h2>
              <p className="text-white/40 text-xs">Convert GOLD → on-chain token (BSC Testnet)</p>
            </div>
          </div>
          <button onClick={handleClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* In-progress step tracker */}
        {isBusy && <StepTracker step={step} />}

        {/* Wallet row */}
        <div className="glass rounded-2xl flex items-center gap-3 p-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <Wallet size={15} className="text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-[10px]">BSC Wallet (auto-generated)</p>
            <p className="text-white text-sm font-mono truncate">
              {address ? `${address.slice(0, 10)}…${address.slice(-8)}` : 'No wallet'}
            </p>
          </div>
          {bnbBalance !== null && (
            <div className="text-right flex-shrink-0">
              <p className="text-white/30 text-[10px]">BNB</p>
              <p className={`text-xs font-bold ${hasBnb ? 'text-green-400' : 'text-red-400'}`}>
                {parseFloat(formatEther(bnbBalance)).toFixed(4)}
              </p>
            </div>
          )}
        </div>

        {/* Low BNB warning */}
        {bnbBalance !== null && !hasBnb && (
          <div className="glass rounded-2xl flex items-start gap-2.5 p-3 mb-3 border border-amber-500/20">
            <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-xs font-bold">Need ~0.002 tBNB for gas</p>
              <p className="text-white/40 text-[10px] mt-0.5">
                Get test BNB from{' '}
                <a href="https://testnet.bnbchain.org/faucet-smart" target="_blank" rel="noreferrer"
                  className="text-violet-400 underline">BSC Testnet Faucet</a>
                {' '}using your address: <span className="font-mono">{address?.slice(0, 12)}…</span>
              </p>
            </div>
          </div>
        )}

        {/* Trust score warning */}
        {!trustOk && (
          <div className="glass-red rounded-2xl p-3 mb-3 flex items-start gap-2.5 border border-red-500/20">
            <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs">
              Trust score too low ({profile?.trustScore}/30). Keep playing to unlock claiming.
            </p>
          </div>
        )}

        {/* Balance + rate cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="glass-gold rounded-2xl p-3 text-center">
            <p className="text-amber-300 font-black text-2xl">{maxClaimable}</p>
            <p className="text-white/40 text-[10px] mt-1">GOLD Available</p>
          </div>
          <div className="glass-purple rounded-2xl p-3 text-center flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-300 font-bold text-sm">1G</span>
              <ArrowRight size={12} className="text-white/30" />
              <span className="text-violet-300 font-bold text-sm">1 $FARM</span>
            </div>
            <p className="text-white/30 text-[10px]">1:1 exchange rate</p>
          </div>
        </div>

        {/* Amount input */}
        {step !== 'success' && (
          <div className="glass rounded-2xl flex items-center overflow-hidden mb-4">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount (1 – ${maxClaimable})`}
              min={1}
              max={maxClaimable}
              disabled={isBusy}
              className="flex-1 bg-transparent px-4 py-3.5 text-white text-base outline-none placeholder:text-white/30 disabled:opacity-50"
            />
            <button
              onClick={() => setAmount(String(maxClaimable))}
              disabled={isBusy || maxClaimable === 0}
              className="text-amber-400 font-black text-xs px-4 py-3.5 border-l border-white/10 disabled:opacity-40 active:opacity-60"
            >
              MAX
            </button>
          </div>
        )}

        {/* Success state */}
        {step === 'success' && txHash && (
          <div className="glass rounded-2xl p-5 mb-4 text-center border border-green-400/25 bg-green-500/10">
            <CheckCircle2 size={32} className="text-green-400 mx-auto mb-2" />
            <p className="text-green-300 font-black text-base">Claimed {parsed} $FARM!</p>
            <p className="text-white/40 text-xs mt-1">Tokens sent to your BSC wallet</p>
            <a
              href={`https://testnet.bscscan.com/tx/${txHash}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-violet-400 text-xs mt-3 font-semibold"
            >
              View on BSCScan <ExternalLink size={11} />
            </a>
          </div>
        )}

        {/* Claim button */}
        {step !== 'success' && (
          <button
            disabled={!canClaim}
            onClick={() => claim(parsed)}
            className="w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{
              background: canClaim
                ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                : undefined,
              color: '#fff',
              boxShadow: canClaim ? '0 0 20px rgba(124,58,237,0.4)' : undefined,
            }}
          >
            <Gem size={15} />
            {isBusy && <Loader2 size={15} className="animate-spin" />}
            {step === 'idle'           && `Claim ${parsed > 0 ? parsed : ''} $FARM`}
            {step === 'requesting_sig' && 'Signing with server…'}
            {step === 'sending_tx'     && 'Sending to BSC…'}
            {step === 'confirming'     && 'Waiting for block…'}
            {step === 'error'          && 'Try again'}
          </button>
        )}

        {step === 'success' && (
          <button
            onClick={handleClose}
            className="w-full py-4 rounded-2xl glass text-white/70 font-bold text-sm active:scale-95 transition-all"
          >
            Close
          </button>
        )}

        {(step === 'error' || error) && (
          <p className="text-red-400 text-xs text-center mt-3 leading-snug">{error}</p>
        )}

        <p className="text-white/20 text-[10px] text-center mt-4 leading-relaxed">
          GOLD deducted immediately · $FARM arrives after BSC Testnet confirmation (~3–5s)
        </p>
      </div>
    </div>
  );
}
