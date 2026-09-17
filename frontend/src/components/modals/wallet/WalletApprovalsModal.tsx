import { useState } from 'react';
import { X, ArrowLeft, ShieldCheck, AlertTriangle, ExternalLink, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useMPCWallet } from '@/hooks/useMPCWallet';
import { soundManager } from '@/sounds/SoundManager';
import WebApp from '@twa-dev/sdk';

interface WalletApprovalsModalProps {
  onClose: () => void;
  onBack?: () => void;
}

export function WalletApprovalsModal({ onClose, onBack }: WalletApprovalsModalProps) {
  const { approvals, isLoadingApprovals, revokeApproval, refreshBalances } = useMPCWallet();
  const [revokingSpender, setRevokingSpender] = useState<string | null>(null);
  const [revokedSuccess, setRevokedSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRevoke = async (spenderAddress: `0x${string}`, name: string) => {
    soundManager.play('click');
    setRevokingSpender(spenderAddress);
    setErrorMsg(null);
    setRevokedSuccess(null);

    try {
      await revokeApproval(spenderAddress);
      soundManager.play('coin');
      try {
        (WebApp as any)?.HapticFeedback?.notificationOccurred?.('success');
      } catch {}
      setRevokedSuccess(`Revoked allowance for ${name}`);
      setTimeout(() => setRevokedSuccess(null), 3000);
    } catch (err: any) {
      soundManager.play('error');
      try {
        (WebApp as any)?.HapticFeedback?.notificationOccurred?.('error');
      } catch {}
      setErrorMsg(err?.message || 'Failed to revoke allowance.');
    } finally {
      setRevokingSpender(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center px-3 sm:px-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-sm glass rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl slide-up text-white flex flex-col max-h-[85vh]">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between mb-3 flex-shrink-0">
          <button
            onClick={onBack || onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 font-black text-sm text-white">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Smart Contract Approvals</span>
          </div>
          <button
            onClick={onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Security Shield Banner */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 mb-3 flex items-start gap-2.5 flex-shrink-0">
          <ShieldCheck size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/60 leading-relaxed text-left">
            <strong className="text-emerald-300">Anti-Drainer Protection:</strong> Review and revoke smart contract spending allowances to eliminate external drainer risks.
          </p>
        </div>

        {/* Notification Feedback */}
        {revokedSuccess && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center gap-2 text-emerald-300 text-xs font-bold animate-fade-in flex-shrink-0">
            <CheckCircle2 size={15} />
            <span>{revokedSuccess}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center gap-2 text-red-300 text-xs animate-fade-in flex-shrink-0">
            <AlertTriangle size={15} />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}

        {/* Approvals List Scrollable */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[160px]">
          {isLoadingApprovals ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/40 gap-2">
              <RefreshCw size={24} className="animate-spin text-amber-400" />
              <span className="text-xs font-medium">Scanning on-chain allowances...</span>
            </div>
          ) : approvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-white/40">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                <ShieldCheck size={24} />
              </div>
              <p className="text-sm font-bold text-white mb-1">No Active Approvals</p>
              <p className="text-xs text-white/40 max-w-[240px]">
                You haven't granted token spending permissions to any contracts yet. Your wallet is secure.
              </p>
            </div>
          ) : (
            approvals.map((app) => {
              const isBusy = revokingSpender === app.spenderAddress;
              return (
                <div
                  key={app.spenderAddress}
                  className="glass rounded-2xl p-3.5 border border-white/10 flex flex-col gap-2 transition-all hover:border-white/20 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{app.contractName}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-mono font-semibold">
                          {app.category}
                        </span>
                      </div>
                      <a
                        href={`https://testnet.bscscan.com/address/${app.spenderAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-amber-300 font-mono mt-0.5 transition-colors"
                      >
                        <span>{app.spenderAddress.slice(0, 8)}...{app.spenderAddress.slice(-6)}</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>

                    <button
                      onClick={() => handleRevoke(app.spenderAddress, app.contractName)}
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded-xl glass border border-red-400/30 text-red-300 hover:bg-red-500/20 active:scale-95 text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                    >
                      {isBusy ? (
                        <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>Revoke</span>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/5">
                    <span className="text-white/40">Allowance:</span>
                    <span className="font-mono font-bold text-amber-300">
                      {app.isUnlimited ? 'Unlimited ($FARM)' : `${app.allowanceFormatted} FARM`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 mt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 flex-shrink-0">
          <span>Active Contracts: {approvals.length}</span>
          <button
            onClick={() => {
              soundManager.play('click');
              refreshBalances();
            }}
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <RefreshCw size={11} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </div>
  );
}
