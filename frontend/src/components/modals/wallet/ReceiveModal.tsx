import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, ArrowLeft, Copy, Check, Share2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useMPCWallet } from '@/hooks/useMPCWallet';
import { soundManager } from '@/sounds/SoundManager';
import WebApp from '@twa-dev/sdk';

interface ReceiveModalProps {
  onClose: () => void;
  onBack?: () => void;
}

export function ReceiveModal({ onClose, onBack }: ReceiveModalProps) {
  const { address, shortAddress } = useMPCWallet();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) return;
    QRCode.toDataURL(address, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [address]);

  const handleCopy = () => {
    if (!address) return;
    soundManager.play('click');
    try {
      (WebApp as any)?.HapticFeedback?.notificationOccurred?.('success');
    } catch {}
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleShare = () => {
    if (!address) return;
    soundManager.play('click');
    const shareText = `Send BNB / $FARM to my Bandit Buddy Web3 address:\n${address}`;
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(address)}&text=${encodeURIComponent(shareText)}`;
    try {
      WebApp.openTelegramLink(tgUrl);
    } catch {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center px-3 sm:px-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-sm glass rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl slide-up text-white flex flex-col items-center">
        {/* Top bar with Back and Close */}
        <div className="w-full flex items-center justify-between mb-4">
          <button
            onClick={onBack || onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 font-black text-sm text-white">
            <span>Receive Assets</span>
          </div>
          <button
            onClick={onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Network Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold mb-4">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>BNB Smart Chain (BEP20)</span>
        </div>

        {/* QR Code Container */}
        <div className="p-3 bg-white rounded-3xl shadow-xl border-4 border-amber-400/20 mb-4 flex items-center justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Wallet Address QR" className="w-52 h-52 object-contain rounded-xl" />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center text-black/40 text-xs font-mono">
              Generating QR...
            </div>
          )}
        </div>

        {/* Address Display & Copy */}
        <div className="w-full mb-4">
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest text-center mb-1.5">
            Your Wallet Address
          </p>
          <div
            onClick={handleCopy}
            className="glass rounded-2xl p-3 border border-white/10 hover:border-amber-400/40 cursor-pointer active:scale-98 transition-all flex items-center justify-between gap-2 group"
          >
            <span className="text-xs font-mono text-white/80 break-all leading-relaxed flex-1">
              {address}
            </span>
            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/10 group-hover:bg-amber-400/20 flex items-center justify-center text-white/70 group-hover:text-amber-300 transition-colors">
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </div>
          </div>
          {copied && (
            <p className="text-emerald-400 text-[11px] font-bold text-center mt-1 animate-fade-in">
              ✓ Address copied to clipboard!
            </p>
          )}
        </div>

        {/* Action Buttons: Copy & Share */}
        <div className="w-full grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={handleCopy}
            className="py-3 rounded-2xl glass border border-white/15 hover:bg-white/10 text-xs font-black text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy Address'}</span>
          </button>
          <button
            onClick={handleShare}
            className="py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-amber-500/20"
          >
            <Share2 size={14} />
            <span>Share to Chat</span>
          </button>
        </div>

        {/* Security Warning Tip */}
        <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-3 flex items-start gap-2 text-left">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-white/50 text-[10px] leading-relaxed">
            Send only <strong className="text-amber-300">BNB</strong> or <strong className="text-amber-300">$FARM</strong> (BEP-20) to this address. Sending unsupported tokens or other networks may result in permanent loss.
          </p>
        </div>
      </div>
    </div>
  );
}
