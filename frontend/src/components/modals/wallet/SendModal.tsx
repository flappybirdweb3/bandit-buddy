import { useState, useMemo } from 'react';
import {
  X, ArrowLeft, Send, CheckCircle2, AlertCircle, AlertTriangle, ExternalLink,
  ChevronDown, Sparkles, ScanQrCode, ShieldCheck
} from 'lucide-react';
import { useMPCWallet } from '@/hooks/useMPCWallet';
import { soundManager } from '@/sounds/SoundManager';
import { isAddress, formatEther } from 'viem';
import WebApp from '@twa-dev/sdk';

interface SendModalProps {
  onClose: () => void;
  onBack?: () => void;
  defaultToken?: 'BNB' | 'FARM' | 'USDT';
}

export function SendModal({ onClose, onBack, defaultToken = 'BNB' }: SendModalProps) {
  const {
    bnbBalance,
    farmBalance,
    usdtBalance,
    bnbFormatted,
    farmFormatted,
    usdtFormatted,
    bnbPriceUsd,
    farmPriceUsd,
    usdtPriceUsd,
    formatFiat,
    sendBnb,
    sendFarm,
    sendUsdt,
    getMaxSendableBnb,
  } = useMPCWallet();

  const [selectedToken, setSelectedToken] = useState<'BNB' | 'FARM' | 'USDT'>(defaultToken);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);

  // Address validation
  const isValidAddress = useMemo(() => {
    const clean = recipient.trim();
    if (!clean) return false;
    return isAddress(clean);
  }, [recipient]);

  // Selected Token available balance
  const maxAvailable = useMemo(() => {
    if (selectedToken === 'BNB') {
      return getMaxSendableBnb();
    }
    if (selectedToken === 'FARM') {
      if (!farmBalance) return '0';
      return formatEther(farmBalance);
    }
    if (!usdtBalance) return '0';
    return formatEther(usdtBalance);
  }, [selectedToken, farmBalance, usdtBalance, getMaxSendableBnb]);

  // Check if user has sufficient BNB for gas when transferring tokens
  const minGasBnb = 0.0008;
  const bnbFloat = bnbBalance ? parseFloat(formatEther(bnbBalance)) : 0;
  const isGasInsufficient = (selectedToken === 'FARM' || selectedToken === 'USDT') && bnbFloat < minGasBnb;

  // 0.3% (30 BPS) Gateway Fee & Net Received Calculation
  const feeBps = 30; // 0.3%
  const parsedAmount = useMemo(() => {
    const val = parseFloat(amount);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [amount]);

  const gatewayFee = useMemo(() => {
    return (parsedAmount * feeBps) / 10000;
  }, [parsedAmount]);

  const netReceived = useMemo(() => {
    return Math.max(0, parsedAmount - gatewayFee);
  }, [parsedAmount, gatewayFee]);

  // Estimated Fiat Values
  const tokenPriceUsd = selectedToken === 'BNB' ? bnbPriceUsd : selectedToken === 'FARM' ? farmPriceUsd : (usdtPriceUsd || 1.0);
  const fiatEquivalent = useMemo(() => {
    return formatFiat(parsedAmount * tokenPriceUsd);
  }, [parsedAmount, tokenPriceUsd, formatFiat]);

  const gatewayFeeFiat = useMemo(() => {
    return formatFiat(gatewayFee * tokenPriceUsd);
  }, [gatewayFee, tokenPriceUsd, formatFiat]);

  const netReceivedFiat = useMemo(() => {
    return formatFiat(netReceived * tokenPriceUsd);
  }, [netReceived, tokenPriceUsd, formatFiat]);

  // Handle Paste from Clipboard
  const handlePaste = async () => {
    soundManager.play('click');
    setErrorMsg(null);
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) setRecipient(text.trim());
      }
    } catch {
      // Fallback
    }
  };

  // Handle Telegram Native QR Code Scanner
  const handleScanQr = () => {
    soundManager.play('click');
    setErrorMsg(null);
    try {
      (WebApp as any)?.HapticFeedback?.selectionChanged?.();
    } catch {}

    const tgWebApp = (window as any)?.Telegram?.WebApp || WebApp;
    if (typeof tgWebApp?.showScanQrPopup === 'function') {
      tgWebApp.showScanQrPopup(
        { text: 'Scan BSC BEP-20 Wallet Address' },
        (scannedText: string) => {
          if (!scannedText) return false;

          // Extract 0x address (handles plain address, ethereum:0x..., or binance:0x...)
          const match = scannedText.match(/0x[a-fA-F0-9]{40}/i);
          if (match) {
            const extractedAddr = match[0].trim();
            setRecipient(extractedAddr);
            try {
              (WebApp as any)?.HapticFeedback?.notificationOccurred?.('success');
            } catch {}
            tgWebApp.closeScanQrPopup();
            return true;
          } else {
            setErrorMsg('Scanned QR code is not a valid EVM address');
            try {
              (WebApp as any)?.HapticFeedback?.notificationOccurred?.('error');
            } catch {}
            return false;
          }
        }
      );
    } else {
      setErrorMsg('QR camera scanner is available in the Telegram Mobile App.');
    }
  };

  // Handle Set Max
  const handleSetMax = () => {
    soundManager.play('click');
    setErrorMsg(null);
    try {
      (WebApp as any)?.HapticFeedback?.selectionChanged?.();
    } catch {}
    setAmount(maxAvailable);
  };

  // Execute Send via Smart Contract Gateway
  const handleSend = async () => {
    setErrorMsg(null);
    if (!isValidAddress) {
      setErrorMsg('Please enter a valid BSC address (0x...)');
      return;
    }
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0');
      return;
    }

    const trimmedAmount = amount.trim();
    const decimalParts = trimmedAmount.split('.');
    if (decimalParts.length === 2 && decimalParts[1].length > 18) {
      setErrorMsg('Amount exceeds maximum allowed precision (18 decimal places)');
      return;
    }

    if (isGasInsufficient) {
      setErrorMsg(`Insufficient BNB for gas fees (~${minGasBnb} BNB required). Please deposit BNB first.`);
      return;
    }

    if (val > parseFloat(maxAvailable)) {
      setErrorMsg('Insufficient balance (including gas reserve)');
      return;
    }

    soundManager.play('click');
    setIsSubmitting(true);

    try {
      let hash: string;
      if (selectedToken === 'BNB') {
        hash = await sendBnb({ recipient: recipient.trim(), amountEther: trimmedAmount });
      } else if (selectedToken === 'FARM') {
        hash = await sendFarm({ recipient: recipient.trim(), amountFarm: trimmedAmount });
      } else {
        hash = await sendUsdt({ recipient: recipient.trim(), amountUsdt: trimmedAmount });
      }

      soundManager.play('coin');
      try {
        (WebApp as any)?.HapticFeedback?.notificationOccurred?.('success');
      } catch {}
      setTxSuccessHash(hash);
    } catch (err: any) {
      soundManager.play('error');
      try {
        (WebApp as any)?.HapticFeedback?.notificationOccurred?.('error');
      } catch {}
      setErrorMsg(err?.message || 'Transaction failed. Please check your balance and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center px-3 sm:px-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-sm glass rounded-3xl p-5 sm:p-6 border border-white/10 shadow-2xl slide-up text-white flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Top bar with Back and Close */}
        <div className="w-full flex items-center justify-between mb-3 flex-shrink-0">
          <button
            onClick={onBack || onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 font-black text-sm text-white">
            <span>Send Assets</span>
          </div>
          <button
            onClick={onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Success View */}
        {txSuccessHash ? (
          <div className="flex flex-col items-center text-center py-6 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center text-emerald-400 mb-4">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-lg font-black text-white mb-1">Transaction Broadcasted!</h3>
            <p className="text-white/60 text-xs mb-2">
              Sent <strong className="text-white">{amount} {selectedToken}</strong> via Gateway
            </p>
            <p className="text-emerald-400 text-xs font-mono font-bold mb-4">
              Recipient Net: {netReceived.toFixed(4)} {selectedToken} • Fee ({selectedToken === 'FARM' ? 'Burned' : 'Treasury'}): {gatewayFee.toFixed(4)} {selectedToken}
            </p>

            <a
              href={`https://testnet.bscscan.com/tx/${txSuccessHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl glass border border-amber-400/30 text-amber-300 text-xs font-bold mb-6 hover:bg-amber-400/10 transition-colors"
            >
              <span>View on BscScan</span>
              <ExternalLink size={13} />
            </a>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black text-sm active:scale-95 transition-all shadow-lg shadow-amber-500/20"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Token Selector Dropdown */}
            <div className="relative mb-3">
              <label className="text-white/50 text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-left">
                Select Token
              </label>
              <button
                type="button"
                onClick={() => setIsTokenDropdownOpen((prev) => !prev)}
                className="w-full glass rounded-2xl px-3.5 py-2.5 border border-white/10 hover:border-amber-400/40 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                    selectedToken === 'BNB'
                      ? 'bg-amber-400 text-black'
                      : selectedToken === 'FARM'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-teal-500 text-white text-sm'
                  }`}>
                    {selectedToken === 'BNB' ? 'BNB' : selectedToken === 'FARM' ? '🚜' : '₮'}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-black leading-tight">
                      {selectedToken === 'BNB' ? 'BNB (Gas & Base)' : selectedToken === 'FARM' ? '$FARM (Game Reward)' : 'USDT (BEP-20 Stablecoin)'}
                    </span>
                    <span className="text-[11px] text-white/50 font-mono">
                      Balance: {selectedToken === 'BNB' ? bnbFormatted : selectedToken === 'FARM' ? farmFormatted : usdtFormatted}
                    </span>
                  </div>
                </div>
                <ChevronDown size={16} className={`text-white/40 transition-transform ${isTokenDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isTokenDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-10 glass rounded-2xl border border-white/15 p-1.5 shadow-xl animate-fade-in bg-black/90">
                  <div
                    onClick={() => {
                      setSelectedToken('BNB');
                      setIsTokenDropdownOpen(false);
                      setAmount('');
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors ${
                      selectedToken === 'BNB' ? 'bg-white/15' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-xs">
                        BNB
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold">BNB Smart Chain</span>
                        <span className="text-[10px] text-white/40 font-mono">{bnbFormatted} BNB</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-300 font-mono">
                      {formatFiat((bnbBalance ? parseFloat(formatEther(bnbBalance)) : 0) * bnbPriceUsd)}
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      setSelectedToken('FARM');
                      setIsTokenDropdownOpen(false);
                      setAmount('');
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors ${
                      selectedToken === 'FARM' ? 'bg-white/15' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-xs">
                        🚜
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold">$FARM Token</span>
                        <span className="text-[10px] text-white/40 font-mono">{farmFormatted} FARM</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-300 font-mono">
                      {formatFiat((farmBalance ? parseFloat(formatEther(farmBalance)) : 0) * farmPriceUsd)}
                    </span>
                  </div>

                  <div
                    onClick={() => {
                      setSelectedToken('USDT');
                      setIsTokenDropdownOpen(false);
                      setAmount('');
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors ${
                      selectedToken === 'USDT' ? 'bg-white/15' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-teal-500 text-white flex items-center justify-center font-black text-xs">
                        ₮
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold">Tether USD</span>
                        <span className="text-[10px] text-white/40 font-mono">{usdtFormatted} USDT</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-teal-300 font-mono">
                      {formatFiat((usdtBalance ? parseFloat(formatEther(usdtBalance)) : 0) * (usdtPriceUsd || 1.0))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Recipient Address Input with Paste & Native Scan QR */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-white/50 text-[10px] font-bold uppercase tracking-wider">
                  Recipient Address (BSC BEP20)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleScanQr}
                    className="text-[10px] text-amber-300 font-bold flex items-center gap-1 hover:underline active:scale-95 transition-all"
                    title="Scan QR Code with Camera"
                  >
                    <ScanQrCode size={12} />
                    <span>Scan QR</span>
                  </button>
                  <span className="text-white/20">•</span>
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="text-[10px] text-amber-300 font-bold hover:underline active:scale-95 transition-all"
                  >
                    Paste
                  </button>
                </div>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className={`w-full glass rounded-2xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-white/20 border transition-all pr-8 ${
                    recipient && !isValidAddress
                      ? 'border-red-400/80 bg-red-500/10'
                      : recipient && isValidAddress
                      ? 'border-emerald-400/80 bg-emerald-500/10'
                      : 'border-white/10 focus:border-amber-400/50'
                  }`}
                />
                {recipient && (
                  <div className="absolute right-3 text-xs">
                    {isValidAddress ? (
                      <span className="text-emerald-400 font-bold">✓</span>
                    ) : (
                      <span className="text-red-400 font-bold">✕</span>
                    )}
                  </div>
                )}
              </div>
              {recipient && !isValidAddress && (
                <p className="text-red-400 text-[10px] font-medium mt-1 text-left">
                  Invalid Binance Smart Chain address format.
                </p>
              )}
            </div>

            {/* Amount Input with MAX Button */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-white/50 text-[10px] font-bold uppercase tracking-wider">
                  Transfer Amount
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 text-[10px] font-mono">
                    Avail: {parseFloat(maxAvailable).toFixed(4)}
                  </span>
                  <button
                    type="button"
                    onClick={handleSetMax}
                    className="px-1.5 py-0.5 rounded-md bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-[10px] font-black uppercase transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div className="glass rounded-2xl p-3 border border-white/10 focus-within:border-amber-400/50 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-lg font-black text-white font-mono focus:outline-none w-full placeholder-white/20"
                  />
                  <span className="text-xs font-black text-amber-300 flex-shrink-0">
                    {selectedToken}
                  </span>
                </div>
                <div className="text-[11px] text-white/40 font-mono mt-1 text-left">
                  ≈ {fiatEquivalent}
                </div>
              </div>
              {selectedToken === 'BNB' && (
                <p className="text-white/40 text-[10px] mt-1 text-left">
                  * 0.0005 BNB is reserved to guarantee transaction gas.
                </p>
              )}
            </div>

            {/* Value-Flow Breakdown & 0.3% Treasury Gateway Fee */}
            <div className="glass rounded-2xl p-3 border border-white/5 mb-3 space-y-1.5 text-[11px] text-left">
              <div className="flex items-center justify-between text-white/60">
                <span>Transfer Amount:</span>
                <span className="font-mono text-white font-bold">
                  {parsedAmount > 0 ? parsedAmount.toFixed(4) : '0.0000'} {selectedToken}
                </span>
              </div>

              <div className="flex items-center justify-between text-amber-300">
                <span className="flex items-center gap-1">
                  <span>{selectedToken === 'FARM' ? 'Burn Fee (0.3%):' : 'Treasury Fee (0.3%):'}</span>
                </span>
                <span className="font-mono font-bold">
                  -{gatewayFee.toFixed(4)} {selectedToken} ({gatewayFeeFiat})
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/5 font-bold">
                <span className="text-white">Net Recipient Receives:</span>
                <span className="font-mono text-emerald-400 font-black">
                  {netReceived.toFixed(4)} {selectedToken} ({netReceivedFiat})
                </span>
              </div>

              <div className="flex items-center justify-between text-white/40 text-[10px] pt-1">
                <span>Estimated Network Gas:</span>
                <span className="font-mono">~0.0001 BNB ($0.06)</span>
              </div>
            </div>

            {/* Tooltip & Transparency Note */}
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/20 mb-3.5 flex items-start gap-2 text-left">
              <Sparkles size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-200/80 leading-relaxed">
                {selectedToken === 'FARM' ? (
                  <>A 0.3% fee is sent directly to the <strong>Black Hole (0x...dEaD)</strong> for permanent deflationary burn.</>
                ) : selectedToken === 'BNB' ? (
                  <>A 0.3% fee is routed to the <strong>Treasury Buyback Vault</strong> to accumulate towards automated 2.0 BNB $FARM buybacks.</>
                ) : (
                  <>A 0.3% fee is routed to the <strong>Treasury Buyback Vault</strong> to support token buybacks and liquidity reserves.</>
                )}
              </p>
            </div>

            {/* Low Gas Warning Banner */}
            {isGasInsufficient && (
              <div className="mb-3.5 p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-start gap-2 text-left">
                <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300 text-[11px] leading-snug">
                  Low BNB Gas: You need at least ~{minGasBnb} BNB to cover BSC network gas fees for sending {selectedToken}.
                </p>
              </div>
            )}

            {/* Error Banner */}
            {errorMsg && (
              <div className="mb-3.5 p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 flex items-start gap-2 text-left">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-[11px] leading-snug">{errorMsg}</p>
              </div>
            )}

            {/* Confirm & Send Button */}
            <button
              onClick={handleSend}
              disabled={isSubmitting || !isValidAddress || !amount || parseFloat(amount) <= 0 || isGasInsufficient}
              className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg ${
                isSubmitting || !isValidAddress || !amount || parseFloat(amount) <= 0 || isGasInsufficient
                  ? 'bg-white/10 text-white/40 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-amber-500/20'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Signing via Gateway...</span>
                </div>
              ) : (
                <>
                  <Send size={15} />
                  <span>
                    Confirm & Send (Net: {netReceived > 0 ? netReceived.toFixed(4) : '0.00'} {selectedToken})
                  </span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
