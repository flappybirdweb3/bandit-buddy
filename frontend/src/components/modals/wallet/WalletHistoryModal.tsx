import { X, ArrowLeft, ExternalLink, ArrowUpRight, ArrowDownLeft, Shield, Sparkles } from 'lucide-react';
import { useMPCWallet, WalletTxRecord } from '@/hooks/useMPCWallet';
import { soundManager } from '@/sounds/SoundManager';

interface WalletHistoryModalProps {
  onClose: () => void;
  onBack?: () => void;
}

export function WalletHistoryModal({ onClose, onBack }: WalletHistoryModalProps) {
  const { txHistory, formatFiat, bnbPriceUsd, farmPriceUsd } = useMPCWallet();

  const formatTimestamp = (ms: number) => {
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getTxIcon = (tx: WalletTxRecord) => {
    switch (tx.type) {
      case 'send_bnb':
      case 'send_farm':
        return (
          <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-400/30 flex items-center justify-center text-red-400 flex-shrink-0">
            <ArrowUpRight size={16} />
          </div>
        );
      case 'receive':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <ArrowDownLeft size={16} />
          </div>
        );
      case 'revoke':
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 flex-shrink-0">
            <Shield size={16} />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-400 flex-shrink-0">
            <Sparkles size={16} />
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center px-3 sm:px-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-sm glass rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl slide-up text-white flex flex-col max-h-[85vh]">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between mb-4 flex-shrink-0">
          <button
            onClick={onBack || onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 font-black text-sm text-white">
            <span>Transaction History</span>
          </div>
          <button
            onClick={onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[220px]">
          {txHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-white/40">
              <div className="w-12 h-12 rounded-2xl glass border border-white/10 flex items-center justify-center mb-3">
                <ArrowUpRight size={22} className="text-white/30" />
              </div>
              <p className="text-sm font-bold text-white mb-1">No Transactions Yet</p>
              <p className="text-xs text-white/40 max-w-[220px]">
                Your incoming and outgoing transfers, contract approvals, and claims will appear here.
              </p>
            </div>
          ) : (
            txHistory.map((tx) => (
              <a
                key={tx.id}
                href={`https://testnet.bscscan.com/tx/${tx.txHash}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => soundManager.play('click')}
                className="glass rounded-2xl p-3 border border-white/10 hover:border-amber-400/40 transition-all flex items-center justify-between gap-3 group text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {getTxIcon(tx)}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                      {tx.title}
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">
                      {formatTimestamp(tx.timestamp)}
                      {tx.recipientOrSpender && ` • ${tx.recipientOrSpender.slice(0, 6)}...`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-mono font-black text-white">
                      {tx.type.startsWith('send') ? `-${tx.amount}` : tx.amount !== '0' ? `+${tx.amount}` : ''} {tx.token}
                    </span>
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                      {tx.status}
                    </span>
                  </div>
                  <ExternalLink size={12} className="text-white/30 group-hover:text-amber-300 transition-colors" />
                </div>
              </a>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 mt-2 border-t border-white/5 text-center text-[10px] text-white/40 flex-shrink-0">
          Showing last {txHistory.length} transactions • Powered by BSC Testnet
        </div>
      </div>
    </div>
  );
}
