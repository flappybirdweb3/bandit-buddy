import { useState } from 'react';
import {
  X, ArrowLeft, Cloud, QrCode, KeyRound, Check, Copy, Eye, EyeOff,
  ShieldCheck, AlertTriangle, Globe, ChevronRight, CheckCircle2
} from 'lucide-react';
import QRCode from 'qrcode';
import { useMPCWallet, FiatCurrency } from '@/hooks/useMPCWallet';
import { soundManager } from '@/sounds/SoundManager';
import WebApp from '@twa-dev/sdk';

interface WalletSettingsModalProps {
  onClose: () => void;
  onBack?: () => void;
}

export function WalletSettingsModal({ onClose, onBack }: WalletSettingsModalProps) {
  const {
    isBackedUp,
    lastBackupDate,
    performCloudBackup,
    pk,
    currency,
    setCurrency,
  } = useMPCWallet();

  const [activeSubView, setActiveSubView] = useState<'main' | 'export_key' | 'qr_backup'>('main');
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [qrBackupUrl, setQrBackupUrl] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccessToast, setBackupSuccessToast] = useState(false);

  // Trigger Cloud Backup
  const handleQuickBackup = async () => {
    soundManager.play('click');
    setIsBackingUp(true);
    try {
      await performCloudBackup();
      soundManager.play('coin');
      setBackupSuccessToast(true);
      setTimeout(() => setBackupSuccessToast(false), 3000);
    } catch {
      soundManager.play('error');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Trigger QR Backup Generation
  const handleOpenQrBackup = async () => {
    soundManager.play('click');
    if (!pk) return;
    try {
      const url = await QRCode.toDataURL(`BARNBUDDY_KEYLESS_BACKUP:${pk}`, {
        width: 280,
        margin: 1.5,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrBackupUrl(url);
      setActiveSubView('qr_backup');
    } catch (err) {
      console.error('Failed to generate QR backup:', err);
    }
  };

  const handleCopyKey = () => {
    if (!pk) return;
    soundManager.play('click');
    try {
      (WebApp as any)?.HapticFeedback?.notificationOccurred?.('success');
    } catch {}
    navigator.clipboard.writeText(pk);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center px-3 sm:px-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-sm glass rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl slide-up text-white flex flex-col max-h-[85vh]">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between mb-4 flex-shrink-0">
          <button
            onClick={() => {
              if (activeSubView !== 'main') {
                setActiveSubView('main');
              } else if (onBack) {
                onBack();
              } else {
                onClose();
              }
            }}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 font-black text-sm text-white">
            <span>
              {activeSubView === 'main'
                ? 'Wallet Settings & Backup'
                : activeSubView === 'export_key'
                ? 'Export Private Key'
                : 'QR Code Key Backup'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* View 1: Main Settings */}
        {activeSubView === 'main' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-left">
            {backupSuccessToast && (
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 size={15} />
                <span>Cloud Backup completed successfully!</span>
              </div>
            )}

            {/* Keyless Backup Status Banner */}
            <div className="glass rounded-2xl p-3.5 border border-white/10 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud size={18} className="text-amber-400" />
                  <span className="text-xs font-bold text-white">Keyless Cloud Backup</span>
                </div>
                {isBackedUp ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                    <Check size={11} /> Backed Up
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={11} /> Not Backed Up
                  </span>
                )}
              </div>

              <p className="text-[11px] text-white/50 leading-relaxed">
                {isBackedUp
                  ? `Your key share is safely backed up to your encrypted Telegram cloud on ${lastBackupDate || 'recent date'}.`
                  : 'Back up your keyless wallet to prevent losing access if you switch devices or clear app data.'}
              </p>

              <button
                onClick={handleQuickBackup}
                disabled={isBackingUp}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-xs active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                {isBackingUp ? (
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Cloud size={14} />
                )}
                <span>{isBackedUp ? 'Sync / Update Cloud Backup' : 'Quick Backup (Cloud)'}</span>
              </button>
            </div>

            {/* Advanced Manual Backups */}
            <div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">
                Manual Key Management
              </p>
              <div className="space-y-2">
                <button
                  onClick={handleOpenQrBackup}
                  className="w-full glass rounded-2xl p-3 border border-white/10 hover:border-amber-400/40 active:scale-98 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-amber-400">
                      <QrCode size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-white">QR Code Backup</span>
                      <span className="text-[10px] text-white/40">Export encrypted printable QR image</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-white/30" />
                </button>

                <button
                  onClick={() => {
                    soundManager.play('click');
                    setActiveSubView('export_key');
                  }}
                  className="w-full glass rounded-2xl p-3 border border-white/10 hover:border-amber-400/40 active:scale-98 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-amber-400">
                      <KeyRound size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-white">View & Export Private Key</span>
                      <span className="text-[10px] text-white/40">Reveal raw key for MetaMask / Trust</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-white/30" />
                </button>
              </div>
            </div>

            {/* Currency Preference */}
            <div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">
                Display Currency
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(['USD', 'EUR', 'VND'] as FiatCurrency[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      soundManager.play('click');
                      try {
                        (WebApp as any)?.HapticFeedback?.selectionChanged?.();
                      } catch {}
                      setCurrency(c);
                    }}
                    className={`py-2.5 rounded-2xl border text-xs font-black transition-all ${
                      currency === c
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                        : 'glass border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    {c} {c === 'USD' ? '($)' : c === 'EUR' ? '(€)' : '(₫)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Network Info */}
            <div className="glass rounded-2xl p-3 border border-white/5 flex flex-col gap-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-white/50">Network:</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  BNB Smart Chain Testnet (97)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50">RPC Endpoint:</span>
                <span className="font-mono text-white/70 text-[10px]">bsc-testnet-rpc</span>
              </div>
            </div>
          </div>
        )}

        {/* View 2: Export Private Key */}
        {activeSubView === 'export_key' && (
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-left animate-fade-in">
            <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-200 leading-relaxed">
                <strong className="text-red-300 font-bold">WARNING:</strong> Never share your private key with anyone, including admins. Anyone with this key has full control over your assets.
              </p>
            </div>

            <div className="glass rounded-2xl p-3.5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white/70">Private Key</span>
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="text-white/50 hover:text-white flex items-center gap-1 text-[11px] transition-colors"
                >
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showKey ? 'Hide' : 'Reveal'}</span>
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 font-mono text-xs break-all text-white/80 select-all">
                {showKey ? pk || 'No key loaded' : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
              </div>
            </div>

            <button
              onClick={handleCopyKey}
              className="w-full py-3 rounded-2xl glass border border-amber-400/40 hover:bg-amber-400/10 text-amber-300 font-black text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {copiedKey ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              <span>{copiedKey ? 'Copied to Clipboard' : 'Copy Private Key'}</span>
            </button>
          </div>
        )}

        {/* View 3: QR Backup */}
        {activeSubView === 'qr_backup' && (
          <div className="flex-1 overflow-y-auto flex flex-col items-center text-center pr-1 animate-fade-in">
            <div className="p-3 bg-white rounded-3xl shadow-xl border-4 border-amber-400/20 mb-3">
              {qrBackupUrl && (
                <img src={qrBackupUrl} alt="Key Backup QR" className="w-52 h-52 object-contain rounded-xl" />
              )}
            </div>
            <p className="text-xs text-white/60 mb-3 max-w-[240px]">
              Scan this QR from another secure device or print it to store in a safe vault.
            </p>
            <button
              onClick={() => setActiveSubView('main')}
              className="w-full py-2.5 rounded-2xl glass border border-white/10 text-white font-bold text-xs active:scale-95 transition-all"
            >
              Back to Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
