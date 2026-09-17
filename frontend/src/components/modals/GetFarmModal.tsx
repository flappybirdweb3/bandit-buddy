import { useState } from "react";
import { X, ExternalLink, Copy, Check, AlertTriangle } from "lucide-react";
import WebApp from "@twa-dev/sdk";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useDexTier } from "@/hooks/useDexTier";

const FARM_ADDRESS = import.meta.env.VITE_FARM_TOKEN_ADDRESS ?? "";
const PANCAKE_URL = `https://pancakeswap.finance/swap?outputCurrency=${FARM_ADDRESS}&inputCurrency=BNB`;

function shortAddr(addr: string) {
  return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";
}

function minutesAgo(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

interface Props {
  onClose: () => void;
}

export function GetFarmModal({ onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const { rate, isLive, killSwitchActive, farmPriceUsd, farmPriceBnb } = useExchangeRate(180_000);
  const { tier, buyTaxPct, sellTaxPct, volume24h, walletAddress } = useDexTier();

  const handleCopy = () => {
    if (!FARM_ADDRESS) return;
    navigator.clipboard.writeText(FARM_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end px-7 py-2" style={{ paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 32px)) + 100px)' }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl glass mx-auto rounded-3xl overflow-hidden slide-up p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-white">Get $FARM</h2>
            <p className="text-xs text-white/40 mt-0.5">BSC · PancakeSwap V2</p>
          </div>
          <button
            onClick={onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Live price card */}
        <div className="glass-gold rounded-2xl p-4 mb-3" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
          {isLive ? (
            <>
              <div className="text-2xl font-black text-amber-400">
                ${farmPriceUsd.toFixed(6)}
              </div>
              <div className="text-sm text-white/60 mt-0.5">
                BNB {farmPriceBnb > 0 ? farmPriceBnb.toFixed(8) : "—"}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400 font-semibold">Live · PancakeSwap</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-white/50">Price loading…</div>
              <div className="text-xs text-white/40 mt-1">⚪ Estimated rate only</div>
            </>
          )}
          {rate?.lastUpdated && (
            <div className="text-[10px] text-white/30 mt-2">
              Updated {minutesAgo(rate.lastUpdated)}m ago
            </div>
          )}
        </div>

        {/* Tax Tier info */}
        {walletAddress && (
          <div className="glass rounded-2xl p-3.5 mb-3 flex items-center justify-between" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{tier === 3 ? '👑' : tier === 2 ? '🌟' : '⭐'}</span>
                <span>Tier {tier} Tax Rate</span>
              </div>
              <div className="text-[11px] text-white/50 mt-0.5">
                Buy: <span className="text-emerald-400 font-semibold">{buyTaxPct}</span> · Sell: <span className="text-amber-400 font-semibold">{sellTaxPct}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/40">24h Volume</div>
              <div className="text-xs font-mono font-bold text-white/80">{Math.round(volume24h).toLocaleString()} FARM</div>
            </div>
          </div>
        )}

        {/* Kill switch warning */}
        {killSwitchActive && (
          <div className="glass rounded-xl p-3 mb-3 border border-red-500/30 flex items-start gap-2" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">
              Conversion paused — high market volatility. Try again later.
            </p>
          </div>
        )}

        {/* In-App Instant Swap CTA */}
        <button
          onClick={() => {
            onClose();
            import('@/game/EventBus').then(({ eventBus }) => eventBus.emit('show-claim'));
          }}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] transition rounded-2xl py-3.5 font-black text-black flex items-center justify-center gap-2 mb-2 shadow-lg"
        >
          <span>🌾 Instant Swap in App (DEX &amp; Peg)</span>
        </button>

        {/* Buy CTA on PancakeSwap */}
        <button
          onClick={() => WebApp.openLink(PANCAKE_URL)}
          className="w-full glass hover:bg-white/10 active:scale-[0.98] transition rounded-2xl py-3 font-bold text-white/80 text-xs flex items-center justify-center gap-2 mb-3"
        >
          Open PancakeSwap in Browser
          <ExternalLink size={14} />
        </button>

        {/* Contract address */}
        {FARM_ADDRESS && (
          <div className="glass rounded-xl p-3 mb-4 flex items-center justify-between" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-white/40">Contract</div>
              <div className="text-sm font-mono text-white/80">{shortAddr(FARM_ADDRESS)}</div>
            </div>
            <button
              onClick={handleCopy}
              className="glass rounded-lg px-3 py-2 flex items-center gap-1.5 active:scale-90 transition-all"
              style={{ marginRight: '6px' }}
            >
              {copied ? (
                <>
                  <Check size={13} className="text-green-400" />
                  <span className="text-xs text-green-400 font-semibold">Copied!</span>
                </>
              ) : (
                <Copy size={13} className="text-white/60" />
              )}
            </button>
          </div>
        )}

        {/* Steps */}
        <div className="text-white/40 text-xs space-y-1 px-1">
          <p>1. Open TrustWallet or MetaMask</p>
          <p>2. Switch to BSC Mainnet</p>
          <p>3. Swap BNB → $FARM</p>
        </div>
      </div>
    </div>
  );
}
