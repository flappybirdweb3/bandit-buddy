import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, http, formatEther } from 'viem';
import { bscTestnet } from 'viem/chains';
import {
  X, Gem, ArrowRight, CheckCircle2, ExternalLink, AlertTriangle,
  Loader2, Copy, Check, QrCode, ChevronDown, Fuel, ArrowDownLeft, TrendingUp,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useClaimTokens } from '@/hooks/useClaimTokens';
import type { ClaimStep } from '@/hooks/useClaimTokens';
import { useGame } from '@/providers/GameProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { GetFarmModal } from '@/components/modals/GetFarmModal';

interface Props { onClose: () => void }

const BSC_TESTNET_RPC  = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const FARM_ADDRESS     = (import.meta.env.VITE_FARM_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const CLAIM_GAS_LIMIT  = 180_000n;
const MIN_BNB_FOR_GAS  = BigInt('2000000000000000'); // 0.002 BNB
const BNB_WARN_BUFFER  = 1.3;
// Mirrors FarmTokenClaim.maxClaimAmount (default 100,000 FARM). The backend parses each
// GOLD unit as 1e18 FARM, so a request above this always reverts AmountOutOfBounds —
// clamping the MAX button stops us from asking for a claim the contract will reject.
const MAX_CLAIM_GOLD   = 100_000;

const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
] as const;

type ModalTab = 'claim' | 'deposit';

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
  onGetFarm?: () => void;
}

function WalletCard({ address, bnbBalance, farmBalance, gasEstimate, loading, dexTier, onGetFarm }: WalletCardProps) {
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
        <div className="flex items-start gap-2 mb-3 pb-3 border-b border-amber-400/20">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 text-xs font-bold leading-tight">Low BNB — claim may fail</p>
            <p className="text-amber-200/60 text-[10px] mt-0.5 leading-relaxed">
              Need ~{gasFloat?.toFixed(4)} BNB for gas. Deposit tBNB to the address below.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide mb-0.5">BNB Balance</p>
          {loading ? (
            <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className={`text-sm font-black ${isLowBnb ? 'text-amber-300' : 'text-white'}`}>
              {bnbFloat !== null ? bnbFloat.toFixed(4) : '—'} BNB
            </p>
          )}
        </div>
        <div className="flex-1">
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide mb-0.5">$FARM Held</p>
          {loading ? (
            <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className="text-sm font-black text-amber-300">
              {farmFloat !== null ? farmFloat.toFixed(0) : '—'}
            </p>
          )}
        </div>
        <div className="flex-1">
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide mb-0.5">Est. Gas</p>
          {loading ? (
            <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className="text-[11px] font-bold text-white/50 flex items-center gap-0.5">
              <Fuel size={9} className="text-blue-300" />
              ~{gasFloat?.toFixed(4) ?? '—'} BNB
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white/5 rounded-xl px-3 py-2 flex items-center gap-2 min-w-0">
          <span className="text-white/50 text-[11px] font-mono truncate flex-1">{shortAddr(address)}</span>
          <button
            onClick={copy}
            className="flex-shrink-0 text-white/40 hover:text-white active:scale-90 transition-all"
            title="Copy address"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          </button>
        </div>
        <button
          onClick={toggleQr}
          className={`flex-shrink-0 glass rounded-xl px-2.5 py-2 flex items-center gap-1.5 text-[10px] font-bold transition-all active:scale-95 ${showQr ? 'text-violet-300' : 'text-white/50'}`}
        >
          <QrCode size={13} />
          QR
          <ChevronDown size={10} className={`transition-transform ${showQr ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* DEX tier badge */}
      {dexTier && (() => {
        const t = Math.min(Math.max(dexTier.tier, 1), 3);
        const style = TIER_STYLES[t];
        return (
          <button
            onClick={onGetFarm}
            className={`mt-2 w-full flex items-center justify-between rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all active:scale-[0.98] ${style.pill}`}
          >
            <span className="flex items-center gap-1.5">
              <TrendingUp size={11} />
              Tier {t} · {style.label}
            </span>
            <span className="opacity-70">
              Buy {(dexTier.buyTax * 100).toFixed(1)}% / Sell {(dexTier.sellTax * 100).toFixed(1)}%
            </span>
          </button>
        );
      })()}

      {showQr && qrUrl && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="bg-black/40 rounded-2xl p-3 border border-white/10">
            <img src={qrUrl} alt="Wallet QR" width={160} height={160} className="rounded-xl" />
          </div>
          <p className="text-white/30 text-[9px] text-center leading-relaxed">
            Scan to deposit tBNB to this wallet.<br />
            <span className="font-mono text-white/20 break-all">{address}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Deposit Tab ───────────────────────────────────────────────────────────────
function DepositTab() {
  const queryClient = useQueryClient();
  const [txHash, setTxHash] = useState('');
  const [success, setSuccess] = useState<{ goldCredited: number; farmAmount: number } | null>(null);

  const { data: depositInfo, isLoading } = useQuery({
    queryKey: ['deposit-info'],
    queryFn: api.getDepositInfo,
    staleTime: 60_000,
  });

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
        width: 180, margin: 2,
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
    },
  });

  const canVerify = /^0x[0-9a-fA-F]{64}$/.test(txHash) && !mutation.isPending;

  return (
    <div>
      {/* Rate card */}
      <div className="glass rounded-2xl p-4 mb-3 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-amber-300 font-black text-lg">1 $FARM</span>
          <ArrowRight size={14} className="text-white/30" />
          <span className="text-green-300 font-black text-lg">100 GOLD</span>
        </div>
        <p className="text-white/40 text-[10px]">Fixed rate · Credited instantly after verification</p>
      </div>

      {/* Treasury address */}
      {isLoading ? (
        <div className="glass rounded-2xl h-16 mb-3 animate-pulse" />
      ) : depositInfo && (
        <div className="glass rounded-2xl p-3 mb-3">
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide mb-2">
            Send $FARM to this address (BSC Testnet)
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/5 rounded-xl px-3 py-2 flex items-center gap-2 min-w-0">
              <span className="text-white/70 text-[11px] font-mono truncate flex-1">
                {shortAddr(depositInfo.treasuryAddress)}
              </span>
              <button onClick={copyAddr} className="flex-shrink-0 text-white/40 hover:text-white active:scale-90 transition-all">
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              </button>
            </div>
            <button
              onClick={toggleQr}
              className={`flex-shrink-0 glass rounded-xl px-2.5 py-2 flex items-center gap-1.5 text-[10px] font-bold transition-all active:scale-95 ${showQr ? 'text-violet-300' : 'text-white/50'}`}
            >
              <QrCode size={13} />
              QR
              <ChevronDown size={10} className={`transition-transform ${showQr ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showQr && qrUrl && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="bg-black/40 rounded-2xl p-3 border border-white/10">
                <img src={qrUrl} alt="Treasury QR" width={160} height={160} className="rounded-xl" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success state */}
      {success && (
        <div className="glass rounded-2xl p-4 mb-3 border border-green-400/25 bg-green-500/10 text-center">
          <CheckCircle2 size={28} className="text-green-400 mx-auto mb-2" />
          <p className="text-green-300 font-black text-base">+{success.goldCredited} GOLD credited!</p>
          <p className="text-white/40 text-xs mt-1">{success.farmAmount} $FARM converted</p>
          <button
            onClick={() => setSuccess(null)}
            className="mt-3 text-white/40 text-[10px] underline"
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
              placeholder="Enter transaction txHash (0x…)"
              disabled={mutation.isPending}
              className="flex-1 bg-transparent px-4 py-3.5 text-white text-sm outline-none placeholder:text-white/30 disabled:opacity-50 font-mono"
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
            className="w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 text-white"
            style={{
              background: canVerify ? 'linear-gradient(135deg, #059669, #047857)' : undefined,
              boxShadow: canVerify ? '0 0 20px rgba(5,150,105,0.4)' : undefined,
            }}
          >
            {mutation.isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Verifying…</>
            ) : (
              <><ArrowDownLeft size={15} /> Verify &amp; Receive GOLD</>
            )}
          </button>
        </>
      )}

      <p className="text-white/20 text-[10px] text-center mt-4 leading-relaxed">
        Send minimum 1 $FARM · Only from your linked wallet
      </p>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function ClaimModal({ onClose }: Props) {
  const { profile } = useGame();
  const { claim, refund, step, txHash, error, reset, refundable, refunding } = useClaimTokens();
  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState<ModalTab>('claim');
  const [showGetFarm, setShowGetFarm] = useState(false);

  const [bnbBalance,  setBnbBalance]  = useState<bigint | null>(null);
  const [farmBalance, setFarmBalance] = useState<bigint | null>(null);
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);
  const [balLoading,  setBalLoading]  = useState(false);

  const { data: exchangeRate } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: api.getExchangeRate,
    staleTime: 5 * 60 * 1000,
  });
  const goldPerFarm = exchangeRate?.goldPerFarm ?? 1;
  const inflationWarning = exchangeRate?.inflationWarning ?? false;

  const { data: dexTier } = useQuery({
    queryKey: ['dex-tier'],
    queryFn: api.getDexTier,
    staleTime: 60_000,
    enabled: !!profile?.walletAddress,
  });

  const address = (profile?.walletAddress as `0x${string}` | undefined) ?? null;

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

  useEffect(() => { fetchBalances(); }, [fetchBalances]);
  useEffect(() => { if (step === 'success') fetchBalances(); }, [step, fetchBalances]);

  const maxClaimable = Math.min(Math.floor(profile?.goldBalance ?? 0), MAX_CLAIM_GOLD);
  const parsed   = parseInt(amount, 10) || 0;
  const hasBnb   = bnbBalance === null || bnbBalance >= MIN_BNB_FOR_GAS;
  const isBusy   = step === 'requesting_sig' || step === 'sending_tx' || step === 'confirming';
  const trustOk  = (profile?.trustScore ?? 0) >= 30;
  const canClaim = parsed >= 1 && parsed <= maxClaimable && hasBnb && !isBusy && trustOk && step !== 'success';

  const handleClose = () => { reset(); onClose(); };

  return (
    <>
    {showGetFarm && <GetFarmModal onClose={() => setShowGetFarm(false)} />}
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
              <h2 className="text-white font-black text-base leading-none">GOLD &harr; $FARM</h2>
              <p className="text-white/40 text-xs">Token exchange on BSC Testnet</p>
            </div>
          </div>
          <button onClick={handleClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex glass rounded-2xl p-1 mb-4 gap-1">
          <button
            onClick={() => setActiveTab('claim')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'claim' ? 'bg-violet-600 text-white shadow-lg' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Gem size={12} />
            Withdraw $FARM
          </button>
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'deposit' ? 'bg-green-600 text-white shadow-lg' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <ArrowDownLeft size={12} />
            Deposit GOLD
          </button>
        </div>

        {/* Deposit tab */}
        {activeTab === 'deposit' && <DepositTab />}

        {/* Claim tab */}
        {activeTab === 'claim' && (
          <>
            {/* Step tracker */}
            {isBusy && <StepTracker step={step} />}

            {/* Wallet card */}
            {address ? (
              <WalletCard
                address={address}
                bnbBalance={bnbBalance}
                farmBalance={farmBalance}
                gasEstimate={gasEstimate}
                loading={balLoading}
                dexTier={dexTier}
                onGetFarm={() => setShowGetFarm(true)}
              />
            ) : (
              <div className="glass rounded-2xl p-3 mb-3 text-center text-white/40 text-xs">
                No wallet found. Re-open the app to auto-create one.
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

            {/* Inflation warning */}
            {inflationWarning && (
              <div className="glass rounded-2xl p-3 mb-3 flex items-start gap-2.5 border border-orange-500/30 bg-orange-500/10">
                <AlertTriangle size={15} className="text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-orange-300 text-xs font-bold leading-tight">High inflation</p>
                  <p className="text-orange-200/60 text-[10px] mt-0.5 leading-relaxed">
                    Current rate {goldPerFarm.toFixed(0)} GOLD = 1 $FARM. In-game GOLD is abundant. Consider this before withdrawing.
                  </p>
                </div>
              </div>
            )}

            {/* GOLD available + exchange rate */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="glass-gold rounded-2xl p-3 text-center">
                <p className="text-amber-300 font-black text-2xl">{maxClaimable}</p>
                <p className="text-white/40 text-[10px] mt-1">GOLD Available</p>
              </div>
              <div className="glass-purple rounded-2xl p-3 text-center flex flex-col items-center justify-center gap-1">
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold text-sm ${inflationWarning ? 'text-orange-300' : 'text-amber-300'}`}>
                    {goldPerFarm === 1 ? '1 G' : `${goldPerFarm.toFixed(0)} G`}
                  </span>
                  <ArrowRight size={12} className="text-white/30" />
                  <span className="text-violet-300 font-bold text-sm">1 $FARM</span>
                </div>
                <p className="text-white/30 text-[10px]">
                  {exchangeRate?.farmInTreasury
                    ? `Treasury: ${exchangeRate.farmInTreasury.toFixed(0)} $FARM`
                    : 'Live rate'}
                </p>
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
                  background: canClaim ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : undefined,
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
              <div className="mt-3 text-center">
                <p className="text-red-400 text-xs leading-snug mb-2">{error}</p>
                {refundable && (
                  <button
                    onClick={refund}
                    disabled={refunding}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold active:scale-95 transition-all disabled:opacity-50"
                  >
                    {refunding ? (
                      <><Loader2 size={12} className="animate-spin" /> Refunding…</>
                    ) : (
                      '↩ Refund GOLD'
                    )}
                  </button>
                )}
              </div>
            )}

            <p className="text-white/20 text-[10px] text-center mt-4 leading-relaxed">
              GOLD deducted immediately · $FARM arrives after BSC Testnet confirmation (~3–5s)
            </p>
          </>
        )}
      </div>
    </div>
    </>
  );
}
