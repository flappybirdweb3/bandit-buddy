import { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, X, Copy, Check, ExternalLink,
  ArrowUpDown, Coins, ArrowRight,
} from 'lucide-react';
import type { SwapDirection } from '@/hooks/usePancakeSwap';

export interface SwapReceipt {
  status: 'success' | 'error';
  direction: SwapDirection;
  fromAmount: string;
  fromToken: string;
  toAmount: string;
  toToken: string;
  txHash?: `0x${string}` | null;
  errorMessage?: string;
  walletAddress?: string;
  farmBalanceAfter?: string;
  bnbBalanceAfter?: string;
  usdtBalanceAfter?: string;
  timestamp: number;
}

export interface SwapResultModalProps {
  receipt: SwapReceipt;
  onClose: () => void;
  onRetry?: () => void;
  onGoToConvert?: () => void;
}

function shortAddr(addr?: string | null): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function SwapResultModal({
  receipt,
  onClose,
  onRetry,
  onGoToConvert,
}: SwapResultModalProps) {
  const [copied, setCopied] = useState(false);
  const isSuccess = receipt.status === 'success';

  const copyAddress = () => {
    if (!receipt.walletAddress) return;
    navigator.clipboard.writeText(receipt.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bscScanUrl = receipt.txHash
    ? (Number(import.meta.env.VITE_BSC_CHAIN_ID || 97) === 56
        ? `https://bscscan.com/tx/${receipt.txHash}`
        : `https://testnet.bscscan.com/tx/${receipt.txHash}`)
    : null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm glass rounded-3xl p-5 overflow-hidden shadow-2xl border border-white/15"
        style={{
          background: isSuccess
            ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.20) 0%, rgba(20, 20, 25, 0.97) 40%)'
            : 'linear-gradient(180deg, rgba(239, 68, 68, 0.20) 0%, rgba(20, 20, 25, 0.97) 40%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 glass rounded-full p-2 text-white/50 hover:text-white active:scale-90 transition-all z-10"
        >
          <X size={16} />
        </button>

        {/* Status Icon & Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-lg ${
              isSuccess
                ? 'bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-emerald-500/30 ring-4 ring-emerald-500/20 animate-bounce-short'
                : 'bg-gradient-to-br from-red-500 to-rose-700 text-white shadow-red-500/30 ring-4 ring-red-500/20'
            }`}
          >
            {isSuccess ? <CheckCircle2 size={32} /> : <AlertTriangle size={30} />}
          </div>

          <h3 className="text-lg font-black text-white">
            {isSuccess ? 'Swap Successful!' : 'Swap Failed'}
          </h3>
          <p className="text-xs text-white/60 mt-0.5">
            {isSuccess
              ? 'Transaction confirmed on BNB Smart Chain'
              : 'Transaction could not be completed on PancakeSwap'}
          </p>
        </div>

        {/* Swap Amount Card */}
        <div className="glass rounded-2xl p-3 mb-3 border border-white/10 bg-black/40 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex flex-col" style={{ marginLeft: '10px' }}>
              <span className="text-[10px] uppercase font-bold text-white/40">You Paid</span>
              <span className="text-sm font-black text-white font-mono">
                {receipt.fromAmount} {receipt.fromToken}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60">
              <ArrowUpDown size={14} className="rotate-90" />
            </div>

            <div className="flex flex-col text-right" style={{ marginRight: '10px' }}>
              <span className="text-[10px] uppercase font-bold text-emerald-400">You Received</span>
              <span className="text-sm font-black text-amber-300 font-mono">
                +{receipt.toAmount} {receipt.toToken}
              </span>
            </div>
          </div>
        </div>

        {/* Detail Info Card */}
        <div className="glass rounded-2xl p-3 mb-3 flex flex-col gap-2 text-xs border border-white/10 bg-black/25">
          {/* Wallet Address */}
          {receipt.walletAddress && (
            <div className="flex items-center justify-between" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
              <span className="text-white/50 text-[11px]">Recipient Wallet:</span>
              <button
                type="button"
                onClick={copyAddress}
                className="flex items-center gap-1.5 font-mono text-white/80 hover:text-white active:scale-95 transition-all text-[11px]"
              >
                <span>{shortAddr(receipt.walletAddress)}</span>
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-white/40" />}
              </button>
            </div>
          )}

          {/* New Balances on Success (Realtime Updated) */}
          {isSuccess && receipt.farmBalanceAfter && (
            <div className="flex items-center justify-between pt-1.5 border-t border-white/5" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
              <span className="text-white/50 text-[11px]">New $FARM Balance:</span>
              <span className="font-mono font-black text-amber-300 flex items-center gap-1">
                <span>{receipt.farmBalanceAfter} $FARM</span>
                <span>🌾</span>
              </span>
            </div>
          )}

          {isSuccess && receipt.bnbBalanceAfter && (
            <div className="flex items-center justify-between pt-1 border-t border-white/5" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
              <span className="text-white/50 text-[11px]">Remaining BNB:</span>
              <span className="font-mono font-bold text-white/80 flex items-center gap-1">
                <span>{receipt.bnbBalanceAfter} BNB</span>
                <span>🟡</span>
              </span>
            </div>
          )}

          {isSuccess && receipt.usdtBalanceAfter && (
            <div className="flex items-center justify-between pt-1 border-t border-white/5" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
              <span className="text-white/50 text-[11px]">Remaining USDT:</span>
              <span className="font-mono font-bold text-white/80 flex items-center gap-1">
                <span>{receipt.usdtBalanceAfter} USDT</span>
                <span>💵</span>
              </span>
            </div>
          )}

          {/* TxHash Link */}
          {receipt.txHash && (
            <div className="flex items-center justify-between pt-1.5 border-t border-white/5" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
              <span className="text-white/50 text-[11px]">TxHash:</span>
              {bscScanUrl ? (
                <a
                  href={bscScanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline"
                >
                  {shortAddr(receipt.txHash)} <ExternalLink size={11} />
                </a>
              ) : (
                <span className="font-mono text-white/60 text-[11px]">{shortAddr(receipt.txHash)}</span>
              )}
            </div>
          )}

          {/* Error Reason */}
          {!isSuccess && receipt.errorMessage && (
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-[11px] leading-relaxed">
              <p className="font-bold text-red-300 mb-0.5">Error Reason:</p>
              <p>{receipt.errorMessage}</p>
            </div>
          )}
        </div>

        {/* Explanatory Guide Box */}
        {isSuccess ? (
          <div className="rounded-xl p-2.5 bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-snug mb-4">
            <p className="font-bold text-amber-300 mb-1 flex items-center gap-1" style={{ marginLeft: '4px' }}>
              <span>🌾</span>
              <span>
                {receipt.direction === 'BNB_TO_FARM' ? 'Your $FARM is ready!' : 'Your BNB is ready!'}
              </span>
            </p>
            <p className="text-white/70" style={{ marginLeft: '4px', marginRight: '4px' }}>
              {receipt.direction === 'BNB_TO_FARM'
                ? 'Your $FARM balance is updated realtime. You can now convert it to in-game Gold (GOLD ⇄ $FARM) or trade on Marketplace!'
                : 'Your BNB balance is updated realtime for network gas fees.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl p-2.5 bg-white/5 border border-white/10 text-[11px] text-white/60 leading-snug mb-4">
            <p className="font-bold text-white/90 mb-1" style={{ marginLeft: '4px' }}>💡 Troubleshooting Tips:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-white/70" style={{ marginLeft: '4px' }}>
              <li>Keep at least 0.002 BNB in your wallet to cover BSC network gas fees.</li>
              <li>If market prices move quickly, wait a few seconds and try again.</li>
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
          {isSuccess ? (
            <>
              {receipt.direction === 'BNB_TO_FARM' && onGoToConvert ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-3 px-4 rounded-2xl glass font-bold text-xs text-white/70 text-center active:scale-95 transition-all"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={onGoToConvert}
                    className="flex-1 py-3 rounded-2xl font-black text-xs text-center flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg text-black"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
                    }}
                  >
                    <Coins size={14} />
                    <span>Convert to Gold (GOLD ⇄ $FARM)</span>
                    <ArrowRight size={13} />
                  </button>
                </>
              ) : (
                <>
                  {bscScanUrl && (
                    <a
                      href={bscScanUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-3 rounded-2xl glass font-bold text-xs text-white/90 text-center flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      style={{ marginRight: '4px' }}
                    >
                      <ExternalLink size={13} />
                      <span>BscScan</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 rounded-2xl font-black text-xs text-center flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg text-white"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    <Check size={14} />
                    <span>Done</span>
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl glass font-bold text-xs text-white/70 text-center active:scale-95 transition-all"
                style={{ marginRight: '4px' }}
              >
                Close
              </button>
              {onRetry && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRetry();
                  }}
                  className="flex-1 py-3 rounded-2xl font-black text-xs text-center flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg text-white"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  <span>Try Again</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
