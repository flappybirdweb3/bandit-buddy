import { useState, useEffect, useCallback } from 'react';
import { X, Zap, Loader2, Gift, Star, ExternalLink, RefreshCw, Copy, Check, QrCode, ChevronDown, AlertTriangle, Fuel } from 'lucide-react';
import { createWalletClient, createPublicClient, http, keccak256, encodePacked, parseAbi, decodeEventLog, formatEther } from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useGame } from '@/providers/GameProvider';
import { getStoredWalletPk } from '@/hooks/useAutoWallet';
import { api } from '@/api/client';

interface Props { onClose: () => void }

const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const GACHA_ADDRESS = (import.meta.env.VITE_GACHA_CONTRACT_ADDRESS  || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const FARM_ADDRESS  = (import.meta.env.VITE_FARM_TOKEN_ADDRESS      || '0x0000000000000000000000000000000000000000') as `0x${string}`;
// Estimated gas for approve + commit + reveal combined (conservative upper bound)
const GAS_LIMIT_ESTIMATE = 280_000n;
// Warn if BNB < this multiple of estimated gas cost
const BNB_WARN_BUFFER = 1.3;

const GACHA_ABI = parseAbi([
  'function commit(bytes32 commitment) external',
  'function reveal(bytes32 secret) external',
  'function pullCost() external view returns (uint256)',
  'function pendingPulls(address) external view returns (bytes32 commitment, uint256 commitBlock, bool revealed)',
  'function pityCounter(address) external view returns (uint256)',
  'function MIN_REVEAL_BLOCKS() external view returns (uint256)',
  'event Revealed(address indexed player, uint256 indexed tokenId, uint256 pity)',
]);

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 value) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
]);

const DOG_TIERS = [
  { tokenId: 1, name: 'Chihuahua',  defense: 10,  rarity: 'Common',    emoji: '🐶', color: 'text-gray-300',   bg: 'bg-gray-500/15',   border: 'border-gray-400/25',   weight: '60%'  },
  { tokenId: 2, name: 'Corgi',      defense: 20,  rarity: 'Common',    emoji: '🐕', color: 'text-green-300',  bg: 'bg-green-500/15',  border: 'border-green-400/25',  weight: '24%'  },
  { tokenId: 3, name: 'Husky',      defense: 35,  rarity: 'Rare',      emoji: '🐺', color: 'text-blue-300',   bg: 'bg-blue-500/15',   border: 'border-blue-400/25',   weight: '10%'  },
  { tokenId: 4, name: 'Rottweiler', defense: 50,  rarity: 'Epic',      emoji: '🦮', color: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-400/25', weight: '4%'   },
  { tokenId: 5, name: 'Doberman',   defense: 65,  rarity: 'Legendary', emoji: '🐩', color: 'text-amber-300',  bg: 'bg-amber-500/15',  border: 'border-amber-400/25',  weight: '1.5%' },
  { tokenId: 6, name: 'Pitbull',    defense: 80,  rarity: 'Mythic',    emoji: '💪', color: 'text-red-300',    bg: 'bg-red-500/15',    border: 'border-red-400/25',    weight: '0.5%' },
] as const;

type DogTier = typeof DOG_TIERS[number];
type Phase = 'idle' | 'approving' | 'committing' | 'waiting_blocks' | 'revealing' | 'result' | 'error';

function shortAddr(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/total cost|insufficient funds|gas.*balance|balance.*gas/i.test(msg))
    return '⛽ Insufficient BNB for gas. Top up your wallet below.';
  if (/user rejected|user denied|rejected the request/i.test(msg))
    return 'Transaction cancelled.';
  if (/AlreadyPending/i.test(msg))
    return 'You already have a pending pull. Wait for it to resolve.';
  if (/TooEarly/i.test(msg))
    return 'Too early to reveal — wait a few more blocks.';
  if (/CommitExpired/i.test(msg))
    return 'Commit expired (took too long). Start a new pull.';
  if (/WrongSecret/i.test(msg))
    return 'Secret mismatch — do not refresh mid-pull.';
  if (/paused/i.test(msg))
    return 'Gacha is temporarily paused. Try again later.';
  return msg.length > 120 ? msg.slice(0, 120) + '…' : msg;
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a href={`https://testnet.bscscan.com/tx/${hash}`} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 text-blue-300 text-[10px] underline">
      View on BSCScan <ExternalLink size={9} />
    </a>
  );
}

// ── Wallet info panel ────────────────────────────────────────────────────────
interface WalletCardProps {
  address: string;
  bnbBalance: bigint | null;
  farmBalance: bigint | null;
  gasEstimate: bigint | null;
  loading: boolean;
}

function WalletCard({ address, bnbBalance, farmBalance, gasEstimate, loading }: WalletCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const copy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleQr = async () => {
    if (!showQr && !qrUrl) {
      const url = await QRCode.toDataURL(address, { width: 180, margin: 2, color: { dark: '#ffffff', light: '#00000000' } });
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
      {/* Low BNB warning */}
      {isLowBnb && (
        <div className="flex items-start gap-2 mb-3 pb-3 border-b border-amber-400/20">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 text-xs font-bold leading-tight">Low BNB — may fail</p>
            <p className="text-amber-200/60 text-[10px] mt-0.5 leading-relaxed">
              Need ~{gasFloat?.toFixed(4)} BNB for gas.{' '}
              Deposit BNB to your wallet address below.
            </p>
          </div>
        </div>
      )}

      {/* Balances row */}
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
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide mb-0.5">$FARM</p>
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

      {/* Address row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white/5 rounded-xl px-3 py-2 flex items-center gap-2 min-w-0">
          <span className="text-white/50 text-[11px] font-mono truncate flex-1">{shortAddr(address)}</span>
          <button onClick={copy}
            className="flex-shrink-0 text-white/40 hover:text-white active:scale-90 transition-all"
            title="Copy address">
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          </button>
        </div>
        <button
          onClick={toggleQr}
          className={`flex-shrink-0 glass rounded-xl px-2.5 py-2 flex items-center gap-1.5 text-[10px] font-bold transition-all active:scale-95 ${showQr ? 'text-violet-300' : 'text-white/50'}`}
          title="Show QR code">
          <QrCode size={13} />
          QR
          <ChevronDown size={10} className={`transition-transform ${showQr ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* QR code — lazy rendered */}
      {showQr && qrUrl && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="bg-black/40 rounded-2xl p-3 border border-white/10">
            <img src={qrUrl} alt="Wallet QR" width={160} height={160} className="rounded-xl" />
          </div>
          <p className="text-white/30 text-[9px] text-center leading-relaxed">
            Scan to send BNB to this wallet.<br />
            <span className="font-mono text-white/20 break-all">{address}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export function GachaModal({ onClose }: Props) {
  const { profile } = useGame();
  const qc = useQueryClient();

  const [phase, setPhase]               = useState<Phase>('idle');
  const [pityCount, setPityCount]       = useState(0);
  const [revealedTier, setRevealedTier] = useState<DogTier | null>(null);
  const [commitTxHash, setCommitTxHash] = useState<`0x${string}` | null>(null);
  const [revealTxHash, setRevealTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [blocksLeft, setBlocksLeft]     = useState(0);

  // Wallet info state
  const [bnbBalance,  setBnbBalance]  = useState<bigint | null>(null);
  const [farmBalance, setFarmBalance] = useState<bigint | null>(null);
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);
  const [balLoading,  setBalLoading]  = useState(false);

  const pk         = getStoredWalletPk();
  const hasWallet  = !!profile?.walletAddress && !!pk;
  const walletAddr = profile?.walletAddress as `0x${string}` | undefined;

  // Fetch balances + gas estimate on mount
  const fetchBalances = useCallback(async () => {
    if (!walletAddr) return;
    setBalLoading(true);
    try {
      const publicClient = createPublicClient({ chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });

      const [bnb, farm, gasPrice] = await Promise.all([
        publicClient.getBalance({ address: walletAddr }),
        publicClient.readContract({ address: FARM_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [walletAddr] }) as Promise<bigint>,
        publicClient.getGasPrice(),
      ]);

      setBnbBalance(bnb);
      setFarmBalance(farm);
      setGasEstimate(gasPrice * GAS_LIMIT_ESTIMATE);
    } catch {
      // silently skip — non-critical
    } finally {
      setBalLoading(false);
    }
  }, [walletAddr]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const handlePull = async () => {
    if (!pk || !hasWallet) return;

    setError(null);
    setRevealedTier(null);
    setCommitTxHash(null);
    setRevealTxHash(null);

    const account      = privateKeyToAccount(pk);
    const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });
    const publicClient = createPublicClient({ chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });

    try {
      // 1. Approve FARM if needed
      const pullCost  = await publicClient.readContract({ address: GACHA_ADDRESS, abi: GACHA_ABI, functionName: 'pullCost' }) as bigint;
      const allowance = await publicClient.readContract({ address: FARM_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: [account.address, GACHA_ADDRESS] }) as bigint;

      if (allowance < pullCost) {
        setPhase('approving');
        const appTx = await walletClient.writeContract({ address: FARM_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [GACHA_ADDRESS, pullCost] });
        await publicClient.waitForTransactionReceipt({ hash: appTx });
      }

      // 2. Generate secret + commitment
      const secretBytes = crypto.getRandomValues(new Uint8Array(32));
      const secret      = `0x${Array.from(secretBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
      const commitment  = keccak256(encodePacked(['bytes32', 'address'], [secret, account.address]));

      // 3. Commit
      setPhase('committing');
      const commitTx      = await walletClient.writeContract({ address: GACHA_ADDRESS, abi: GACHA_ABI, functionName: 'commit', args: [commitment] });
      setCommitTxHash(commitTx);
      const commitReceipt = await publicClient.waitForTransactionReceipt({ hash: commitTx });
      const commitBlock   = commitReceipt.blockNumber;

      // 4. Wait MIN_REVEAL_BLOCKS
      const minBlocks   = await publicClient.readContract({ address: GACHA_ADDRESS, abi: GACHA_ABI, functionName: 'MIN_REVEAL_BLOCKS' }) as bigint;
      setPhase('waiting_blocks');
      let currentBlock  = await publicClient.getBlockNumber();
      let diff          = Number(commitBlock + minBlocks - currentBlock);
      while (diff > 0) {
        setBlocksLeft(diff);
        await new Promise((r) => setTimeout(r, 3000));
        currentBlock = await publicClient.getBlockNumber();
        diff         = Number(commitBlock + minBlocks - currentBlock);
      }
      setBlocksLeft(0);

      // 5. Reveal
      setPhase('revealing');
      const revealTx      = await walletClient.writeContract({ address: GACHA_ADDRESS, abi: GACHA_ABI, functionName: 'reveal', args: [secret] });
      setRevealTxHash(revealTx);
      const revealReceipt = await publicClient.waitForTransactionReceipt({ hash: revealTx });

      // 6. Parse Revealed event
      let mintedTokenId = 1;
      for (const log of revealReceipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: GACHA_ABI, data: log.data, topics: log.topics }) as any;
          if (decoded.eventName === 'Revealed') {
            mintedTokenId = Number(decoded.args.tokenId);
            setPityCount(mintedTokenId >= 3 ? 0 : Number(decoded.args.pity));
            break;
          }
        } catch { /* skip */ }
      }

      setRevealedTier({ ...( DOG_TIERS.find((d) => d.tokenId === mintedTokenId) ?? DOG_TIERS[0] ) });
      setPhase('result');

      // Sync + refresh balances
      await api.syncNft().catch(() => {});
      qc.invalidateQueries({ queryKey: ['nftStatus'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      fetchBalances();

    } catch (err) {
      setError(friendlyError(err));
      setPhase('error');
      fetchBalances(); // refresh so user sees updated BNB after failed tx
    }
  };

  const reset = () => {
    setPhase('idle');
    setRevealedTier(null);
    setError(null);
    setCommitTxHash(null);
    setRevealTxHash(null);
    setBlocksLeft(0);
  };

  const isPending = !['idle', 'result', 'error'].includes(phase);

  const phaseLabel: Record<Phase, string> = {
    idle:           '',
    approving:      '💰 Approving $FARM spend…',
    committing:     '🔒 Committing to blockchain…',
    waiting_blocks: `⏳ Waiting for block confirmations${blocksLeft > 0 ? ` (${blocksLeft} left)` : ''}…`,
    revealing:      '✨ Revealing your dog…',
    result:         '',
    error:          '',
  };

  const bnbFloat    = bnbBalance  !== null ? parseFloat(formatEther(bnbBalance))  : null;
  const farmFloat   = farmBalance !== null ? parseFloat(formatEther(farmBalance)) : null;
  const gasFloat    = gasEstimate !== null ? parseFloat(formatEther(gasEstimate)) : null;
  const isLowBnb    = bnbBalance !== null && gasEstimate !== null
    && bnbBalance < BigInt(Math.ceil(Number(gasEstimate) * BNB_WARN_BUFFER));
  const insufficientFarm = farmFloat !== null && farmFloat < 50;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up flex flex-col"
        style={{ maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Gift size={18} className="text-violet-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Guard Dog Gacha</h2>
              <p className="text-white/40 text-xs">50 $FARM · Pity guaranteed at 10 pulls</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {/* Wallet card (idle / error state) */}
          {hasWallet && walletAddr && !isPending && phase !== 'result' && (
            <WalletCard
              address={walletAddr}
              bnbBalance={bnbBalance}
              farmBalance={farmBalance}
              gasEstimate={gasEstimate}
              loading={balLoading}
            />
          )}

          {/* Pity tracker */}
          <div className="glass rounded-2xl p-3 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-amber-400" />
              <span className="text-white/60 text-xs font-bold">Pity Counter</span>
              <span className="text-white/25 text-[10px]">Rare+ guaranteed at 10</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={`w-3.5 h-3.5 rounded-sm transition-colors ${i < pityCount ? 'bg-amber-400' : 'bg-white/10'}`} />
                ))}
              </div>
              <span className="text-white/40 text-[10px] w-7">{pityCount}/10</span>
            </div>
          </div>

          {/* Pull hero area */}
          {phase === 'idle' && !revealedTier && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 mb-3 flex flex-col items-center gap-2">
              <div className="text-6xl">🎲</div>
              <p className="text-white/50 text-sm font-bold">50 $FARM per pull</p>
              <p className="text-white/25 text-[10px] text-center leading-relaxed">
                Commit-reveal RNG on BSC · NFT minted to your wallet
              </p>
            </div>
          )}

          {/* Pending states */}
          {isPending && (
            <div className="rounded-3xl border border-violet-400/30 bg-violet-500/10 p-6 mb-3 flex flex-col items-center gap-3">
              <Loader2 size={40} className="text-violet-400 animate-spin" />
              <p className="text-violet-300 text-sm font-bold text-center">{phaseLabel[phase]}</p>
              {commitTxHash && phase !== 'committing' && <TxLink hash={commitTxHash} />}
            </div>
          )}

          {/* Error */}
          {phase === 'error' && error && (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 mb-3 flex gap-3 items-start">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-300 text-xs leading-relaxed">{error}</p>
                <button onClick={reset} className="mt-2 glass rounded-xl px-3 py-1 text-white/50 text-[10px]">
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Result */}
          {phase === 'result' && revealedTier && (
            <div className={`rounded-3xl border p-7 mb-3 flex flex-col items-center gap-3 ${revealedTier.bg} ${revealedTier.border}`}>
              <div className="text-7xl animate-bounce">{revealedTier.emoji}</div>
              <div className="text-center">
                <p className={`text-xl font-black ${revealedTier.color}`}>{revealedTier.name}</p>
                <p className="text-white/40 text-xs mt-1">{revealedTier.rarity} · −{revealedTier.defense}% steal chance</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                {revealTxHash && <TxLink hash={revealTxHash} />}
                <p className="text-white/25 text-[10px] flex items-center gap-1">
                  <RefreshCw size={8} /> Go to Settings → Sync NFTs to activate
                </p>
              </div>
            </div>
          )}

          {/* Odds table — hide while pending */}
          {!isPending && phase !== 'error' && (
            <div className="glass rounded-2xl p-3 mb-4">
              <p className="text-white/40 text-[10px] font-bold mb-2 text-center tracking-widest">PULL RATES</p>
              <div className="grid grid-cols-3 gap-1.5">
                {DOG_TIERS.map((d) => (
                  <div key={d.tokenId} className={`rounded-xl p-2 text-center ${d.bg}`}>
                    <p className="text-lg">{d.emoji}</p>
                    <p className={`text-[9px] font-bold ${d.color}`}>{d.rarity}</p>
                    <p className="text-white/30 text-[8px]">{d.weight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No wallet fallback */}
          {!hasWallet && (
            <p className="text-amber-400/80 text-xs text-center mb-3">
              A BSC wallet is auto-created on first load. Check Settings.
            </p>
          )}

          {/* Insufficient FARM notice */}
          {hasWallet && insufficientFarm && phase === 'idle' && (
            <p className="text-amber-400/70 text-[10px] text-center mb-3">
              You have {farmFloat?.toFixed(0)} $FARM — need 50 to pull.
            </p>
          )}

          {/* CTA button */}
          {phase === 'result' ? (
            <div className="flex gap-2">
              <button onClick={reset}
                className="flex-1 py-4 rounded-2xl text-sm font-black active:scale-95 transition-all flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff' }}>
                <Gift size={14} /> Pull Again
              </button>
              <button onClick={onClose} className="flex-1 py-4 rounded-2xl glass text-white/60 font-bold text-sm active:scale-95">
                Close
              </button>
            </div>
          ) : (
            <button
              disabled={!hasWallet || isPending || insufficientFarm}
              onClick={handlePull}
              className="w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{
                background: (hasWallet && !isPending && !insufficientFarm) ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : undefined,
                color: '#fff',
                boxShadow: (hasWallet && !isPending && !insufficientFarm) ? '0 0 20px rgba(124,58,237,0.4)' : undefined,
              }}
            >
              {isPending
                ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
                : isLowBnb
                  ? <><AlertTriangle size={15} className="text-amber-300" /> Pull (Low BNB — may fail)</>
                  : <><Zap size={15} /> Pull (50 $FARM)</>
              }
            </button>
          )}

          <p className="text-white/15 text-[10px] text-center mt-3 leading-relaxed">
            Commit-reveal RNG · $FARM burned · NFT minted on BSC Testnet
          </p>
        </div>
      </div>
    </div>
  );
}
