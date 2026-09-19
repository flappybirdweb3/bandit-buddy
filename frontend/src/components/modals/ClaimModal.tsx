import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { bscTestnet } from 'viem/chains';
import {
  X, Gem, ArrowRight, CheckCircle2, ExternalLink, AlertTriangle,
  Loader2, Copy, Check, QrCode, ChevronDown, Fuel, ArrowDownLeft, TrendingUp,
  ArrowUpDown, RefreshCw, ShieldCheck, Sparkles, Coins, Info, Flame,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useClaimTokens } from '@/hooks/useClaimTokens';
import type { ClaimStep } from '@/hooks/useClaimTokens';
import { useGame } from '@/providers/GameProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useDexTier } from '@/hooks/useDexTier';
import { useDynamicRates } from '@/hooks/useDynamicRates';
import { useCashoutQuota } from '@/hooks/useCashoutQuota';
import type { CashoutQuota, TreasuryStatus } from '@/types/game.types';
import { usePancakeSwap } from '@/hooks/usePancakeSwap';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { eventBus } from '@/game/EventBus';
import { SwapResultModal } from '@/components/modals/SwapResultModal';

interface Props {
  onClose: () => void;
  initialTab?: ModalTab;
}

const BSC_TESTNET_RPC  = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const FARM_ADDRESS     = (import.meta.env.VITE_FARM_TOKEN_ADDRESS || '0xB10067A034078E3FC8335Fb003eEF7334C44952f') as `0x${string}`;
const CLAIM_GAS_LIMIT  = 180_000n;
const MIN_BNB_FOR_GAS  = BigInt('2000000000000000'); // 0.002 BNB
const BNB_WARN_BUFFER  = 1.3;
const MAX_CLAIM_GOLD   = 100_000;

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

type ModalTab = 'convert' | 'dex' | 'deposit_tx' | 'treasury';
type ConvertDirection = 'GOLD_TO_FARM' | 'FARM_TO_GOLD';

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Step tracker ──────────────────────────────────────────────────────────────
const CLAIM_STEPS: { id: ClaimStep[]; label: string }[] = [
  { id: ['requesting_sig'],        label: 'Sign' },
  { id: ['sending_tx'],            label: 'Send' },
  { id: ['confirming', 'success'], label: 'Confirm' },
];

function StepTracker({ step }: { step: ClaimStep }) {
  const activeIdx = CLAIM_STEPS.findIndex((s) => s.id.includes(step));
  if (activeIdx < 0) return null;
  return (
    <div className="flex items-center gap-2 mb-3">
      {CLAIM_STEPS.map((s, i) => {
        const done    = i < activeIdx || step === 'success';
        const current = i === activeIdx && step !== 'success';
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
              done    ? 'bg-green-500 text-white' :
              current ? 'bg-violet-500 text-white ring-2 ring-violet-400/40' :
              'bg-white/10 text-white/30'
            }`}>
              {done ? <CheckCircle2 size={12} /> : (
                current
                  ? <Loader2 size={12} className="animate-spin" />
                  : <span className="text-[9px] font-bold">{i + 1}</span>
              )}
            </div>
            <span className={`text-[8px] font-semibold ${current ? 'text-violet-300' : done ? 'text-green-400' : 'text-white/25'}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Deposit Step Tracker ──────────────────────────────────────────────────────
export type DepositStep =
  | 'idle'
  | 'preparing'
  | 'broadcasting'
  | 'confirming'
  | 'verifying'
  | 'success'
  | 'error';

export interface DepositResultData {
  goldCredited: number;
  goldBalance: number;
  txHash: string;
  farmAmount: number;
  depositRate: number;
  senderAddress: string;
  treasuryAddress: string;
}

const DEPOSIT_STEPS = [
  { key: 'preparing',    label: 'Prepare' },
  { key: 'broadcasting', label: 'Transfer' },
  { key: 'confirming',   label: 'Confirm' },
  { key: 'verifying',    label: 'Credit GOLD' },
] as const;

function DepositStepTracker({ step, currentTxHash }: { step: DepositStep; currentTxHash?: string | null }) {
  const stepOrder = ['preparing', 'broadcasting', 'confirming', 'verifying', 'success'];
  const currentIndex = stepOrder.indexOf(step);
  if (currentIndex < 0 || step === 'idle' || step === 'error') return null;

  return (
    <div className="glass rounded-2xl p-3 mb-3 border border-emerald-500/20 bg-emerald-500/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-black text-emerald-300 flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin text-emerald-400" />
          Deposit Progress
        </span>
        <span className="text-[10px] font-mono text-emerald-400/70 font-bold">
          Step {Math.min(Math.max(currentIndex + 1, 1), 4)} / 4
        </span>
      </div>

      {/* Progress Bar Line */}
      <div className="relative h-1.5 w-full bg-white/10 rounded-full overflow-hidden mb-2.5">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-500 rounded-full"
          style={{
            width:
              step === 'preparing'
                ? '20%'
                : step === 'broadcasting'
                ? '45%'
                : step === 'confirming'
                ? '75%'
                : step === 'verifying'
                ? '92%'
                : step === 'success'
                ? '100%'
                : '5%',
          }}
        />
      </div>

      {/* 4 Step Badges */}
      <div className="grid grid-cols-4 gap-1.5">
        {DEPOSIT_STEPS.map((s, i) => {
          const isDone = currentIndex > i || step === 'success';
          const isCurrent = step === s.key;
          return (
            <div
              key={s.key}
              className={`flex flex-col items-center text-center p-1 rounded-xl transition-all ${
                isCurrent
                  ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                  : isDone
                  ? 'bg-white/5 text-white/80'
                  : 'bg-transparent text-white/25'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black mb-1 transition-all ${
                  isDone
                    ? 'bg-emerald-500 text-black'
                    : isCurrent
                    ? 'bg-emerald-400/30 text-emerald-300 border border-emerald-400'
                    : 'bg-white/10 text-white/30'
                }`}
              >
                {isDone ? (
                  <Check size={11} className="stroke-[3]" />
                ) : isCurrent ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  i + 1
                )}
              </div>
              <span className="text-[8px] font-bold leading-tight truncate w-full">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Step Description & BSCScan link */}
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
        <span className="text-white/70">
          {step === 'preparing' && 'Preparing wallet & checking gas…'}
          {step === 'broadcasting' && 'Broadcasting $FARM transfer transaction to BSC…'}
          {step === 'confirming' && 'Waiting for block receipt confirmation…'}
          {step === 'verifying' && 'Verifying on-chain transaction & crediting in-game GOLD…'}
        </span>
        {currentTxHash && (
          <a
            href={`https://testnet.bscscan.com/tx/${currentTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono text-[9px] underline flex-shrink-0"
          >
            BSCScan <ExternalLink size={9} />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Deposit Transaction Result Sub-Modal / Popup ──────────────────────────────
interface DepositReceiptModalProps {
  data: DepositResultData;
  onClose: () => void;
  onContinue: () => void;
}

function DepositReceiptModal({ data, onClose, onContinue }: DepositReceiptModalProps) {
  const [copiedTx, setCopiedTx] = useState(false);
  const [copiedTreasury, setCopiedTreasury] = useState(false);

  const copy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md glass rounded-3xl p-5 border border-emerald-500/30 bg-gradient-to-b from-[#18231c] via-[#101914] to-[#0c1410] shadow-2xl relative slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 glass rounded-full p-2 text-white/50 hover:text-white transition-all active:scale-90"
        >
          <X size={16} />
        </button>

        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mt-2 mb-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 mb-2.5 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 size={32} className="stroke-[2.5]" />
          </div>
          <h3 className="text-lg font-black text-white">Deposit Successful!</h3>
          <p className="text-white/50 text-xs mt-0.5">
            $FARM successfully converted to in-game GOLD
          </p>
        </div>

        {/* Hero Credited Value */}
        <div className="glass-gold rounded-2xl p-4 mb-4 text-center border border-amber-400/30 bg-amber-500/10">
          <span className="text-[10px] font-bold text-amber-300/70 uppercase tracking-wider block mb-0.5">
            In-Game GOLD Credited
          </span>
          <div className="text-3xl font-black text-amber-300 font-mono flex items-center justify-center gap-1.5">
            <span>+{data.goldCredited.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span className="text-xl">🌾</span>
          </div>
          <div className="text-[11px] text-white/60 mt-1 font-medium">
            New Balance: <span className="font-bold text-white">{data.goldBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} GOLD</span>
          </div>
        </div>

        {/* Detailed Transaction Breakdown Table */}
        <div className="rounded-2xl bg-black/40 border border-white/5 p-3.5 space-y-2.5 mb-4 text-xs">
          <div className="flex items-center justify-between text-white/60">
            <span>Deposited Amount:</span>
            <span className="font-mono font-bold text-white flex items-center gap-1">
              <span>💎</span> {data.farmAmount.toFixed(2)} $FARM
            </span>
          </div>

          <div className="flex items-center justify-between text-white/60">
            <span>Exchange Rate:</span>
            <span className="font-mono font-bold text-emerald-300">
              1 $FARM = {data.depositRate.toFixed(2)} GOLD
            </span>
          </div>

          <div className="flex items-center justify-between text-white/60">
            <span>Deposit Fee:</span>
            <span className="font-mono font-bold text-emerald-400">0% (Free)</span>
          </div>

          <div className="h-px bg-white/5 my-1" />

          {/* Sender */}
          <div className="flex items-center justify-between text-white/60">
            <span>From Wallet:</span>
            <span className="font-mono text-white/80 text-[11px]">
              {shortAddr(data.senderAddress)}
            </span>
          </div>

          {/* Treasury */}
          <div className="flex items-center justify-between text-white/60">
            <span>To Treasury:</span>
            <div className="flex items-center gap-1 font-mono text-white/80 text-[11px]">
              <span>{shortAddr(data.treasuryAddress)}</span>
              <button
                onClick={() => copy(data.treasuryAddress, setCopiedTreasury)}
                className="text-white/40 hover:text-white"
                title="Copy Treasury"
              >
                {copiedTreasury ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
              </button>
            </div>
          </div>

          {/* TxHash */}
          <div className="flex items-center justify-between text-white/60">
            <span>Transaction Hash:</span>
            <div className="flex items-center gap-1.5 font-mono text-violet-300 text-[11px]">
              <a
                href={`https://testnet.bscscan.com/tx/${data.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline flex items-center gap-1"
              >
                {shortAddr(data.txHash)} <ExternalLink size={10} />
              </a>
              <button
                onClick={() => copy(data.txHash, setCopiedTx)}
                className="text-white/40 hover:text-white"
                title="Copy Tx Hash"
              >
                {copiedTx ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onContinue}
            className="w-full py-3.5 rounded-2xl font-black text-xs active:scale-95 transition-all text-white flex items-center justify-center gap-2 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #059669, #047857)',
              boxShadow: '0 0 20px rgba(5,150,105,0.4)',
            }}
          >
            <Sparkles size={14} /> Continue Playing
          </button>
          <a
            href={`https://testnet.bscscan.com/tx/${data.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 rounded-xl font-bold text-xs text-white/50 hover:text-white text-center glass transition-all"
          >
            View on BSCScan Explorer ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Wallet card ───────────────────────────────────────────────────────────────
interface DexTierInfo {
  tier: number;
  buyTax: number;
  sellTax: number;
}

const TIER_STYLES: Record<number, { pill: string; label: string }> = {
  1: { pill: 'bg-white/10 text-white/50 border border-white/10', label: 'Standard' },
  2: { pill: 'bg-blue-500/15 text-blue-300 border border-blue-400/20', label: 'Silver' },
  3: { pill: 'bg-amber-500/15 text-amber-300 border border-amber-400/25', label: 'Gold' },
};

interface WalletCardProps {
  address: string;
  bnbBalance: bigint | null;
  farmBalance: bigint | null;
  gasEstimate: bigint | null;
  loading: boolean;
  dexTier?: DexTierInfo | null;
  onOpenDex?: () => void;
}

function WalletCard({ address, bnbBalance, farmBalance, gasEstimate, loading, dexTier, onOpenDex }: WalletCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrUrl,  setQrUrl]  = useState<string | null>(null);

  const copy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleQr = async () => {
    if (!showQr && !qrUrl) {
      const url = await QRCode.toDataURL(address, {
        width: 180, margin: 2,
        color: { dark: '#ffffff', light: '#00000000' },
      });
      setQrUrl(url);
    }
    setShowQr((v) => !v);
  };

  const bnbFloat  = bnbBalance  !== null ? parseFloat(formatEther(bnbBalance))  : null;
  const farmFloat = farmBalance !== null ? parseFloat(formatEther(farmBalance)) : null;
  const gasFloat  = gasEstimate !== null ? parseFloat(formatEther(gasEstimate)) : null;
  const isLowBnb  = bnbBalance !== null && gasEstimate !== null
    && bnbBalance < BigInt(Math.ceil(Number(gasEstimate) * BNB_WARN_BUFFER));

  return (
    <div className={`rounded-2xl p-3 mb-3 ${isLowBnb ? 'bg-amber-500/10 border border-amber-400/30' : 'glass'}`}>
      {isLowBnb && (
        <div className="flex items-start gap-2 mb-2 pb-2 border-b border-amber-400/20">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-amber-300 text-xs font-bold leading-tight">Low BNB — transactions may fail</p>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-amber-200/70 text-[10px]">
                Need ~{gasFloat?.toFixed(4) ?? '0.002'} BNB for gas.
              </p>
              <a
                href="https://www.bnbchain.org/en/testnet-faucet"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-amber-300 hover:underline font-bold flex items-center gap-0.5 flex-shrink-0"
              >
                Free Faucet <ExternalLink size={9} />
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-2.5">
        <div className="flex-1">
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide mb-0.5">BNB Gas</p>
          {loading ? (
            <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className={`text-xs font-black ${isLowBnb ? 'text-amber-300' : 'text-white'}`}>
              {bnbFloat !== null ? bnbFloat.toFixed(4) : '—'} BNB
            </p>
          )}
        </div>
        <div className="flex-1">
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide mb-0.5">Wallet $FARM</p>
          {loading ? (
            <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className="text-xs font-black text-amber-300">
              {farmFloat !== null ? farmFloat.toFixed(1) : '—'}
            </p>
          )}
        </div>
        <div className="flex-1">
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide mb-0.5">Est. Gas</p>
          {loading ? (
            <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className="text-[10px] font-bold text-white/50 flex items-center gap-0.5">
              <Fuel size={10} className="text-blue-300" />
              ~{gasFloat?.toFixed(4) ?? '0.0006'} BNB
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white/5 rounded-xl px-2.5 py-1.5 flex items-center gap-2 min-w-0">
          <span className="text-white/50 text-[10px] font-mono truncate flex-1">{shortAddr(address)}</span>
          <button
            onClick={copy}
            className="flex-shrink-0 text-white/40 hover:text-white active:scale-90 transition-all"
            title="Copy address"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
        </div>
        <button
          onClick={toggleQr}
          className={`flex-shrink-0 glass rounded-xl px-2 py-1.5 flex items-center gap-1 text-[10px] font-bold transition-all active:scale-95 ${showQr ? 'text-violet-300' : 'text-white/50'}`}
        >
          <QrCode size={12} />
          QR
          <ChevronDown size={10} className={`transition-transform ${showQr ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* DEX Tier indicator */}
      {dexTier && onOpenDex && (() => {
        const t = Math.min(Math.max(dexTier.tier, 1), 3);
        const style = TIER_STYLES[t];
        return (
          <button
            onClick={onOpenDex}
            className={`mt-2 w-full flex items-center justify-between rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all active:scale-[0.98] ${style.pill}`}
          >
            <span className="flex items-center gap-1.5">
              <TrendingUp size={11} />
              DEX Tier {t} · {style.label}
            </span>
            <span className="opacity-70">
              Tax: Buy {(dexTier.buyTax * 100).toFixed(1)}% / Sell {(dexTier.sellTax * 100).toFixed(1)}%
            </span>
          </button>
        );
      })()}

      {showQr && qrUrl && (
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <div className="bg-black/40 rounded-xl p-2.5 border border-white/10">
            <img src={qrUrl} alt="Wallet QR" width={140} height={140} className="rounded-lg" />
          </div>
          <p className="text-white/30 text-[8px] text-center">
            Scan to send tBNB or $FARM to this wallet
          </p>
        </div>
      )}
    </div>
  );
}

// ── Manual Deposit Tab ────────────────────────────────────────────────────────
function ManualDepositTab({
  depositInfo,
  onSuccess,
}: {
  depositInfo?: any;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const [txHash, setTxHash] = useState('');
  const [success, setSuccess] = useState<{ goldCredited: number; farmAmount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrUrl,  setQrUrl]  = useState<string | null>(null);

  const copyAddr = () => {
    if (!depositInfo?.treasuryAddress) return;
    navigator.clipboard.writeText(depositInfo.treasuryAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleQr = async () => {
    if (!depositInfo?.treasuryAddress) return;
    if (!showQr && !qrUrl) {
      const url = await QRCode.toDataURL(depositInfo.treasuryAddress, {
        width: 160, margin: 2,
        color: { dark: '#ffffff', light: '#00000000' },
      });
      setQrUrl(url);
    }
    setShowQr((v) => !v);
  };

  const mutation = useMutation({
    mutationFn: (hash: string) => api.verifyDeposit(hash),
    onSuccess: (data) => {
      setSuccess({ goldCredited: data.goldCredited, farmAmount: data.farmAmount });
      setTxHash('');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      if (onSuccess) onSuccess();
    },
  });

  const canVerify = /^0x[0-9a-fA-F]{64}$/.test(txHash) && !mutation.isPending;

  return (
    <div>
      {/* Treasury address */}
      {depositInfo && (
        <div className="glass rounded-2xl p-3 mb-3">
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide mb-1.5">
            Send $FARM to Treasury Address (BSC Testnet)
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/5 rounded-xl px-2.5 py-1.5 flex items-center gap-2 min-w-0">
              <span className="text-white/70 text-[11px] font-mono truncate flex-1">
                {shortAddr(depositInfo.treasuryAddress)}
              </span>
              <button onClick={copyAddr} className="flex-shrink-0 text-white/40 hover:text-white active:scale-90 transition-all">
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>
            </div>
            <button
              onClick={toggleQr}
              className={`flex-shrink-0 glass rounded-xl px-2 py-1.5 flex items-center gap-1 text-[10px] font-bold transition-all active:scale-95 ${showQr ? 'text-violet-300' : 'text-white/50'}`}
            >
              <QrCode size={12} />
              QR
              <ChevronDown size={10} className={`transition-transform ${showQr ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showQr && qrUrl && (
            <div className="mt-2.5 flex flex-col items-center gap-1.5">
              <div className="bg-black/40 rounded-xl p-2.5 border border-white/10">
                <img src={qrUrl} alt="Treasury QR" width={140} height={140} className="rounded-lg" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success state */}
      {success && (
        <div className="glass rounded-2xl p-4 mb-3 border border-green-400/25 bg-green-500/10 text-center">
          <CheckCircle2 size={24} className="text-green-400 mx-auto mb-1.5" />
          <p className="text-green-300 font-black text-sm">+{success.goldCredited} GOLD Credited!</p>
          <p className="text-white/40 text-[11px] mt-0.5">{success.farmAmount} $FARM converted</p>
          <button
            onClick={() => setSuccess(null)}
            className="mt-2 text-white/40 text-[10px] underline"
          >
            Deposit more
          </button>
        </div>
      )}

      {/* TX Hash input */}
      {!success && (
        <>
          <div className="glass rounded-2xl flex items-center overflow-hidden mb-3">
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value.trim())}
              placeholder="Paste txHash (0x…)"
              disabled={mutation.isPending}
              className="flex-1 bg-transparent px-3.5 py-3 text-white text-xs outline-none placeholder:text-white/30 disabled:opacity-50 font-mono"
            />
          </div>

          {mutation.isError && (
            <p className="text-red-400 text-xs text-center mb-3 leading-snug">
              {(mutation.error as Error)?.message ?? 'Verification failed'}
            </p>
          )}

          <button
            disabled={!canVerify}
            onClick={() => mutation.mutate(txHash)}
            className="w-full py-3.5 rounded-2xl font-black text-xs active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 text-white"
            style={{
              background: canVerify ? 'linear-gradient(135deg, #059669, #047857)' : undefined,
              boxShadow: canVerify ? '0 0 20px rgba(5,150,105,0.4)' : undefined,
            }}
          >
            {mutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Verifying…</>
            ) : (
              <><ArrowDownLeft size={14} /> Verify Deposit &amp; Credit GOLD</>
            )}
          </button>
        </>
      )}

      <p className="text-white/20 text-[9px] text-center mt-3 leading-relaxed">
        Only send from your linked wallet · Min 1 $FARM
      </p>
    </div>
  );
}

// ── Treasury Auto Buyback & Burn Tab ──────────────────────────────────────────
function TreasuryVaultTab({ onGoToDex }: { onGoToDex: () => void }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);

  const { data: status, isFetching, refetch } = useQuery<TreasuryStatus>({
    queryKey: ['treasury-status'],
    queryFn: () => api.getTreasuryStatus(),
    refetchInterval: 15000,
  });

  const triggerMutation = useMutation({
    mutationFn: () => api.triggerTreasuryBuyBack(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury-status'] });
      try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success'); } catch {}
    },
    onError: () => {
      try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('error'); } catch {}
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const bnbBalanceNum = status ? parseFloat(status.bnbBalance) : 0;
  const thresholdNum = status ? parseFloat(status.buyBackThreshold) : 2.0;
  const progress = status ? Math.min(100, Math.max(0, status.progressPercent)) : 0;
  const totalBurnedNum = status ? parseFloat(status.totalBurned) : 0;
  const totalBnbSpentNum = status ? parseFloat(status.totalBnbSpent) : 0;
  const remainingBnb = Math.max(0, thresholdNum - bnbBalanceNum);
  const usdtBalanceNum = status ? parseFloat(status.usdtBalance ?? '0') : 0;
  const usdtThresholdNum = status ? parseFloat(status.usdtConversionThreshold ?? '50') : 50;
  const usdtProgress = status ? Math.min(100, Math.max(0, status.usdtConversionProgressPercent ?? 0)) : 0;
  const totalUsdtConvertedNum = status ? parseFloat(status.totalUsdtConverted ?? '0') : 0;
  const totalGoldConvertedNum = status?.totalGoldConverted ? parseFloat(status.totalGoldConverted) : 0;

  return (
    <div className="space-y-3">
      {/* Top Banner / Philosophy */}
      <div className="rounded-2xl p-3 bg-gradient-to-br from-rose-950/70 via-orange-950/50 to-neutral-900 border border-rose-500/30">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
              <Flame size={18} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                Auto Buyback & Burn
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  Deflation Engine
                </span>
              </h3>
              <p className="text-[10px] text-white/50">Market Psychology & Autonomous Price Support</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 glass rounded-lg text-white/60 hover:text-white transition-all active:scale-95"
            title="Refresh Vault Status"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin text-amber-400' : ''} />
          </button>
        </div>

        <p className="text-[11px] text-white/70 leading-relaxed">
          BNB from game revenue, premium pulls, cashout fees, and NFT marketplace accumulates here. When the vault hits{' '}
          <span className="font-bold text-amber-400 font-mono">{thresholdNum.toFixed(2)} BNB</span>, the smart contract
          executes an automated market buyback of <span className="font-bold text-rose-400">$FARM</span> on PancakeSwap V2 and routes
          tokens directly to the <span className="font-bold text-white font-mono">DEAD Address</span> — permanently burned.
        </p>
      </div>

      {/* Progress Springboard Card ("Psychological Springboard") */}
      <div className="glass rounded-2xl p-3.5 border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-white/40">Vault Accumulation</span>
            <div className="text-xl font-black font-mono text-white flex items-baseline gap-1 mt-0.5">
              <span className="text-amber-400">{bnbBalanceNum.toFixed(6)}</span>
              <span className="text-xs text-white/40">/ {thresholdNum.toFixed(2)} BNB</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider font-bold text-white/40">Trigger Progress</span>
            <div className="text-lg font-black font-mono text-rose-400 mt-0.5">
              {progress.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="relative w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
          <div
            className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
            style={{ width: `${Math.min(100, Math.max(3, progress))}%` }}
          />
        </div>

        {/* Status Callout */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-[11px]">
            {status?.isReady ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-bold text-emerald-400">Threshold Reached! Primed to Burn</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-white/60">
                  Need <span className="font-bold text-amber-300 font-mono">{remainingBnb.toFixed(4)} BNB</span> to trigger
                </span>
              </>
            )}
          </div>
          <span className="text-[10px] text-white/40 font-mono">
            Auto-checks every 1 min
          </span>
        </div>

        {/* Trigger Button if ready */}
        {status?.isReady && (
          <button
            type="button"
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            className="w-full mt-2 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white shadow-lg shadow-rose-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {triggerMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Executing On-Chain Buyback & Burn...</span>
              </>
            ) : (
              <>
                <Flame size={14} />
                <span>Trigger Instant Buyback & Burn Now</span>
              </>
            )}
          </button>
        )}
        {triggerMutation.isSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 text-center font-bold flex flex-col gap-1">
            <span>🔥 Buyback triggered! $FARM is being burned on-chain.</span>
            {(triggerMutation.data as any)?.txHash && (
              <a
                href={`https://testnet.bscscan.com/tx/${(triggerMutation.data as any).txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 underline font-mono"
              >
                View Burn Tx on BscScan <ExternalLink size={9} />
              </a>
            )}
          </div>
        )}
        {triggerMutation.isError && (
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 text-center font-bold">
            {(triggerMutation.error as any)?.message || 'Buyback execution failed. Retrying in background worker.'}
          </div>
        )}
      </div>

      {/* USDT Cashout Fee Pipeline (SA IMPL-01/02) — always visible */}
      <div className="glass rounded-2xl p-3 border border-teal-500/20 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <span className="text-[11px]">💵</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-teal-300/70">USDT Fee Pipeline</span>
          </div>
          {status?.isUsdtReady ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 font-bold">
              Ready to Convert
            </span>
          ) : (
            <span className="text-[9px] text-white/30 font-mono">
              {usdtProgress.toFixed(0)}% full
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-white/40">Accumulated (cashout fees)</div>
            <div className="text-sm font-black font-mono text-teal-300">
              ${usdtBalanceNum.toFixed(2)}
              <span className="text-[10px] text-white/40 font-normal ml-1">/ ${usdtThresholdNum.toFixed(0)} USDT</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-white/40">Total Converted</div>
            <div className="text-xs font-bold font-mono text-white/60">${totalUsdtConvertedNum.toFixed(2)}</div>
          </div>
        </div>
        <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(usdtBalanceNum > 0 ? 3 : 0, usdtProgress))}%` }}
          />
        </div>
        <p className="text-[9px] text-white/30 leading-relaxed">
          1% cashout fee on FARM→USDT swaps accumulates here. Auto-converts to BNB at ${usdtThresholdNum.toFixed(0)} threshold to grow the buyback reserve.
        </p>
      </div>

      {/* Cumulative Metrics Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass rounded-2xl p-3 border border-white/5">
          <div className="flex items-center gap-1 text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">
            <Flame size={12} className="text-rose-400" />
            Total $FARM Burned
          </div>
          <div className="text-base font-black font-mono text-rose-400 truncate">
            {totalBurnedNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </div>
          <div className="text-[9px] text-white/40 mt-0.5">Buybacks + gacha + fusion burns</div>
        </div>

        <div className="glass rounded-2xl p-3 border border-white/5">
          <div className="flex items-center gap-1 text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">
            <Fuel size={12} className="text-amber-400" />
            Total BNB Deployed
          </div>
          <div className="text-base font-black font-mono text-amber-400 truncate">
            {totalBnbSpentNum.toFixed(4)} BNB
          </div>
          <div className="text-[9px] text-white/40 mt-0.5">Direct market purchase</div>
        </div>

        <div className="glass rounded-2xl p-3 border border-white/5 col-span-2">
          <div className="flex items-center gap-1 text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">
            <Coins size={12} className="text-yellow-400" />
            Total GOLD Converted → $FARM
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-black font-mono text-yellow-400 truncate">
              {totalGoldConvertedNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} GOLD
            </span>
          </div>
          <div className="text-[9px] text-white/40 mt-0.5">Off-chain GOLD burned via claim conversions (all time)</div>
        </div>
      </div>

      {/* Proof of Burn & Contract Verification Section */}
      <div className="glass rounded-2xl p-3 border border-white/5 space-y-2">
        <div className="text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
          <span>Proof of Burn & Verified Contracts</span>
          <span className="text-[9px] text-emerald-400 flex items-center gap-1">
            <ShieldCheck size={11} /> 100% Trustless
          </span>
        </div>

        {/* Treasury Contract Address */}
        <div className="bg-white/5 rounded-xl p-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[9px] text-white/40 font-bold uppercase">Treasury Contract</div>
            <div className="text-[11px] font-mono text-white/80 truncate">
              {status?.contractAddress ? shortAddr(status.contractAddress) : '0xe59Ff...15006'}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => copyToClipboard(status?.contractAddress || '0xe59FfB05EdF59464e8803E81A4d790d828915006', 'treasury')}
              className="p-1 text-white/40 hover:text-white transition-all"
              title="Copy Address"
            >
              {copied === 'treasury' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
            <a
              href={`https://testnet.bscscan.com/address/${status?.contractAddress || '0xe59FfB05EdF59464e8803E81A4d790d828915006'}`}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-white/40 hover:text-white transition-all"
              title="View on BscScan"
            >
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Burn Address (DEAD) */}
        <div className="bg-white/5 rounded-xl p-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[9px] text-white/40 font-bold uppercase flex items-center gap-1">
              <span>Dead Burn Wallet</span>
              <span className="text-[8px] text-rose-400 font-normal">(Tokens Locked Forever)</span>
            </div>
            <div className="text-[11px] font-mono text-rose-300/90 truncate">
              0x0000...dEaD
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => copyToClipboard('0x000000000000000000000000000000000000dEaD', 'dead')}
              className="p-1 text-white/40 hover:text-white transition-all"
              title="Copy DEAD Address"
            >
              {copied === 'dead' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
            <a
              href="https://testnet.bscscan.com/token/0xB10067A034078E3FC8335Fb003eEF7334C44952f?a=0x000000000000000000000000000000000000dEaD"
              target="_blank"
              rel="noreferrer"
              className="p-1 text-white/40 hover:text-white transition-all"
              title="View Burned $FARM on BscScan"
            >
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Recent Buyback Events / History */}
      <div className="glass rounded-2xl p-3 border border-white/5 space-y-2">
        <div className="text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
          <span>Recent Buyback & Burn Events</span>
          <span className="text-[9px] text-white/40">On-Chain History</span>
        </div>

        {status?.recentEvents && status.recentEvents.length > 0 ? (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {status.recentEvents.map((ev, i) => (
              <a
                key={i}
                href={`https://testnet.bscscan.com/tx/${ev.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 text-xs group"
              >
                <div className="min-w-0">
                  <div className="font-bold text-white flex items-center gap-1">
                    <span className="text-rose-400">🔥 -{parseFloat(ev.farmBurned).toLocaleString(undefined, { maximumFractionDigits: 1 })} $FARM</span>
                  </div>
                  <div className="text-[9px] text-white/40 font-mono">
                    {ev.txHash.slice(0, 10)}...{ev.txHash.slice(-6)} · {new Date(ev.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold text-amber-400">
                    {parseFloat(ev.bnbSpent).toFixed(4)} BNB
                  </span>
                  <ExternalLink size={11} className="text-white/40 group-hover:text-white" />
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white/5 border border-dashed border-white/10 text-center">
            <Flame size={20} className="mx-auto text-rose-400/50 mb-1" />
            <p className="text-xs font-bold text-white/70">Autonomous Vault Is Primed</p>
            <p className="text-[10px] text-white/40 mt-0.5">
              First automated buyback will execute when BNB vault hits 2.00 BNB. All farm actions contribute to this pool!
            </p>
          </div>
        )}
      </div>

      {/* CTA to Swap on PancakeSwap */}
      <button
        type="button"
        onClick={onGoToDex}
        className="w-full py-2.5 rounded-xl border border-violet-500/30 bg-violet-950/30 hover:bg-violet-900/40 text-violet-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
      >
        <Sparkles size={13} />
        Trade $FARM on PancakeSwap DEX →
      </button>
    </div>
  );
}

// ── In-App DEX PancakeSwap Tab ────────────────────────────────────────────────
function DexPancakeSwapTab({
  onGoToConvert,
  onSwapSuccess,
}: {
  onGoToConvert?: () => void;
  onSwapSuccess?: () => void;
}) {
  const dex = usePancakeSwap();

  return (
    <div className="flex flex-col gap-2.5">
      {/* ── Result Modal (Transaction Result Popup) ── */}
      {dex.showResultModal && dex.receipt && (
        <SwapResultModal
          receipt={dex.receipt}
          onClose={() => {
            dex.dismissResultModal();
            onSwapSuccess?.();
          }}
          onRetry={dex.receipt.status === 'error' ? dex.swap : undefined}
          onGoToConvert={() => {
            dex.dismissResultModal();
            onSwapSuccess?.();
            onGoToConvert?.();
          }}
        />
      )}

      {/* Rate & Info Bar */}
      <div className="glass rounded-2xl p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-white/80">PancakeSwap V2 AMM</span>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 font-bold">{dex.rateText}</span>
      </div>

      {/* Multi-Pair Token Toggle: BNB vs USDT */}
      <div
        className="flex items-center gap-1.5 p-1 glass rounded-2xl bg-black/40 border border-white/10"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dex.setBaseToken('BNB');
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          disabled={dex.step === 'swapping' || dex.step === 'approving'}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            dex.baseToken === 'BNB'
              ? 'bg-amber-500 text-black shadow-lg font-black'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🟡</span>
          <span>BNB / FARM</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dex.setBaseToken('USDT');
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          disabled={dex.step === 'swapping' || dex.step === 'approving'}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            dex.baseToken === 'USDT'
              ? 'bg-emerald-500 text-black shadow-lg font-black'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>💵</span>
          <span>USDT / FARM</span>
        </button>
      </div>

      {/* Re-open Receipt Button if user closed popup previously */}
      {dex.receipt && !dex.showResultModal && dex.receipt.status === 'success' && (
        <button
          type="button"
          onClick={dex.openResultModal}
          className="glass rounded-xl p-2.5 flex items-center justify-between text-xs text-white/80 hover:text-white transition-all border border-emerald-500/25 bg-emerald-500/10 active:scale-98"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400" />
            <span className="font-bold">
              Last Swap: {dex.receipt.fromAmount} {dex.receipt.fromToken} → +{dex.receipt.toAmount} {dex.receipt.toToken}
            </span>
          </div>
          <span className="text-[10px] text-amber-300 font-bold underline">View Receipt</span>
        </button>
      )}

      {/* From Box */}
      <div className="rounded-2xl bg-black/30 border border-white/5 p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/40 font-bold uppercase text-[9px] tracking-wider">You Pay</span>
          <span className="text-white/60 font-mono">
            Bal: {dex.fromBalanceDisplay} {dex.fromToken}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <input
            type="number"
            step="any"
            min="0"
            placeholder="0.0"
            value={dex.fromAmount}
            onChange={(e) => dex.setFromAmount(e.target.value)}
            disabled={dex.step === 'swapping' || dex.step === 'approving'}
            className="bg-transparent text-xl font-black text-white focus:outline-none w-full placeholder:text-white/20 font-mono"
          />
          <div className="glass rounded-xl px-2.5 py-1 flex items-center gap-1 font-bold text-xs text-white flex-shrink-0">
            <span>{dex.fromToken === 'BNB' ? '🟡' : dex.fromToken === 'USDT' ? '💵' : '💎'}</span>
            <span>{dex.fromToken}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="text-[9px] text-white/30">
            {dex.fromToken === 'BNB' ? 'Reserve: 0.002 BNB for gas' : 'Slippage: 2.0%'}
          </span>
          <div className="flex items-center gap-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => dex.setPercent(pct)}
                className="glass rounded px-1.5 py-0.5 text-[9px] font-bold text-amber-300 hover:bg-white/10 active:scale-95"
              >
                {pct === 100 ? 'MAX' : `${pct}%`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Central Flip Button */}
      <div className="flex justify-center -my-2 z-10">
        <button
          type="button"
          onClick={dex.toggleDirection}
          disabled={dex.step === 'swapping' || dex.step === 'approving'}
          className="w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center text-amber-400 hover:text-white active:scale-90 transition-all shadow-lg"
          title="Switch Swap Direction"
        >
          <ArrowUpDown size={14} />
        </button>
      </div>

      {/* To Box */}
      <div className="rounded-2xl bg-black/30 border border-white/5 p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/40 font-bold uppercase text-[9px] tracking-wider">You Receive (Est.)</span>
          <span className="text-white/60 font-mono">
            Bal: {dex.toBalanceDisplay} {dex.toToken}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xl font-black text-amber-300 font-mono flex items-center gap-2">
            {dex.isEstimating ? (
              <Loader2 size={16} className="animate-spin text-white/40" />
            ) : (
              <span>{dex.toAmount || '0.0'}</span>
            )}
          </div>
          <div className="glass rounded-xl px-2.5 py-1 flex items-center gap-1 font-bold text-xs text-white flex-shrink-0">
            <span>{dex.toToken === 'BNB' ? '🟡' : dex.toToken === 'USDT' ? '💵' : '💎'}</span>
            <span>{dex.toToken}</span>
          </div>
        </div>
      </div>

      {/* Min Received Info Row */}
      {dex.toAmount && Number(dex.toAmount) > 0 && (
        <div className="flex items-center justify-between px-1 -mt-1 text-[9px] text-white/40 font-mono">
          <span className="flex items-center gap-1">
            <Info size={9} className="text-white/30" />
            Min received (2% slippage{dex.direction === 'FARM_TO_USDT' ? ' + 1% cashout fee' : ''}):
          </span>
          <span className="font-bold text-white/60">
            {dex.minReceived} {dex.toToken}
          </span>
        </div>
      )}

      {/* FARM→USDT gateway fee notice */}
      {dex.direction === 'FARM_TO_USDT' && (
        <div className="flex items-start gap-1.5 px-1 py-1 rounded-lg bg-teal-500/5 border border-teal-500/15 text-[9px] text-teal-300/70 -mt-0.5">
          <Info size={9} className="mt-0.5 shrink-0 text-teal-400/60" />
          <span>Routed via WalletGateway: 1% cashout fee deducted from gross USDT, sent to Treasury to grow the buyback reserve.</span>
        </div>
      )}

      {/* Kill switch warning */}
      {dex.killSwitchActive && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-[11px] text-red-300">
          <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
          <span>Swapping paused — market volatility too high. The system will auto-resume when price stabilizes.</span>
        </div>
      )}

      {/* Error Notice */}
      {dex.error && (
        <div className="glass rounded-xl p-2 border border-red-500/20 bg-red-500/10 text-red-300 text-[11px] text-center">
          {dex.error}
        </div>
      )}

      {/* Action Button */}
      <button
        type="button"
        onClick={() => dex.swap()}
        disabled={dex.step === 'swapping' || dex.step === 'approving' || !dex.fromAmount || dex.insufficientBalance || dex.killSwitchActive}
        className="w-full py-3.5 rounded-2xl font-black text-xs active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 text-black"
        style={{
          background: dex.killSwitchActive
            ? '#374151'
            : dex.insufficientBalance
            ? '#ef4444'
            : 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: dex.insufficientBalance || dex.killSwitchActive ? '#fff' : '#000',
        }}
      >
        {dex.step === 'approving' && <><Loader2 size={14} className="animate-spin" /> Approving {dex.fromToken}…</>}
        {dex.step === 'swapping' && <><Loader2 size={14} className="animate-spin" /> Swapping on PancakeSwap…</>}
        {dex.step !== 'approving' && dex.step !== 'swapping' && (
          dex.killSwitchActive
            ? 'Swap Paused — High Volatility'
            : dex.insufficientBalance
            ? `Insufficient ${dex.fromToken} Balance`
            : `Swap ${dex.fromToken} → ${dex.toToken}`
        )}
      </button>
    </div>
  );
}

// ── Daily Cashout Quota & Dynamic Drip-Feed Component ──────────────────────────
function CashoutQuotaCard({
  quota,
  loading,
}: {
  quota?: CashoutQuota;
  loading: boolean;
}) {
  if (loading || !quota) {
    return (
      <div className="glass rounded-2xl p-3 mb-3 animate-pulse bg-white/5 flex items-center justify-between border border-white/5">
        <div className="h-4 bg-white/10 rounded w-1/3"></div>
        <div className="h-4 bg-white/10 rounded w-1/4"></div>
      </div>
    );
  }

  const userLimit = quota.userDailyLimit || 1;
  const userSpent = quota.userSpentToday || 0;
  const userUsedPct = Math.min(100, Math.max(0, Math.round((userSpent / userLimit) * 100)));
  const userRemaining = quota.userRemaining || 0;

  const globalPool = quota.globalDailyPool || 1;
  const globalSpent = quota.globalSpentToday || 0;
  const globalRemaining = quota.globalRemaining || 0;

  // Tier styling
  const tierBorder =
    quota.tier === 3
      ? 'border-amber-400/40 from-amber-500/15 via-yellow-500/10 to-amber-900/20'
      : quota.tier === 2
      ? 'border-purple-400/40 from-purple-500/15 via-violet-500/10 to-indigo-900/20'
      : quota.tier === 1
      ? 'border-emerald-400/40 from-emerald-500/15 via-teal-500/10 to-emerald-900/20'
      : 'border-zinc-600/40 from-zinc-700/20 to-zinc-900/30';

  const tierBadgeBg =
    quota.tier === 3
      ? 'bg-amber-400/20 text-amber-300 border-amber-400/30'
      : quota.tier === 2
      ? 'bg-purple-400/20 text-purple-300 border-purple-400/30'
      : quota.tier === 1
      ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30'
      : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';

  const tierEmoji = quota.tier === 3 ? '👑' : quota.tier === 2 ? '⭐' : quota.tier === 1 ? '🌱' : '⚠️';

  return (
    <div className={`glass rounded-2xl p-3 mb-3 border bg-gradient-to-br ${tierBorder} flex flex-col gap-2 shadow-lg`}>
      {/* Top Header: Tier Badge & Reset UTC */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{tierEmoji}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${tierBadgeBg}`}>
            {quota.tierName} ({(quota.tierPercentage * 100).toFixed(2)}%)
          </span>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-white/50 font-mono">
          <span>Resets 00:00 UTC</span>
        </div>
      </div>

      {/* Personal Daily Limit Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-white/70 font-semibold">Your Daily Quota:</span>
          <span className="font-mono font-bold text-white">
            <span className={userRemaining > 0 ? 'text-emerald-400' : 'text-red-400'}>
              {userRemaining.toFixed(2)}
            </span>
            <span className="text-white/40"> / {userLimit.toFixed(2)} $FARM</span>
          </span>
        </div>
        <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden p-0.5 border border-white/5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              userUsedPct > 90
                ? 'bg-gradient-to-r from-red-500 to-rose-600'
                : userUsedPct > 60
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400'
            }`}
            style={{ width: `${Math.max(4, userUsedPct)}%` }}
          />
        </div>
      </div>

      {/* Global Drip-Feed Pool Status */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[9px] text-white/50">
        <span className="flex items-center gap-1">
          <span>Global Pool:</span>
          <span className="text-white/80 font-mono font-bold">
            {globalRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {globalPool.toLocaleString(undefined, { maximumFractionDigits: 0 })} $FARM
          </span>
        </span>
        <span className="font-mono text-white/40">
          Release Rate: {(quota.releaseRate * 100).toFixed(1)}%{quota.priceGrowth24h !== 0 ? ` · ${quota.priceGrowth24h >= 0 ? '+' : ''}${quota.priceGrowth24h}% 24h` : ''}
        </span>
      </div>
    </div>
  );
}

// ── Main Modal Component ──────────────────────────────────────────────────────
export function ClaimModal({ onClose, initialTab = 'convert' }: Props) {
  const { profile } = useGame();
  const qc = useQueryClient();

  // Web3 & Dynamic Rates
  const dynamic = useDynamicRates(15_000);
  const { data: quota, isLoading: quotaLoading, refetch: refetchQuota } = useCashoutQuota(15_000);
  const { data: depositInfo } = useQuery({
    queryKey: ['depositInfo'],
    queryFn: api.getDepositInfo,
    staleTime: 5 * 60 * 1000,
  });
  const { dexTier } = useDexTier();
  const { claim, refund, step, txHash, error, reset, refundable, refunding } = useClaimTokens();

  // Local state
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  const [direction, setDirection] = useState<ConvertDirection>('GOLD_TO_FARM');
  const [amountInput, setAmountInput] = useState('');
  const [depositStep, setDepositStep] = useState<DepositStep>('idle');
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null);
  const [depositResult, setDepositResult] = useState<DepositResultData | null>(null);
  const [directDepositError, setDirectDepositError] = useState<string | null>(null);

  // Real-time Treasury status for Auto Buyback & Burn progress
  const { data: treasuryStatus } = useQuery<TreasuryStatus>({
    queryKey: ['treasury-status'],
    queryFn: () => api.getTreasuryStatus(),
    refetchInterval: 15000,
  });

  // Balances
  const [bnbBalance,  setBnbBalance]  = useState<bigint | null>(null);
  const [farmBalance, setFarmBalance] = useState<bigint | null>(null);
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);
  const [balLoading,  setBalLoading]  = useState(false);

  const { address, account: signerAccount, canSign, walletLocked } = useActiveWallet(profile);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setBalLoading(true);
    const publicClient = createPublicClient({ chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });

    await Promise.all([
      publicClient.getBalance({ address })
        .then(setBnbBalance)
        .catch(() => {}),

      publicClient.getGasPrice()
        .then((gp) => setGasEstimate(gp * CLAIM_GAS_LIMIT))
        .catch(() => {}),

      publicClient.readContract({
        address: FARM_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      })
        .then((v) => setFarmBalance(v as bigint))
        .catch(() => setFarmBalance(0n)),
    ]);

    setBalLoading(false);
  }, [address]);

  // Refetch balances on mount and whenever switching between tabs
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances, activeTab]);

  // Real-time synchronization: update balances instantly when swap or transaction completes
  useEffect(() => {
    const unsub = eventBus.on('wallet-balance-updated', (ev) => {
      if (ev.bnb !== null && ev.bnb !== undefined) {
        setBnbBalance(ev.bnb);
      }
      if (ev.farm !== null && ev.farm !== undefined) {
        setFarmBalance(ev.farm);
      }
      fetchBalances();
    });
    return unsub;
  }, [fetchBalances]);

  useEffect(() => {
    if (step === 'success') {
      fetchBalances();
      refetchQuota();
      qc.invalidateQueries({ queryKey: ['cashout-quota'] });
      qc.invalidateQueries({ queryKey: ['treasury-status'] });
    }
  }, [step, fetchBalances, refetchQuota, qc]);

  // Auto-refund any pending claims on mount
  useEffect(() => {
    api.refundAllPendingClaims()
      .then((res) => {
        if (res.refundedCount > 0) {
          qc.invalidateQueries({ queryKey: ['profile'] });
        }
      })
      .catch(() => {});
  }, [qc]);

  // Calculations for In-Game Converter
  const goldBalance = Number(profile?.goldBalance ?? 0);
  const farmFloat = farmBalance !== null ? parseFloat(formatEther(farmBalance)) : 0;
  const parsedInput = parseFloat(amountInput) || 0;

  // Real-time output calculation
  const calculatedOutput = useMemo(() => {
    if (!parsedInput || parsedInput <= 0) return 0;
    if (direction === 'GOLD_TO_FARM') {
      return dynamic.calculateFarmFromGold(parsedInput);
    } else {
      return dynamic.calculateGoldFromFarm(parsedInput);
    }
  }, [direction, parsedInput, dynamic]);

  // Quick percentage handler (smartly capped by daily quota for cashout)
  const handleSetPercent = (pct: number) => {
    try {
      (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    } catch {}
    if (direction === 'GOLD_TO_FARM') {
      const maxGoldFromQuota =
        quota && quota.userRemaining > 0 && dynamic.withdrawRate > 0
          ? Math.floor(quota.userRemaining / dynamic.withdrawRate)
          : goldBalance;
      const maxGold = Math.min(goldBalance, MAX_CLAIM_GOLD, maxGoldFromQuota);
      const val = Math.floor((maxGold * pct) / 100);
      setAmountInput(val > 0 ? String(val) : '');
    } else {
      const val = pct === 100
        ? (Math.floor(farmFloat * 100) / 100)
        : (Math.floor((farmFloat * pct) / 100 * 100) / 100);
      setAmountInput(val > 0 ? String(val) : '');
    }
  };

  const resetDeposit = () => {
    setDepositStep('idle');
    setDepositTxHash(null);
    setDirectDepositError(null);
    setDepositResult(null);
  };

  // Flip direction
  const handleToggleDirection = () => {
    setDirection((d) => (d === 'GOLD_TO_FARM' ? 'FARM_TO_GOLD' : 'GOLD_TO_FARM'));
    setAmountInput('');
    resetDeposit();
    try {
      (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    } catch {}
  };

  // 1-Click Direct Deposit of $FARM
  const handleDirectDeposit = async () => {
    if (parsedInput < 1) {
      setDirectDepositError('Minimum deposit is 1 $FARM');
      return;
    }
    if (parsedInput > farmFloat) {
      setDirectDepositError(`Insufficient $FARM balance. You have ${farmFloat.toFixed(2)} $FARM, but entered ${parsedInput} $FARM.`);
      return;
    }
    if (!canSign || !signerAccount) {
      setDirectDepositError(
        walletLocked
          ? 'Wallet not signable on this device — import the correct key in Settings → BSC Wallet.'
          : 'No wallet found. Please reconnect in Settings.'
      );
      return;
    }

    setDepositStep('preparing');
    setDepositTxHash(null);
    setDirectDepositError(null);
    setDepositResult(null);

    try {
      const account = signerAccount;
      const walletClient = createWalletClient({
        account,
        chain: bscTestnet,
        transport: http(BSC_TESTNET_RPC),
      });
      const publicClient = createPublicClient({
        chain: bscTestnet,
        transport: http(BSC_TESTNET_RPC),
      });

      // Get treasury address
      const info = depositInfo || (await api.getDepositInfo());
      const treasury = (info?.treasuryAddress || '0xB32d81dB128e7739Ad21C4023d2EaF53bb3078A5') as `0x${string}`;
      if (!treasury) throw new Error('Treasury address unavailable');

      const farmTokenAddress = (info?.farmTokenAddress as `0x${string}`) || FARM_ADDRESS;
      const amountWei = parseEther(parsedInput.toString());

      setDepositStep('broadcasting');

      // Transfer $FARM directly to Treasury
      const hash = await walletClient.writeContract({
        address: farmTokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [treasury, amountWei],
      });

      setDepositTxHash(hash);
      setDepositStep('confirming');

      // Wait for on-chain confirmation
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify on backend
      setDepositStep('verifying');
      const res = await api.verifyDeposit(hash);

      const resultData: DepositResultData = {
        goldCredited: res.goldCredited,
        goldBalance: res.goldBalance,
        txHash: hash,
        farmAmount: res.farmAmount || parsedInput,
        depositRate: res.depositRate || dynamic.depositRate,
        senderAddress: account.address,
        treasuryAddress: treasury,
      };

      setDepositResult(resultData);
      setDepositStep('success');
      setAmountInput('');
      try {
        (window as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
      } catch {}
      qc.invalidateQueries({ queryKey: ['profile'] });
      fetchBalances();
    } catch (err: any) {
      setDepositStep('error');
      const msg = err?.message ?? 'Transfer failed';
      if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
        setDirectDepositError('Insufficient BNB for gas or insufficient $FARM balance.');
      } else {
        setDirectDepositError(msg.slice(0, 140));
      }
    }
  };

  // Retry verification for an already broadcasted on-chain deposit
  const handleRetryVerification = async () => {
    if (!depositTxHash) return;
    setDepositStep('verifying');
    setDirectDepositError(null);
    try {
      const res = await api.verifyDeposit(depositTxHash);
      const info = depositInfo || (await api.getDepositInfo().catch(() => null));
      const treasury = (info?.treasuryAddress || '0xB32d81dB128e7739Ad21C4023d2EaF53bb3078A5') as string;
      const resultData: DepositResultData = {
        goldCredited: res.goldCredited,
        goldBalance: res.goldBalance,
        txHash: depositTxHash,
        farmAmount: res.farmAmount || parsedInput,
        depositRate: res.depositRate || dynamic.depositRate,
        senderAddress: address || '',
        treasuryAddress: treasury,
      };

      setDepositResult(resultData);
      setDepositStep('success');
      setAmountInput('');
      try {
        (window as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
      } catch {}
      qc.invalidateQueries({ queryKey: ['profile'] });
      fetchBalances();
    } catch (err: any) {
      setDepositStep('error');
      setDirectDepositError(err?.message ?? 'Verification failed');
    }
  };

  const isDepositBusy = depositStep === 'preparing' || depositStep === 'broadcasting' || depositStep === 'confirming' || depositStep === 'verifying';
  const isBusy = step === 'requesting_sig' || step === 'sending_tx' || step === 'confirming' || isDepositBusy;
  const trustOk = (profile?.trustScore ?? 0) >= 30;
  const hasBnb = bnbBalance === null || bnbBalance >= MIN_BNB_FOR_GAS;
  const insufficientFarm = direction === 'FARM_TO_GOLD' && parsedInput > farmFloat;

  // Dual-Layer Cashout conditions
  const tierZero = direction === 'GOLD_TO_FARM' && quota !== undefined && quota.tier === 0;
  const quotaExceeded =
    direction === 'GOLD_TO_FARM' &&
    parsedInput > 0 &&
    quota !== undefined &&
    calculatedOutput > (quota.userRemaining ?? 0);
  const globalPoolExhausted =
    direction === 'GOLD_TO_FARM' &&
    quota !== undefined &&
    ((quota.globalRemaining ?? 0) <= 0 || calculatedOutput > (quota.globalRemaining ?? 0));

  const canConvertGold = direction === 'GOLD_TO_FARM' &&
    parsedInput >= dynamic.minGoldForOneFarm &&
    parsedInput <= goldBalance &&
    hasBnb &&
    !isBusy &&
    trustOk &&
    !dynamic.killSwitchActive &&
    !tierZero &&
    !quotaExceeded &&
    !globalPoolExhausted;

  const canConvertFarm = direction === 'FARM_TO_GOLD' &&
    parsedInput >= 1 &&
    parsedInput <= farmFloat &&
    hasBnb &&
    !isBusy;

  useEffect(() => {
    eventBus.setOverlay('ClaimModal', true);
    return () => {
      eventBus.setOverlay('ClaimModal', false);
    };
  }, []);

  const handleClose = () => {
    reset();
    resetDeposit();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/75 backdrop-blur-sm"
      onClick={handleClose}
      onPointerDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="relative w-full max-w-2xl bg-zinc-950/95 border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden mx-auto slide-up p-4 pb-6 pointer-events-auto"
        style={{
          maxHeight: 'calc(var(--tg-viewport-stable-height, 100vh) - 30px)',
          paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)) + 80px)',
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-3 flex-shrink-0" />

        <div className="overflow-y-auto max-h-full pr-0.5">
          {/* ── HEADER ── */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 font-black text-lg">$FARM Portal</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-bold border border-violet-400/30">
                  Dynamic Peg
                </span>
              </div>
              <p className="text-white/40 text-[10px] mt-0.5">
                1 GOLD = $0.0001 USD Intrinsic Anchor · BSC Testnet
              </p>
            </div>
            <button
              onClick={handleClose}
              className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
            >
              <X size={15} />
            </button>
          </div>

          {/* ── LIVE MARKET & ECONOMY TICKER ── */}
          <div className="glass-gold rounded-2xl p-3 mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs text-white/40 font-bold uppercase tracking-wider">Live $FARM Market</div>
              <div className="text-base font-black text-amber-400 font-mono">
                ${dynamic.farmPriceUsd.toFixed(6)}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] text-green-400 font-semibold">Live · PancakeSwap V2</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/40 font-bold uppercase tracking-wider">Economy Health (α)</div>
              <div className="text-xs font-black font-mono flex items-center justify-end gap-1">
                <span className={dynamic.alpha >= 1 ? 'text-emerald-400' : 'text-amber-300'}>
                  {dynamic.alpha.toFixed(2)}x
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                  dynamic.economyStatus === 'deflationary' ? 'bg-emerald-500/20 text-emerald-300' :
                  dynamic.economyStatus === 'inflationary' ? 'bg-amber-500/20 text-amber-300' :
                  'bg-blue-500/20 text-blue-300'
                }`}>
                  {dynamic.economyStatus === 'deflationary' ? 'Bonus' : dynamic.economyStatus === 'inflationary' ? 'Protected' : 'Balanced'}
                </span>
              </div>
              <div className="text-[9px] text-white/40 mt-0.5 font-mono">
                Pool: {Math.round(dynamic.treasuryFarmBalance).toLocaleString()} FARM
              </div>
            </div>
          </div>

          {/* ── AUTO BUYBACK & BURN MINI BANNER ("Psychological Springboard") ── */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('treasury');
              try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
            }}
            className="w-full mb-3 p-2.5 rounded-2xl bg-gradient-to-r from-rose-950/60 via-orange-950/40 to-neutral-900 border border-rose-500/30 flex items-center justify-between hover:border-rose-400/50 transition-all group active:scale-[0.99] text-left shadow-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-600 to-orange-500 flex items-center justify-center text-white shadow-md shadow-rose-500/30 shrink-0">
                <Flame size={16} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-rose-300 truncate">Auto Buyback Vault</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold shrink-0">
                    {treasuryStatus?.progressPercent !== undefined ? `${Math.min(100, Math.round(treasuryStatus.progressPercent))}%` : '2.0 BNB Goal'}
                  </span>
                </div>
                <div className="text-[10px] text-white/50 font-medium truncate">
                  {treasuryStatus
                    ? `${Number(treasuryStatus.bnbBalance).toFixed(6)} / ${treasuryStatus.buyBackThreshold} BNB · Auto-burns $FARM`
                    : 'PancakeSwap Auto-Burn Engine'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-rose-400 group-hover:text-rose-300 text-xs font-bold shrink-0 ml-2">
              <span>View</span>
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* ── 4 NAVIGATION TABS ── */}
          <div className="grid grid-cols-4 glass rounded-2xl p-1 mb-3 gap-1">
            <button
              onClick={() => {
                setActiveTab('convert');
                try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
              }}
              className={`py-2 px-1 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
                activeTab === 'convert'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Coins size={12} className="shrink-0" />
              <span className="truncate">Convert</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('dex');
                try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
              }}
              className={`py-2 px-1 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
                activeTab === 'dex'
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/20'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Sparkles size={12} className="shrink-0" />
              <span className="truncate">Swap</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('deposit_tx');
                try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
              }}
              className={`py-2 px-1 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
                activeTab === 'deposit_tx'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <ArrowDownLeft size={12} className="shrink-0" />
              <span className="truncate">Deposit</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('treasury');
                try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
              }}
              className={`py-2 px-1 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 relative ${
                activeTab === 'treasury'
                  ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-lg shadow-rose-500/25'
                  : 'text-rose-300/70 hover:text-rose-200'
              }`}
            >
              <Flame size={12} className="shrink-0 text-orange-400" />
              <span className="truncate">Vault</span>
              {treasuryStatus?.isReady && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
          </div>

          {/* ── TAB 1: GOLD ⇄ $FARM CONVERTER ── */}
          {activeTab === 'convert' && (
            <div>
              {/* Direction Sub-Tabs for Crystal-Clear Mode Choice */}
              <div className="flex bg-black/40 rounded-2xl p-1 mb-3 gap-1 border border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setDirection('GOLD_TO_FARM');
                    setAmountInput('');
                    resetDeposit();
                    try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    direction === 'GOLD_TO_FARM'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/20'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <span>📤</span>
                  <span>Cashout (GOLD → $FARM)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDirection('FARM_TO_GOLD');
                    setAmountInput('');
                    resetDeposit();
                    try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    direction === 'FARM_TO_GOLD'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <span>📥</span>
                  <span>Deposit ($FARM → GOLD)</span>
                </button>
              </div>
            {/* Wallet Info Card */}
            {address && (
              <WalletCard
                address={address}
                bnbBalance={bnbBalance}
                farmBalance={farmBalance}
                gasEstimate={gasEstimate}
                loading={balLoading}
                dexTier={dexTier}
                onOpenDex={() => setActiveTab('dex')}
              />
            )}

            {/* Step tracker when signing/confirming claim */}
            {isBusy && step !== 'idle' && <StepTracker step={step} />}

            {/* Step tracker when depositing $FARM -> GOLD */}
            {isDepositBusy && <DepositStepTracker step={depositStep} currentTxHash={depositTxHash} />}

            {/* Trust score warning */}
            {!trustOk && (
              <div className="glass rounded-xl p-2.5 mb-2.5 flex items-start gap-2 border border-red-500/20 bg-red-500/10">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-[11px]">
                  Trust score too low ({profile?.trustScore}/30). Play more to unlock conversion.
                </p>
              </div>
            )}

            {/* Kill-switch warning */}
            {dynamic.killSwitchActive && (
              <div className="glass rounded-xl p-2.5 mb-2.5 flex items-start gap-2 border border-red-500/20 bg-red-500/10">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-[11px]">
                  {dynamic.killSwitchReason ?? 'Conversion paused due to market volatility. Try again later.'}
                </p>
              </div>
            )}

            {/* Dual-Layer Protection: Daily Quota & Drip-Feed Pool Card */}
            {direction === 'GOLD_TO_FARM' && (
              <CashoutQuotaCard quota={quota} loading={quotaLoading} />
            )}

            {/* Quota limit warnings */}
            {direction === 'GOLD_TO_FARM' && tierZero && (
              <div className="glass rounded-xl p-2.5 mb-2.5 flex items-start gap-2 border border-red-500/30 bg-red-500/10">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-[11px]">
                  {quota?.reason ?? 'Your account is Tier 0. Link a BSC wallet and increase your trust score (30+) to enable cashouts.'}
                </p>
              </div>
            )}

            {direction === 'GOLD_TO_FARM' && !tierZero && quotaExceeded && (
              <div className="glass rounded-xl p-2.5 mb-2.5 flex items-start gap-2 border border-amber-500/30 bg-amber-500/10">
                <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300 text-[11px]">
                  Entered amount yields {calculatedOutput} $FARM, exceeding your remaining daily limit of {quota?.userRemaining.toFixed(2)} $FARM ({quota?.tierName}).
                </p>
              </div>
            )}

            {direction === 'GOLD_TO_FARM' && !tierZero && globalPoolExhausted && (
              <div className="glass rounded-xl p-2.5 mb-2.5 flex items-start gap-2 border border-red-500/30 bg-red-500/10">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-[11px]">
                  Global daily reward pool is exhausted ({quota?.globalSpentToday.toFixed(0)} / {quota?.globalDailyPool.toFixed(0)} $FARM). Resets at 00:00 UTC.
                </p>
              </div>
            )}

            {/* ── CONVERTER SWAP CARD ── */}
            <div className="glass rounded-2xl p-3 flex flex-col gap-2 relative mb-3">
              {/* FROM BOX */}
              <div className="rounded-xl bg-black/30 border border-white/5 p-2.5 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white/40 font-bold uppercase tracking-wider">
                    {direction === 'GOLD_TO_FARM' ? 'You Pay (In-Game)' : 'You Deposit (On-Chain)'}
                  </span>
                  <span className="text-white/60 font-mono">
                    Bal: {direction === 'GOLD_TO_FARM' ? `${goldBalance.toLocaleString()} GOLD` : `${farmFloat.toFixed(1)} FARM`}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="0"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    disabled={isBusy}
                    className="bg-transparent text-xl font-black text-white focus:outline-none w-full placeholder:text-white/20 font-mono"
                  />
                  <div className="glass rounded-xl px-2.5 py-1 flex items-center gap-1.5 font-bold text-xs text-white flex-shrink-0">
                    <span>{direction === 'GOLD_TO_FARM' ? '🌾' : '💎'}</span>
                    <span>{direction === 'GOLD_TO_FARM' ? 'GOLD' : '$FARM'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-[9px] text-white/30 font-mono">
                    {direction === 'GOLD_TO_FARM' ? `Min ~${dynamic.minGoldForOneFarm} GOLD` : 'Min 1 $FARM'}
                  </span>
                  <div className="flex items-center gap-1">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleSetPercent(pct)}
                        disabled={isBusy}
                        className="glass rounded px-1.5 py-0.5 text-[9px] font-bold text-amber-300 hover:bg-white/10 active:scale-95"
                      >
                        {pct === 100 ? 'MAX' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* FLIP DIRECTION BUTTON */}
              <div className="flex justify-center -my-2 z-10">
                <button
                  type="button"
                  onClick={handleToggleDirection}
                  disabled={isBusy}
                  className="w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center text-amber-400 hover:text-white active:scale-90 transition-all shadow-lg"
                  title="Switch Direction"
                >
                  <ArrowUpDown size={14} />
                </button>
              </div>

              {/* TO BOX */}
              <div className="rounded-xl bg-black/30 border border-white/5 p-2.5 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white/40 font-bold uppercase tracking-wider">
                    {direction === 'GOLD_TO_FARM' ? 'You Receive ($FARM to Wallet)' : 'You Receive (In-Game GOLD)'}
                  </span>
                  <span className="text-white/60 font-mono">
                    {direction === 'GOLD_TO_FARM' ? `Fee: ${dynamic.withdrawFeePct}%` : 'Fee: 0%'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-xl font-black text-amber-300 font-mono">
                    {calculatedOutput > 0
                      ? calculatedOutput.toLocaleString(undefined, {
                          maximumFractionDigits: direction === 'GOLD_TO_FARM' ? 4 : 2,
                        })
                      : '0'}
                  </div>
                  <div className="glass rounded-xl px-2.5 py-1 flex items-center gap-1.5 font-bold text-xs text-white flex-shrink-0">
                    <span>{direction === 'GOLD_TO_FARM' ? '💎' : '🌾'}</span>
                    <span>{direction === 'GOLD_TO_FARM' ? '$FARM' : 'GOLD'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Peg Rate Breakdown */}
            <div className="glass rounded-xl p-2.5 mb-3 text-[10px] space-y-1 text-white/50">
              <div className="flex items-center justify-between">
                <span>Effective Rate:</span>
                <span className="text-white font-mono font-bold">
                  {direction === 'GOLD_TO_FARM'
                    ? `1 $FARM ≈ ${dynamic.goldPerFarmWithdraw.toFixed(2)} GOLD`
                    : `1 $FARM = ${dynamic.depositRate.toFixed(2)} GOLD`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Base Peg Anchor:</span>
                <span className="text-white/70 font-mono">1 GOLD = $0.0001 USD</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Multiplier (α):</span>
                <span className="text-emerald-400 font-mono font-bold">{dynamic.alpha.toFixed(2)}x ({dynamic.economyStatus})</span>
              </div>
            </div>

            {/* Error or Success feedback */}
            {depositStep === 'error' && directDepositError && (
              <div className="glass rounded-xl p-3.5 mb-3 border border-red-500/30 bg-red-500/10 text-center">
                <AlertTriangle size={18} className="text-red-400 mx-auto mb-1" />
                <p className="text-red-300 text-xs font-bold leading-snug mb-1">
                  {depositTxHash ? 'On-Chain Transfer Sent, Verification Pending' : 'Deposit Unsuccessful'}
                </p>
                <p className="text-red-200/80 text-[11px] leading-relaxed mb-2">{directDepositError}</p>

                {depositTxHash && (
                  <div className="flex items-center justify-center gap-1.5 font-mono text-[11px] text-emerald-300 mb-2.5">
                    <span>Tx Hash:</span>
                    <a
                      href={`https://testnet.bscscan.com/tx/${depositTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline flex items-center gap-1 hover:text-emerald-200"
                    >
                      {shortAddr(depositTxHash)} <ExternalLink size={10} />
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2">
                  {depositTxHash ? (
                    <>
                      <button
                        onClick={handleRetryVerification}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shadow-md shadow-emerald-500/25"
                      >
                        <RefreshCw size={12} /> Retry Verification
                      </button>
                      <button
                        onClick={resetDeposit}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 text-xs font-bold transition-all active:scale-95"
                      >
                        Dismiss
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={resetDeposit}
                        className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all active:scale-95"
                      >
                        Dismiss &amp; Try Again
                      </button>
                      {insufficientFarm && (
                        <button
                          onClick={() => { resetDeposit(); setActiveTab('dex'); }}
                          className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-all active:scale-95 flex items-center gap-1"
                        >
                          <Sparkles size={11} /> Buy $FARM on PancakeSwap
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {step === 'success' && txHash && (
              <div className="glass rounded-xl p-3 mb-3 border border-green-500/25 bg-green-500/10 text-center">
                <CheckCircle2 size={20} className="text-green-400 mx-auto mb-1" />
                <p className="text-green-300 font-bold text-xs">Claim Successful!</p>
                <p className="text-white/40 text-[10px]">{calculatedOutput} $FARM transferred to your wallet</p>
                <a
                  href={`https://testnet.bscscan.com/tx/${txHash}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-violet-300 mt-1"
                >
                  View on BSCScan <ExternalLink size={9} />
                </a>
              </div>
            )}

            {(step === 'error' || error) && (
              <div className="glass rounded-xl p-2.5 mb-3 border border-red-500/25 bg-red-500/10 text-center">
                <p className="text-red-300 text-xs leading-snug mb-1">{error}</p>
                {refundable && (
                  <button
                    onClick={refund}
                    disabled={refunding}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[11px] font-bold"
                  >
                    {refunding ? <><Loader2 size={10} className="animate-spin" /> Refunding…</> : '↩ Refund GOLD'}
                  </button>
                )}
              </div>
            )}

            {/* ACTION BUTTON */}
            {direction === 'GOLD_TO_FARM' ? (
              <button
                disabled={!canConvertGold}
                onClick={() => claim(parsedInput)}
                className="w-full py-3.5 rounded-2xl font-black text-xs active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 text-white shadow-lg"
                style={{
                  background: canConvertGold ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : undefined,
                  boxShadow: canConvertGold ? '0 0 20px rgba(124,58,237,0.4)' : undefined,
                }}
              >
                <Gem size={14} />
                {isBusy && <Loader2 size={14} className="animate-spin" />}
                {step === 'idle' && (
                  tierZero
                    ? 'Tier 0 — Cashout Locked'
                    : globalPoolExhausted
                    ? 'Global Pool Empty — Resets 00:00 UTC'
                    : quotaExceeded
                    ? `Exceeds Daily Limit (Max ${quota?.userRemaining.toFixed(2)} FARM)`
                    : `Convert ${parsedInput > 0 ? parsedInput : ''} GOLD → ${calculatedOutput > 0 ? calculatedOutput : ''} $FARM`
                )}
                {step === 'requesting_sig' && 'Signing claim…'}
                {step === 'sending_tx' && 'Broadcasting to BSC…'}
                {step === 'confirming' && 'Waiting for confirmation…'}
                {step === 'error' && 'Retry Claim'}
                {step === 'success' && 'Done'}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  disabled={!canConvertFarm}
                  onClick={handleDirectDeposit}
                  className="w-full py-3.5 rounded-2xl font-black text-xs active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 text-white shadow-lg"
                  style={{
                    background: insufficientFarm
                      ? 'rgba(239, 68, 68, 0.25)'
                      : canConvertFarm
                      ? 'linear-gradient(135deg, #059669, #047857)'
                      : undefined,
                    border: insufficientFarm ? '1px solid rgba(239, 68, 68, 0.4)' : undefined,
                    color: insufficientFarm ? '#fca5a5' : '#fff',
                    boxShadow: canConvertFarm ? '0 0 20px rgba(5,150,105,0.4)' : undefined,
                  }}
                >
                  <ArrowDownLeft size={14} />
                  {isDepositBusy && <Loader2 size={14} className="animate-spin" />}
                  {depositStep === 'preparing' && 'Preparing wallet transaction…'}
                  {depositStep === 'broadcasting' && 'Broadcasting $FARM to BSC…'}
                  {depositStep === 'confirming' && 'Waiting for block confirmation…'}
                  {depositStep === 'verifying' && 'Verifying on-chain & crediting GOLD…'}
                  {!isDepositBusy && (
                    insufficientFarm
                      ? `Insufficient $FARM (You have ${farmFloat.toFixed(1)} $FARM)`
                      : `Deposit ${parsedInput > 0 ? parsedInput : ''} $FARM → +${calculatedOutput > 0 ? calculatedOutput : ''} GOLD`
                  )}
                </button>
                {insufficientFarm && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('dex')}
                    className="text-amber-400/90 hover:text-amber-300 text-[11px] font-bold text-center underline flex items-center justify-center gap-1 -mt-0.5 mb-1"
                  >
                    <Sparkles size={12} /> Need $FARM? Buy with BNB on PancakeSwap →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('deposit_tx')}
                  className="text-white/40 text-[10px] hover:text-white/70 text-center underline"
                >
                  Depositing from Binance or External Wallet? Use Manual Tx →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Transaction Receipt Result Popup Sub-Modal ── */}
        {depositResult && (
          <DepositReceiptModal
            data={depositResult}
            onClose={resetDeposit}
            onContinue={() => {
              resetDeposit();
              onClose();
            }}
          />
        )}

        {/* ── TAB 2: PANCAKESWAP DEX SWAP ── */}
        {activeTab === 'dex' && (
          <DexPancakeSwapTab
            onGoToConvert={() => {
              setActiveTab('convert');
              setDirection('FARM_TO_GOLD');
              fetchBalances();
            }}
            onSwapSuccess={() => {
              fetchBalances();
            }}
          />
        )}

        {/* ── TAB 3: MANUAL DEPOSIT TX ── */}
        {activeTab === 'deposit_tx' && (
          <ManualDepositTab
            depositInfo={depositInfo || { treasuryAddress: '0xB32d81dB128e7739Ad21C4023d2EaF53bb3078A5' }}
            onSuccess={() => fetchBalances()}
          />
        )}

        {/* ── TAB 4: TREASURY BUYBACK & BURN VAULT ── */}
        {activeTab === 'treasury' && (
          <TreasuryVaultTab
            onGoToDex={() => setActiveTab('dex')}
          />
        )}
        </div>
      </div>
    </div>
  );
}
