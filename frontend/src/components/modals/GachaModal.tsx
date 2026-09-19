import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Zap, Loader2, Gift, Star, ExternalLink, RefreshCw, Copy, Check,
  QrCode, ChevronDown, AlertTriangle, Fuel, Flame, Sparkles, Shield,
  CheckCircle2, ArrowRight, Bone, Award, ChevronRight, HelpCircle,
  Coins, HeartHandshake, Layers
} from 'lucide-react';
import {
  createWalletClient, createPublicClient, http, keccak256,
  encodePacked, parseAbi, decodeEventLog, formatEther
} from 'viem';
import { bscTestnet } from 'viem/chains';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useGame } from '@/providers/GameProvider';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { api } from '@/api/client';
import { NftStatus, MarketplaceListing, TreasuryStatus } from '@/types/game.types';

interface Props { onClose: () => void }

const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const GACHA_ADDRESS = (import.meta.env.VITE_GACHA_CONTRACT_ADDRESS || '0x8fdD78C87793084384257fe14Fe448E12220e9d6') as `0x${string}`;
const FARM_ADDRESS  = (import.meta.env.VITE_FARM_TOKEN_ADDRESS     || '0xB10067A034078E3FC8335Fb003eEF7334C44952f') as `0x${string}`;
const NFT_ADDRESS   = (import.meta.env.VITE_NFT_CONTRACT_ADDRESS    || '0x67dd94bAb17F6584d409816fee1EDD5612e7caEa') as `0x${string}`;
const TREASURY_ADDRESS = (import.meta.env.VITE_TREASURY_CONTRACT_ADDRESS || '0xe59FfB05EdF59464e8803E81A4d790d828915006') as `0x${string}`;
const SOUL_SHARD_ID = 9999n;

// Estimated gas for multi-step Web3 actions
const GAS_LIMIT_ESTIMATE = 320_000n;
const BNB_WARN_BUFFER = 1.3;

// Protocol BNB & FARM fees (v4.2 Architecture)
const GOLDEN_PULL_BNB_FEE = 2_000_000_000_000_000n; // 0.002 BNB
const BULK10_BNB_FEE = 15_000_000_000_000_000n;     // 0.015 BNB
const BULK10_FARM_COST = 450;                       // 450 FARM

const FORGE_INSURANCE_FEES: Record<number, bigint> = {
  1: 2_000_000_000_000_000n,  // 0.002 BNB
  2: 4_000_000_000_000_000n,  // 0.004 BNB
  3: 8_000_000_000_000_000n,  // 0.008 BNB
  4: 15_000_000_000_000_000n, // 0.015 BNB
};

const GACHA_ABI = parseAbi([
  'function commit(bytes32 commitment) external',
  'function commitGolden(bytes32 commitment, address referrer) external payable',
  'function commitBulk10(bytes32 commitment, address referrer) external payable',
  'function reveal(bytes32 secret) external',
  'function pullCost() external view returns (uint256)',
  'function pendingPulls(address) external view returns (bytes32 commitment, uint256 commitBlock, bool revealed, bool isGolden, bool isBulk10, address referrer)',
  'function pityCounter(address) external view returns (uint256)',
  'function MIN_REVEAL_BLOCKS() external view returns (uint256)',
  'function redeemShards() external',
  'function redeemShards(uint256 count) external',
  'function redeemShards(uint256 count, uint256 nonce, bytes calldata sig) external',
  'function requestFusion(uint256 baseTierId, bool useLuckyBone, bool useCollar, bool useDivineInsurance, address referrer) external payable returns (uint256)',
  'function resolveFusion(uint256 requestId, bool isSuccess, uint256 shardsToReward) external',
  'function getFusionFee(uint256 tierId) external view returns (uint256)',
  'function luckyBoneFee() external view returns (uint256)',
  'function collarFee() external view returns (uint256)',
  'function goldenPullBnbFee() external view returns (uint256)',
  'function bulk10PullBnbFee() external view returns (uint256)',
  'function bulk10FarmCost() external view returns (uint256)',
  'function forgeInsuranceFees(uint256 tierId) external view returns (uint256)',
  'function referralBalances(address account) external view returns (uint256)',
  'function claimReferralBnb() external',
  'function jackpotPoolBnb() external view returns (uint256)',
  'event FusionRequested(uint256 indexed requestId, address indexed player, uint256 indexed baseTierId, bool useLuckyBone, bool useCollar, bool useDivineInsurance, uint256 totalCost)',
  'event FusionResolved(uint256 indexed requestId, address indexed player, bool isSuccess, uint256 upgradedTier, uint256 shardsRewarded)',
  'event Committed(address indexed player, bytes32 commitment, uint256 commitBlock)',
  'event GoldenCommitted(address indexed player, bytes32 commitment, address indexed referrer, uint256 commitBlock)',
  'event BulkCommitted(address indexed player, bytes32 commitment, address indexed referrer, uint256 commitBlock)',
  'event Revealed(address indexed player, uint256 indexed tokenId, uint256 pity)',
  'event BulkRevealed(address indexed player, uint256[] tokenIds, uint256 pity)',
  'event SoulShardMinted(address indexed player, uint256 amount)',
  'event ShardsRedeemed(address indexed player, uint256 count, uint256[] tiers)',
  'event ReferralBnbCredited(address indexed referrer, address indexed player, uint256 amount)',
  'event ReferralBnbClaimed(address indexed referrer, uint256 amount)',
  'event JackpotFunded(uint256 amountAdded, uint256 totalJackpot)',
  'event JackpotTriggered(address indexed winner, uint256 indexed tokenId, uint256 jackpotAmount)',
]);

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 value) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
]);

const NFT_ABI = parseAbi([
  'function balanceOf(address account, uint256 id) external view returns (uint256)',
  'function balanceOfBatch(address[] accounts, uint256[] ids) external view returns (uint256[])',
  'function isApprovedForAll(address account, address operator) external view returns (bool)',
  'function setApprovalForAll(address operator, bool approved) external',
]);

export interface DogTierInfo {
  tokenId: number;
  name: string;
  defense: number;
  rarity: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
  weight: string;
  goldenWeight: string;
}

const DOG_TIERS: DogTierInfo[] = [
  { tokenId: 1, name: 'Chihuahua',  defense: 10,  rarity: 'Common',    emoji: '🐶', color: 'text-gray-300',   bg: 'bg-gray-500/15',   border: 'border-gray-400/25',   weight: '60%',   goldenWeight: '30%' },
  { tokenId: 2, name: 'Corgi',      defense: 20,  rarity: 'Uncommon',  emoji: '🐕', color: 'text-green-300',  bg: 'bg-green-500/15',  border: 'border-green-400/25',  weight: '24%',   goldenWeight: '28%' },
  { tokenId: 3, name: 'Husky',      defense: 35,  rarity: 'Rare',      emoji: '🐺', color: 'text-blue-300',   bg: 'bg-blue-500/15',   border: 'border-blue-400/25',   weight: '10%',   goldenWeight: '20% (2x)' },
  { tokenId: 4, name: 'Rottweiler', defense: 50,  rarity: 'Epic',      emoji: '🦮', color: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-400/25', weight: '4%',    goldenWeight: '12% (3x)' },
  { tokenId: 5, name: 'Doberman',   defense: 65,  rarity: 'Legendary', emoji: '🐩', color: 'text-amber-300',  bg: 'bg-amber-500/15',  border: 'border-amber-400/25',  weight: '1.5%',  goldenWeight: '6% (4x)' },
  { tokenId: 6, name: 'Pitbull',    defense: 80,  rarity: 'Mythic',    emoji: '💪', color: 'text-red-300',    bg: 'bg-red-500/15',    border: 'border-red-400/25',    weight: '0.5%',  goldenWeight: '4% (8x)' },
];

export interface FusionRecipe {
  baseTier: number;
  baseDog: DogTierInfo;
  targetDog: DogTierInfo;
  costFarm: number;
  baseRate: number;
  failShards: number;
}

const FUSION_RECIPES: FusionRecipe[] = [
  { baseTier: 1, baseDog: DOG_TIERS[0], targetDog: DOG_TIERS[1], costFarm: 20,  baseRate: 75, failShards: 1 },
  { baseTier: 2, baseDog: DOG_TIERS[1], targetDog: DOG_TIERS[2], costFarm: 80,  baseRate: 50, failShards: 3 },
  { baseTier: 3, baseDog: DOG_TIERS[2], targetDog: DOG_TIERS[3], costFarm: 250, baseRate: 30, failShards: 8 },
  { baseTier: 4, baseDog: DOG_TIERS[3], targetDog: DOG_TIERS[4], costFarm: 800, baseRate: 15, failShards: 20 },
];

const LUCKY_BONE_COST = 50;
const PROTECTION_COLLAR_COST = 150;

type ModalTab = 'forge' | 'pity' | 'gacha';
type GachaPhase = 'idle' | 'approving' | 'committing' | 'waiting_blocks' | 'revealing' | 'result' | 'error';
type FusionPhase = 'idle' | 'approving_farm' | 'approving_nft' | 'requesting' | 'forging' | 'result' | 'error';
type PityPhase = 'idle' | 'redeeming' | 'result' | 'error';

function shortAddr(addr?: string | null) {
  if (!addr || typeof addr !== 'string') return '';
  if (addr.length <= 10) return addr;
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/total cost|insufficient funds|gas.*balance|balance.*gas/i.test(msg))
    return '⛽ Insufficient BNB for fees or gas. Please deposit BNB into your wallet.';
  if (/user rejected|user denied|rejected the request/i.test(msg))
    return 'Transaction was rejected by user.';
  if (/ERC20InsufficientAllowance|0xfb8f41b2/i.test(msg))
    return 'Approve $FARM tokens before proceeding.';
  if (/ERC20InsufficientBalance|transfer amount exceeds balance/i.test(msg))
    return 'Insufficient $FARM balance in your wallet.';
  if (/ERC1155InsufficientBalance/i.test(msg))
    return 'You do not own enough Dog NFTs of this tier.';
  if (/InsufficientShards|0x669145fb/i.test(msg))
    return 'Insufficient Soul Shards (minimum 100 shards required).';
  if (/InsufficientBnbFee|0x344b54e7/i.test(msg))
    return 'Insufficient BNB fee provided for this operation.';
  if (/NoReferralBnbToClaim/i.test(msg))
    return 'No pending referral BNB reward to claim.';
  if (/paused/i.test(msg))
    return 'The system is temporarily paused for maintenance. Please check back shortly.';
  return msg.length > 140 ? msg.slice(0, 140) + '…' : msg;
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a href={`https://testnet.bscscan.com/tx/${hash}`} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 text-blue-300 text-[11px] underline font-mono">
      View on BSCScan <ExternalLink size={10} />
    </a>
  );
}

// ── Wallet Info Card ──────────────────────────────────────────────────────────
interface WalletCardProps {
  address: string;
  bnbBalance: bigint | null;
  farmBalance: bigint | null;
  soulShardBalance: bigint | null;
  gasEstimate: bigint | null;
  referralBalance?: bigint | null;
  onClaimReferral?: () => void;
  claimLoading?: boolean;
  loading: boolean;
}

function WalletCard({
  address,
  bnbBalance,
  farmBalance,
  soulShardBalance,
  gasEstimate,
  referralBalance,
  onClaimReferral,
  claimLoading,
  loading,
}: WalletCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const copy = () => {
    if (navigator?.clipboard?.writeText && address) {
      navigator.clipboard.writeText(address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  const toggleQr = async () => {
    if (!showQr && !qrUrl && address) {
      try {
        const url = await QRCode.toDataURL(address, { width: 180, margin: 2, color: { dark: '#ffffff', light: '#00000000' } });
        setQrUrl(url);
      } catch (e) {
        console.warn('[WalletCard] QR generation failed:', e);
      }
    }
    setShowQr((v) => !v);
  };

  let bnbFloat: number | null = null;
  let farmFloat: number | null = null;
  let gasFloat: number | null = null;
  try {
    if (bnbBalance !== null) bnbFloat = parseFloat(formatEther(bnbBalance));
    if (farmBalance !== null) farmFloat = parseFloat(formatEther(farmBalance));
    if (gasEstimate !== null) gasFloat = parseFloat(formatEther(gasEstimate));
  } catch {
    // ignore
  }
  const shardCount = soulShardBalance !== null ? Number(soulShardBalance) : 0;
  const isLowBnb =
    bnbBalance !== null && gasEstimate !== null && bnbBalance < (gasEstimate * 13n) / 10n;

  return (
    <div className={`rounded-2xl p-3 mb-3 ${isLowBnb ? 'bg-amber-500/10 border border-amber-400/30' : 'glass'}`}>
      {isLowBnb && (
        <div className="flex items-start gap-2 mb-2 pb-2 border-b border-amber-400/20">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 text-xs font-bold leading-tight">Low BNB Gas Balance</p>
            <p className="text-amber-200/70 text-[10px] mt-0.5">
              Requires ~{gasFloat?.toFixed(4) ?? '0.001'} BNB for BSC gas fees. Please deposit BNB.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5 mb-2.5">
        <div>
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide">BNB Wallet</p>
          {loading ? (
            <div className="h-4 w-12 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className={`text-xs font-black ${isLowBnb ? 'text-amber-300' : 'text-white'}`}>
              {bnbFloat !== null ? bnbFloat.toFixed(4) : '—'}
            </p>
          )}
        </div>
        <div>
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide">$FARM</p>
          {loading ? (
            <div className="h-4 w-12 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className="text-xs font-black text-amber-300">
              {farmFloat !== null ? farmFloat.toFixed(1) : '—'}
            </p>
          )}
        </div>
        <div>
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide">Soul Shards</p>
          {loading ? (
            <div className="h-4 w-12 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className="text-xs font-black text-violet-300 flex items-center gap-0.5">
              <span>💎</span> {shardCount}
            </p>
          )}
        </div>
        <div>
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-wide">Est. Gas</p>
          {loading ? (
            <div className="h-4 w-12 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className="text-[10px] font-bold text-white/60 flex items-center gap-0.5">
              <Fuel size={9} className="text-blue-300" />
              ~{gasFloat?.toFixed(4) ?? '—'}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white/5 rounded-xl px-2.5 py-1.5 flex items-center gap-2 min-w-0">
          <span className="text-white/50 text-[11px] font-mono truncate flex-1">{shortAddr(address)}</span>
          <button onClick={copy} className="flex-shrink-0 text-white/40 hover:text-white active:scale-90 transition-all">
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
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
          <div className="bg-black/40 rounded-2xl p-2.5 border border-white/10">
            <img src={qrUrl} alt="Wallet QR" width={140} height={140} className="rounded-xl" />
          </div>
          <p className="text-white/30 text-[9px] text-center">
            Scan to transfer BNB into your wallet address:<br />
            <span className="font-mono text-white/20 break-all">{address}</span>
          </p>
        </div>
      )}

      {referralBalance !== undefined && referralBalance !== null && referralBalance > 0n && (
        <div className="mt-2.5 p-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Award size={14} className="text-emerald-400 flex-shrink-0" />
            <span className="text-[11px] text-emerald-300 font-bold truncate">
              Referral Reward: <strong className="font-mono text-white">{parseFloat(formatEther(referralBalance)).toFixed(4)} BNB</strong>
            </span>
          </div>
          {onClaimReferral && (
            <button
              disabled={claimLoading}
              onClick={onClaimReferral}
              className="px-2.5 py-1 rounded-lg bg-emerald-500 text-black font-black text-[10px] hover:bg-emerald-400 active:scale-95 transition-all flex items-center gap-1 flex-shrink-0"
            >
              {claimLoading ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
              Claim BNB
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Gacha & Soul Forge Modal ─────────────────────────────────────────────
export function GachaModal({ onClose }: Props) {
  const { profile } = useGame();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<ModalTab>('forge');

  // Soul Forge state
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [useLuckyBone, setUseLuckyBone] = useState<boolean>(true);
  const [useCollar, setUseCollar] = useState<boolean>(false);
  const [useDivineInsurance, setUseDivineInsurance] = useState<boolean>(false);
  const [fusionPhase, setFusionPhase] = useState<FusionPhase>('idle');
  const [fusionTxHash, setFusionTxHash] = useState<string | null>(null);
  const [fusionError, setFusionError] = useState<string | null>(null);
  const [fusionResult, setFusionResult] = useState<{
    requestId: number;
    baseTierId: number;
    upgradedTier: number;
    isSuccess: boolean;
    shardsRewarded: number;
    roll: number;
    targetRate: number;
    useLuckyBone?: boolean;
    useCollar?: boolean;
    useDivineInsurance?: boolean;
    txHash: string;
  } | null>(null);

  // Gacha pull state (Standard / Golden / Mega Bulk x10)
  const [pullMode, setPullMode] = useState<'standard' | 'golden' | 'bulk10'>('standard');
  const [gachaPhase, setGachaPhase] = useState<GachaPhase>('idle');
  const [pityCount, setPityCount] = useState<number>(0);
  const [gachaRevealedTier, setGachaRevealedTier] = useState<DogTierInfo | null>(null);
  const [gachaRevealedBulk, setGachaRevealedBulk] = useState<DogTierInfo[] | null>(null);
  const [jackpotWon, setJackpotWon] = useState<{ tier: number; amount: bigint } | null>(null);
  const [bulkShardsEarned, setBulkShardsEarned] = useState<number>(0);
  const [gachaCommitTx, setGachaCommitTx] = useState<`0x${string}` | null>(null);
  const [gachaRevealTx, setGachaRevealTx] = useState<`0x${string}` | null>(null);
  const [gachaError, setGachaError] = useState<string | null>(null);
  const [blocksLeft, setBlocksLeft] = useState<number>(0);

  // Referral BNB & Treasury
  const [referralBnbBalance, setReferralBnbBalance] = useState<bigint | null>(null);
  const [claimReferralLoading, setClaimReferralLoading] = useState<boolean>(false);
  const [copiedRefLink, setCopiedRefLink] = useState<boolean>(false);

  // Pity Shards redemption state
  const [pityPhase, setPityPhase] = useState<PityPhase>('idle');
  const [pityTxHash, setPityTxHash] = useState<string | null>(null);
  const [pityError, setPityError] = useState<string | null>(null);
  const [pityResultTier, setPityResultTier] = useState<DogTierInfo | null>(null);

  // Balances
  const [bnbBalance, setBnbBalance] = useState<bigint | null>(null);
  const [farmBalance, setFarmBalance] = useState<bigint | null>(null);
  const [soulShardBalance, setSoulShardBalance] = useState<bigint | null>(null);
  const [dogBalances, setDogBalances] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);
  const [balLoading, setBalLoading] = useState<boolean>(false);

  const { address: walletAddr, account: signerAccount, canSign, walletLocked, hasWallet } = useActiveWallet(profile);

  const currentRecipe = FUSION_RECIPES.find((r) => r.baseTier === selectedTier) || FUSION_RECIPES[0];

  // Live Treasury Buyback status query
  const { data: treasuryStatus } = useQuery<TreasuryStatus>({
    queryKey: ['treasury-status'],
    queryFn: api.getTreasuryStatus,
    refetchInterval: 12_000,
  });

  const getReferrerAddress = useCallback((): `0x${string}` => {
    try {
      const saved = localStorage.getItem('bb_referrer_wallet');
      if (saved && /^0x[a-fA-F0-9]{40}$/.test(saved) && saved.toLowerCase() !== walletAddr?.toLowerCase()) {
        return saved as `0x${string}`;
      }
    } catch {}
    return '0x0000000000000000000000000000000000000000';
  }, [walletAddr]);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!walletAddr) return;
    setBalLoading(true);
    try {
      const publicClient = createPublicClient({ chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });

      const accounts = [
        walletAddr, walletAddr, walletAddr,
        walletAddr, walletAddr, walletAddr, walletAddr,
      ];
      const ids = [1n, 2n, 3n, 4n, 5n, 6n, SOUL_SHARD_ID];

      const [bnb, farm, gasPrice, batchBals, pity, refBnb] = await Promise.all([
        publicClient.getBalance({ address: walletAddr }),
        publicClient.readContract({ address: FARM_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [walletAddr] }) as Promise<bigint>,
        publicClient.getGasPrice(),
        publicClient.readContract({ address: NFT_ADDRESS, abi: NFT_ABI, functionName: 'balanceOfBatch', args: [accounts, ids] }) as Promise<bigint[]>,
        publicClient.readContract({ address: GACHA_ADDRESS, abi: GACHA_ABI, functionName: 'pityCounter', args: [walletAddr] }).catch(() => 0n) as Promise<bigint>,
        publicClient.readContract({ address: GACHA_ADDRESS, abi: GACHA_ABI, functionName: 'referralBalances', args: [walletAddr] }).catch(() => 0n) as Promise<bigint>,
      ]);

      setBnbBalance(bnb);
      setFarmBalance(farm);
      setGasEstimate(gasPrice * GAS_LIMIT_ESTIMATE);
      if (typeof pity === 'bigint') setPityCount(Number(pity));
      if (typeof refBnb === 'bigint') setReferralBnbBalance(refBnb);

      const dMap: Record<number, number> = {};
      for (let i = 0; i < 6; i++) {
        dMap[i + 1] = Number(batchBals?.[i] ?? 0n);
      }
      setDogBalances(dMap);
      setSoulShardBalance(batchBals?.[6] ?? 0n);
    } catch (err) {
      console.warn('[GachaModal] fetchBalances failed:', err);
    } finally {
      setBalLoading(false);
    }
  }, [walletAddr]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const handleClaimReferral = async () => {
    if (!canSign || !signerAccount || !walletAddr) return;
    setClaimReferralLoading(true);
    try {
      const walletClient = createWalletClient({ account: signerAccount, chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });
      const publicClient = createPublicClient({ chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });
      const tx = await walletClient.writeContract({
        address: GACHA_ADDRESS,
        abi: GACHA_ABI,
        functionName: 'claimReferralBnb',
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      fetchBalances();
    } catch (err) {
      console.warn('[GachaModal] claimReferral failed:', err);
    } finally {
      setClaimReferralLoading(false);
    }
  };

  // Query NFT status and active marketplace listings for accurate dog availability
  const { data: nftStatus, refetch: refetchNftStatus } = useQuery<NftStatus>({
    queryKey: ['nftStatus'],
    queryFn: api.getNftStatus,
    staleTime: 10_000,
  });

  const { data: myListings = [], refetch: refetchMyListings } = useQuery<MarketplaceListing[]>({
    queryKey: ['my-marketplace-listings'],
    queryFn: api.getMyMarketplaceListings,
    staleTime: 10_000,
  });

  // Calculate detailed per-tier availability (on-chain, listed on marketplace, guarding farm)
  const tierStats = useMemo(() => {
    const stats: Record<number, {
      totalOnChain: number;
      totalOwned: number;
      guardingCount: number;
      listedCount: number;
      availableToFuse: number;
      canFuse: boolean;
    }> = {};

    const activeNftListings = (myListings || []).filter(
      (l) => l.status === 'active' && (!l.assetType || l.assetType === 'nft'),
    );
    const ownedDogs = nftStatus?.ownedBreeds || [];

    for (let t = 1; t <= 4; t++) {
      const onChain = dogBalances[t] || 0;
      const dbDogs = ownedDogs.filter((d) => d.tokenId === t);
      const guarding = dbDogs.filter((d) => d.isGuarding).length;
      const dbListed = dbDogs.filter((d) => d.isListed || !!d.listingId).length;
      const marketListed = activeNftListings.filter((l) => l.tokenId === t).length;
      const listed = Math.max(dbListed, marketListed);
      const total = Math.max(onChain, dbDogs.length);
      // Truly available to fuse: must be in wallet on-chain AND not guarding AND not listed on marketplace
      const available = Math.max(0, Math.min(onChain, total - guarding - listed));

      stats[t] = {
        totalOnChain: onChain,
        totalOwned: total,
        guardingCount: guarding,
        listedCount: listed,
        availableToFuse: available,
        canFuse: available >= 3,
      };
    }
    return stats;
  }, [dogBalances, nftStatus, myListings]);

  const currentStat = tierStats[selectedTier] || {
    totalOnChain: 0,
    totalOwned: 0,
    guardingCount: 0,
    listedCount: 0,
    availableToFuse: 0,
    canFuse: false,
  };

  // Total cost calculation for Soul Forge
  const baseCost = currentRecipe?.costFarm ?? 20;
  const luckyBoneCost = useLuckyBone ? LUCKY_BONE_COST : 0;
  const collarCost = useCollar ? PROTECTION_COLLAR_COST : 0;
  const totalFarmCost = baseCost + luckyBoneCost + collarCost;
  const finalSuccessRate = Math.min(100, (currentRecipe?.baseRate ?? 75) + (useLuckyBone ? 15 : 0));
  const insuranceFeeBnb = useDivineInsurance ? (FORGE_INSURANCE_FEES[selectedTier] ?? 0n) : 0n;

  const hasEnoughDogs = currentStat.canFuse;
  const availableSelectedDogs = currentStat.availableToFuse;
  let farmFloat: number | null = null;
  if (farmBalance !== null) {
    try {
      farmFloat = parseFloat(formatEther(farmBalance));
    } catch {
      farmFloat = 0;
    }
  }
  const hasEnoughFarm = farmFloat !== null && farmFloat >= totalFarmCost;
  const soulShardCount = soulShardBalance !== null ? Number(soulShardBalance) : 0;

  // ── Soul Forge (Dog Fusion) Action ──────────────────────────────────────────
  const handleForgeFusion = async () => {
    if (!canSign || !signerAccount) return;

    // 0. Pre-flight check: strictly verify that user has at least 3 available dogs
    if (!currentStat.canFuse || currentStat.availableToFuse < 3) {
      if (currentStat.listedCount > 0) {
        setFusionError(
          `Cannot fuse: ${currentStat.listedCount} of your ${currentRecipe.baseDog.name}s are currently listed on the Marketplace. Please cancel your listing in Marketplace → My Listings before fusing.`,
        );
      } else if (currentStat.guardingCount > 0) {
        setFusionError(
          `Cannot fuse: ${currentStat.guardingCount} of your ${currentRecipe.baseDog.name}s are currently guarding your farm. Please recall them to Storage before fusing.`,
        );
      } else {
        setFusionError(
          `Cannot fuse: You need at least 3 available ${currentRecipe.baseDog.name}s in storage, but only have ${currentStat.availableToFuse}.`,
        );
      }
      setFusionPhase('error');
      return;
    }

    // Check BNB fee if Divine Insurance is active
    if (useDivineInsurance && insuranceFeeBnb > 0n && bnbBalance !== null) {
      const minBnb = insuranceFeeBnb + (gasEstimate ?? 1_000_000_000_000_000n);
      if (bnbBalance < minBnb) {
        setFusionError(`Insufficient BNB balance for Divine Insurance fee (${formatEther(insuranceFeeBnb)} BNB). Please deposit BNB.`);
        setFusionPhase('error');
        return;
      }
    }

    setFusionError(null);
    setFusionResult(null);
    setFusionTxHash(null);

    // Server-side pre-flight verification to prevent any inconsistency
    try {
      const check = await api.checkFusionEligibility(selectedTier);
      if (!check.eligible || check.available < 3) {
        setFusionError(`Eligibility check failed: Only ${check.available} available dogs to fuse.`);
        setFusionPhase('error');
        return;
      }
    } catch (err: any) {
      setFusionError(err?.message || 'Failed fusion eligibility check');
      setFusionPhase('error');
      return;
    }

    const account = signerAccount!;
    const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });
    const publicClient = createPublicClient({ chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });

    try {
      const totalCostWei = BigInt(totalFarmCost) * 10n ** 18n;

      // 1. Approve $FARM if allowance is insufficient
      const farmAllowance = await publicClient.readContract({
        address: FARM_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account.address, GACHA_ADDRESS],
      }) as bigint;

      if (farmAllowance < totalCostWei) {
        setFusionPhase('approving_farm');
        const appTx = await walletClient.writeContract({
          address: FARM_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [GACHA_ADDRESS, totalCostWei * 10n],
        });
        await publicClient.waitForTransactionReceipt({ hash: appTx });
      }

      // 2. Approve GuardDogNFT operator if not already approved
      const isNftApproved = await publicClient.readContract({
        address: NFT_ADDRESS,
        abi: NFT_ABI,
        functionName: 'isApprovedForAll',
        args: [account.address, GACHA_ADDRESS],
      }) as boolean;

      if (!isNftApproved) {
        setFusionPhase('approving_nft');
        const nftAppTx = await walletClient.writeContract({
          address: NFT_ADDRESS,
          abi: NFT_ABI,
          functionName: 'setApprovalForAll',
          args: [GACHA_ADDRESS, true],
        });
        await publicClient.waitForTransactionReceipt({ hash: nftAppTx });
      }

      // 3. Request Fusion on Smart Contract with Divine Insurance and Referrer
      setFusionPhase('requesting');
      const reqTx = await walletClient.writeContract({
        address: GACHA_ADDRESS,
        abi: GACHA_ABI,
        functionName: 'requestFusion',
        args: [BigInt(selectedTier), useLuckyBone, useCollar, useDivineInsurance, getReferrerAddress()],
        value: insuranceFeeBnb,
      });
      setFusionTxHash(reqTx);
      const reqReceipt = await publicClient.waitForTransactionReceipt({ hash: reqTx });

      // 4. Extract requestId from FusionRequested event log
      let requestId = 0;
      for (const log of reqReceipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: GACHA_ABI, data: log.data, topics: log.topics }) as any;
          if (decoded.eventName === 'FusionRequested') {
            requestId = Number(decoded.args.requestId);
            break;
          }
        } catch {
          // continue
        }
      }

      if (!requestId) {
        throw new Error('Failed to retrieve Fusion Request ID from transaction logs');
      }

      // 5. Backend Oracle resolution (Commit-Reveal RNG)
      setFusionPhase('forging');
      let resolveRes: any = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          resolveRes = await api.resolveFusion(requestId);
          if (resolveRes) break;
        } catch (resolveErr) {
          if (attempt === 3) throw resolveErr;
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      setFusionResult({
        ...resolveRes,
        useDivineInsurance,
      });
      setFusionPhase('result');

      // Refresh state
      await api.syncNft().catch(() => {});
      qc.invalidateQueries({ queryKey: ['nftStatus'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['barnData'] });
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      qc.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      qc.invalidateQueries({ queryKey: ['marketplace-listings'] });
      qc.invalidateQueries({ queryKey: ['treasury-status'] });
      fetchBalances();

    } catch (err) {
      setFusionError(friendlyError(err));
      setFusionPhase('error');
      fetchBalances();
    }
  };

  // ── Gacha Pull Action (Standard / Golden / Mega Bulk x10) ──────────────────
  const handleGachaPull = async (mode: 'standard' | 'golden' | 'bulk10') => {
    if (!canSign || !signerAccount) return;

    setGachaError(null);
    setGachaRevealedTier(null);
    setGachaRevealedBulk(null);
    setJackpotWon(null);
    setBulkShardsEarned(0);
    setGachaCommitTx(null);
    setGachaRevealTx(null);

    const isGolden = mode === 'golden';
    const isBulk10 = mode === 'bulk10';
    const farmNeeded = isBulk10 ? BigInt(BULK10_FARM_COST) * 10n ** 18n : 50n * 10n ** 18n;
    const bnbFee = isBulk10 ? BULK10_BNB_FEE : (isGolden ? GOLDEN_PULL_BNB_FEE : 0n);

    // Pre-flight balance check
    if (farmBalance !== null && farmBalance < farmNeeded) {
      setGachaError(`Insufficient $FARM balance. Requires ${isBulk10 ? 450 : 50} $FARM.`);
      setGachaPhase('error');
      return;
    }
    if (bnbFee > 0n && bnbBalance !== null) {
      const minBnbNeeded = bnbFee + (gasEstimate ?? 1_000_000_000_000_000n);
      if (bnbBalance < minBnbNeeded) {
        setGachaError(`Insufficient BNB balance for fee (${formatEther(bnbFee)} BNB). Please deposit BNB.`);
        setGachaPhase('error');
        return;
      }
    }

    const account = signerAccount!;
    const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });
    const publicClient = createPublicClient({ chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });

    try {
      // 1. Check & approve FARM
      const allowance = await publicClient.readContract({
        address: FARM_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account.address, GACHA_ADDRESS],
      }) as bigint;

      if (allowance < farmNeeded) {
        setGachaPhase('approving');
        const appTx = await walletClient.writeContract({
          address: FARM_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [GACHA_ADDRESS, farmNeeded * 10n],
        });
        await publicClient.waitForTransactionReceipt({ hash: appTx });
      }

      // 2. Secret & Commitment
      const secretBytes = crypto.getRandomValues(new Uint8Array(32));
      const secret = `0x${Array.from(secretBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
      const commitment = keccak256(encodePacked(['bytes32', 'address'], [secret, account.address]));

      setGachaPhase('committing');
      let commitTx: `0x${string}`;
      const referrer = getReferrerAddress();

      if (isBulk10) {
        commitTx = await walletClient.writeContract({
          address: GACHA_ADDRESS,
          abi: GACHA_ABI,
          functionName: 'commitBulk10',
          args: [commitment, referrer],
          value: bnbFee,
        });
      } else if (isGolden) {
        commitTx = await walletClient.writeContract({
          address: GACHA_ADDRESS,
          abi: GACHA_ABI,
          functionName: 'commitGolden',
          args: [commitment, referrer],
          value: bnbFee,
        });
      } else {
        commitTx = await walletClient.writeContract({
          address: GACHA_ADDRESS,
          abi: GACHA_ABI,
          functionName: 'commit',
          args: [commitment],
        });
      }

      setGachaCommitTx(commitTx);
      const commitReceipt = await publicClient.waitForTransactionReceipt({ hash: commitTx });
      const commitBlock = commitReceipt.blockNumber;

      const minBlocks = await publicClient.readContract({
        address: GACHA_ADDRESS,
        abi: GACHA_ABI,
        functionName: 'MIN_REVEAL_BLOCKS',
      }) as bigint;

      setGachaPhase('waiting_blocks');
      let currentBlock = await publicClient.getBlockNumber();
      let diff = Number(commitBlock + minBlocks - currentBlock);
      while (diff > 0) {
        setBlocksLeft(diff);
        await new Promise((r) => setTimeout(r, 2500));
        currentBlock = await publicClient.getBlockNumber();
        diff = Number(commitBlock + minBlocks - currentBlock);
      }
      setBlocksLeft(0);

      // 3. Reveal
      setGachaPhase('revealing');
      const revealTx = await walletClient.writeContract({
        address: GACHA_ADDRESS,
        abi: GACHA_ABI,
        functionName: 'reveal',
        args: [secret],
      });
      setGachaRevealTx(revealTx);
      const revealReceipt = await publicClient.waitForTransactionReceipt({ hash: revealTx });

      let singleTokenId: number | null = null;
      let bulkTokenIds: number[] | null = null;
      let bonusShardsCount = 0;

      for (const log of revealReceipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: GACHA_ABI, data: log.data, topics: log.topics }) as any;
          if (decoded.eventName === 'Revealed') {
            singleTokenId = Number(decoded.args.tokenId);
            setPityCount(singleTokenId >= 3 ? 0 : Number(decoded.args.pity));
          } else if (decoded.eventName === 'BulkRevealed') {
            const ids = (decoded.args.tokenIds as bigint[]).map((id) => Number(id));
            bulkTokenIds = ids;
            setPityCount(Number(decoded.args.pity));
          } else if (decoded.eventName === 'SoulShardMinted') {
            bonusShardsCount += Number(decoded.args.amount || 0n);
          } else if (decoded.eventName === 'JackpotTriggered') {
            setJackpotWon({
              tier: Number(decoded.args.tokenId),
              amount: BigInt(decoded.args.jackpotAmount || 0n),
            });
          }
        } catch { /* skip non-matching logs */ }
      }

      if (bulkTokenIds && bulkTokenIds.length > 0) {
        const dogInfos = bulkTokenIds.map((id) => DOG_TIERS.find((d) => d.tokenId === id) ?? DOG_TIERS[0]);
        setGachaRevealedBulk(dogInfos);
        setBulkShardsEarned(bonusShardsCount);
      } else if (singleTokenId !== null) {
        setGachaRevealedTier(DOG_TIERS.find((d) => d.tokenId === singleTokenId) ?? DOG_TIERS[0]);
        setBulkShardsEarned(bonusShardsCount);
      } else {
        setGachaRevealedTier(DOG_TIERS[0]);
      }

      setGachaPhase('result');

      await api.syncNft().catch(() => {});
      qc.invalidateQueries({ queryKey: ['nftStatus'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      qc.invalidateQueries({ queryKey: ['treasury-status'] });
      fetchBalances();

    } catch (err) {
      setGachaError(friendlyError(err));
      setGachaPhase('error');
      fetchBalances();
    }
  };

  const handleSinglePull = () => handleGachaPull(pullMode === 'bulk10' ? 'golden' : pullMode);

  // ── Soul Shard Pity Redeem Action ───────────────────────────────────────────
  const handleRedeemPity = async () => {
    if (!canSign || !signerAccount) return;

    setPityError(null);
    setPityResultTier(null);
    setPityTxHash(null);

    const account = signerAccount!;
    const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });
    const publicClient = createPublicClient({ chain: bscTestnet, transport: http(BSC_TESTNET_RPC) });

    try {
      setPityPhase('redeeming');
      const tx = await walletClient.writeContract({
        address: GACHA_ADDRESS,
        abi: GACHA_ABI,
        functionName: 'redeemShards',
        args: [],
      });
      setPityTxHash(tx);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

      let mintedTier = 3;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: GACHA_ABI, data: log.data, topics: log.topics }) as any;
          if (decoded.eventName === 'ShardsRedeemed') {
            const tiers = decoded.args.tiers as bigint[];
            if (tiers && tiers.length > 0) mintedTier = Number(tiers[0]);
            break;
          }
        } catch { /* skip */ }
      }

      setPityResultTier(DOG_TIERS.find((d) => d.tokenId === mintedTier) ?? DOG_TIERS[2]);
      setPityPhase('result');

      await api.syncNft().catch(() => {});
      qc.invalidateQueries({ queryKey: ['nftStatus'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      fetchBalances();

    } catch (err) {
      setPityError(friendlyError(err));
      setPityPhase('error');
      fetchBalances();
    }
  };

  const isFusionPending = !['idle', 'result', 'error'].includes(fusionPhase);
  const isGachaPending  = !['idle', 'result', 'error'].includes(gachaPhase);
  const isPityPending   = !['idle', 'result', 'error'].includes(pityPhase);
  const isAnyPending    = isFusionPending || isGachaPending || isPityPending;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end px-3 py-2"
      style={{ paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 24px)) + 90px)' }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div
        className="relative w-full max-w-2xl glass mx-auto rounded-3xl overflow-hidden slide-up flex flex-col"
        style={{ maxHeight: 'calc(var(--tg-viewport-stable-height, 100vh) - 100px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-2.5 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2.5 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-violet-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Flame size={18} className="text-amber-200" />
            </div>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Soul Forge &amp; Gacha Portal</h2>
              <p className="text-white/40 text-[11px]">Guard Dog Fusion, Pity Exchange &amp; Breeding</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Protocol Treasury Vault Buyback Progress Banner */}
        <div className="mx-4 mb-2 p-2.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-black/60 border border-amber-500/30 flex-shrink-0">
          <div className="flex items-center justify-between text-xs mb-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Flame size={14} className="text-amber-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-wide">
                Auto Buyback &amp; Burn Vault
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <strong className="text-amber-400">
                {treasuryStatus ? parseFloat(treasuryStatus.bnbBalance).toFixed(4) : '0.0148'}
              </strong>
              <span className="text-white/40">/ 2.0000 BNB</span>
              <span className="bg-amber-400/20 text-amber-300 text-[9px] font-black px-1.5 py-0.2 rounded-full ml-0.5">
                {treasuryStatus ? Math.min(100, treasuryStatus.progressPercent).toFixed(1) : '0.7'}%
              </span>
            </div>
          </div>
          <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden mb-1 border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-red-500 rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(2, Math.min(100, treasuryStatus ? treasuryStatus.progressPercent : 0.74))}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[9.5px] text-white/50">
            <span>🔒 75% Gacha BNB fees support $FARM price</span>
            <span className="text-amber-300/80 font-semibold">Automatic Buyback &amp; Burn triggers at 2 BNB</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 px-4 mb-2 flex-shrink-0">
          <button
            disabled={isAnyPending}
            onClick={() => setActiveTab('forge')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'forge'
                ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg shadow-amber-500/25 border border-amber-400/40 font-black'
                : 'glass text-white/50 hover:text-white'
            }`}
          >
            <span>🔥</span> Soul Forge
          </button>

          <button
            disabled={isAnyPending}
            onClick={() => setActiveTab('pity')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 relative ${
              activeTab === 'pity'
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 border border-violet-400/40 font-black'
                : 'glass text-white/50 hover:text-white'
            }`}
          >
            <span>💎</span> Pity Chamber
            {soulShardCount > 0 && (
              <span className="bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full ml-1">
                {soulShardCount}
              </span>
            )}
          </button>

          <button
            disabled={isAnyPending}
            onClick={() => setActiveTab('gacha')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'gacha'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/40 font-black'
                : 'glass text-white/50 hover:text-white'
            }`}
          >
            <span>🎲</span> Lucky Gacha
          </button>
        </div>

        {/* Main Content Area */}
        <div className="overflow-y-auto flex-1 px-4 pb-6">
          {/* Wallet Balance Card */}
          {walletAddr && !isAnyPending && (
            <WalletCard
              address={walletAddr}
              bnbBalance={bnbBalance}
              farmBalance={farmBalance}
              soulShardBalance={soulShardBalance}
              gasEstimate={gasEstimate}
              referralBalance={referralBnbBalance}
              onClaimReferral={handleClaimReferral}
              claimLoading={claimReferralLoading}
              loading={balLoading}
            />
          )}

          {!walletAddr && !isAnyPending && (
            <div className="glass rounded-2xl p-4 mb-3 border border-amber-400/30 text-center">
              <p className="text-amber-300 font-bold text-xs">No Linked Web3 Wallet</p>
              <p className="text-white/50 text-[11px] mt-1">Please connect or generate your Web3 wallet to interact with Soul Forge.</p>
            </div>
          )}

          {walletAddr && walletLocked && !isAnyPending && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-400/25 p-3 mb-3 flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-left">
                <p className="text-amber-300 text-xs font-bold">Wallet Not Signable on This Device</p>
                <p className="text-white/60 text-[10px] mt-0.5 leading-relaxed">
                  Your account is linked to <span className="font-mono text-white/80">{shortAddr(walletAddr)}</span>, but this device cannot sign for it — the private key is missing or a different key is loaded. Import the correct key in Settings → BSC Wallet.
                </p>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 1: SOUL FORGE (DOG FUSION & BREEDING)                         */}
          {/* ================================================================= */}
          {activeTab === 'forge' && (
            <>
              {/* Fusion In-progress Multi-step Loader */}
              {isFusionPending && (
                <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-950/50 to-black/60 p-5 mb-4 flex flex-col items-center gap-4 text-center">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center animate-ping absolute inset-0" />
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/40 relative z-10">
                      <Flame size={32} className="text-white animate-bounce" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-white font-black text-sm">
                      {fusionPhase === 'approving_farm' && 'Step 1/3: Approving $FARM Spending…'}
                      {fusionPhase === 'approving_nft' && 'Step 2/3: Authorizing Dog NFT Transfer…'}
                      {fusionPhase === 'requesting' && 'Submitting Dog Fusion to BSC Smart Contract…'}
                      {fusionPhase === 'forging' && 'Soul Forge Active: Waiting for Oracle RNG Resolution…'}
                    </h3>
                    <p className="text-white/50 text-xs mt-1">
                      {fusionPhase === 'forging'
                        ? 'Combining souls & verifying probabilities on-chain. Please do not close!'
                        : 'Please confirm the blockchain transaction in your wallet.'}
                    </p>
                  </div>

                  {fusionTxHash && <TxLink hash={fusionTxHash} />}
                </div>
              )}

              {/* Error State */}
              {fusionPhase === 'error' && fusionError && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 mb-3 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-300 text-xs font-bold leading-relaxed">{fusionError}</p>
                    <button
                      onClick={() => setFusionPhase('idle')}
                      className="mt-2 glass rounded-xl px-3 py-1.5 text-xs text-white font-bold active:scale-95"
                    >
                      Dismiss &amp; Try Again
                    </button>
                  </div>
                </div>
              )}

              {/* Fusion Result Display */}
              {fusionPhase === 'result' && fusionResult && (
                <div className="flex flex-col gap-3 mb-4">
                  {fusionResult.isSuccess ? (
                    // SUCCESS CELEBRATION
                    <div className="rounded-3xl border border-amber-400/50 bg-gradient-to-b from-amber-500/20 via-purple-500/15 to-black/60 p-6 flex flex-col items-center gap-3 shadow-xl shadow-amber-500/20 text-center">
                      <span className="text-7xl animate-bounce">{currentRecipe.targetDog.emoji}</span>
                      <div>
                        <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-black uppercase mb-1 bg-amber-400 text-black">
                          🔥 FUSION SUCCESSFUL!
                        </div>
                        <h3 className={`text-2xl font-black ${currentRecipe.targetDog.color}`}>
                          {currentRecipe.targetDog.name}
                        </h3>
                        <p className="text-white/80 text-xs mt-1">
                          Tier {currentRecipe.targetDog.tokenId} · Guard Defense: <strong className="text-emerald-300">−{currentRecipe.targetDog.defense}% steal chance</strong>
                        </p>
                      </div>

                      <div className="bg-white/5 rounded-xl px-4 py-2 text-white/70 text-xs border border-white/10 mt-1">
                        RNG Roll: <strong className="text-amber-300">{fusionResult.roll}</strong> / Target: &le;{fusionResult.targetRate}%
                      </div>

                      {fusionResult.txHash && <TxLink hash={fusionResult.txHash} />}

                      <button
                        onClick={() => { setFusionPhase('idle'); setFusionResult(null); }}
                        className="mt-2 w-full py-3.5 rounded-2xl font-black text-sm text-white shadow-lg active:scale-95 transition-all"
                        style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
                      >
                        Forge Again
                      </button>
                    </div>
                  ) : (
                    // FAILED WITH CONSOLATION / PITY
                    <div className="rounded-3xl border border-red-400/40 bg-gradient-to-b from-red-500/15 via-black/40 to-black/60 p-6 flex flex-col items-center gap-3 text-center">
                      <div className="text-5xl">💥</div>
                      <div>
                        <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-black uppercase mb-1 bg-red-500/30 text-red-300 border border-red-500/30">
                          FUSION CRACKED
                        </div>
                        <h3 className="text-xl font-black text-white">The Forge Overheated!</h3>
                        <p className="text-white/60 text-xs mt-1 max-w-sm">
                          {fusionResult.useDivineInsurance ? (
                            <span className="text-amber-300 font-bold">
                              ✨ Divine Aegis Active: All 3 dogs preserved in kennel &amp; 50% FARM refunded!
                            </span>
                          ) : fusionResult.useCollar ? (
                            <span className="text-emerald-300 font-bold">
                              🛡️ Protection Collar preserved all 3 dogs! Zero dogs were lost.
                            </span>
                          ) : (
                            <span>
                              1 Dog was safely salvaged. 2 dogs were consumed by the forge.
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Consolation Shards Award */}
                      {fusionResult.shardsRewarded > 0 && (
                        <div className="w-full bg-violet-950/40 border border-violet-400/30 rounded-2xl p-3 flex items-center gap-3 text-left">
                          <span className="text-3xl">💎</span>
                          <div className="flex-1">
                            <p className="text-violet-300 text-xs font-black uppercase">
                              {fusionResult.useDivineInsurance ? '✨ Divine Insurance Compensation' : 'Consolation Pity Shards'}
                            </p>
                            <p className="text-white font-bold text-sm">+{fusionResult.shardsRewarded} Soul Shards Awarded</p>
                            <p className="text-white/50 text-[10px]">
                              {fusionResult.useDivineInsurance ? 'Max insurance compensation applied (30 shards)!' : 'Collect 100 Shards for 100% guaranteed Tier 3-5 Dog!'}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="bg-white/5 rounded-xl px-4 py-2 text-white/70 text-xs border border-white/10">
                        RNG Roll: <strong className="text-red-300">{fusionResult.roll}</strong> / Needed: &le;{fusionResult.targetRate}%
                      </div>

                      {fusionResult.txHash && <TxLink hash={fusionResult.txHash} />}

                      <div className="flex gap-2 w-full mt-1">
                        <button
                          onClick={() => { setFusionPhase('idle'); setFusionResult(null); }}
                          className="flex-1 py-3 rounded-xl glass text-white font-bold text-xs active:scale-95"
                        >
                          Try Again
                        </button>
                        <button
                          onClick={() => { setFusionPhase('idle'); setFusionResult(null); setActiveTab('pity'); }}
                          className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-bold text-xs active:scale-95 flex items-center justify-center gap-1"
                        >
                          💎 Open Pity Chamber
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Main Idle Forge Interface */}
              {!isFusionPending && fusionPhase !== 'result' && (
                <>
                  {/* Tier Selector Pills */}
                  <div className="glass rounded-2xl p-2.5 mb-3">
                    <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2 px-1">
                      1. Select Base Dog Tier (3 Required)
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {FUSION_RECIPES.map((recipe) => {
                        const isSelected = recipe.baseTier === selectedTier;
                        const stat = tierStats[recipe.baseTier] || {
                          totalOnChain: 0,
                          totalOwned: 0,
                          guardingCount: 0,
                          listedCount: 0,
                          availableToFuse: 0,
                          canFuse: false,
                        };

                        return (
                          <button
                            key={recipe.baseTier}
                            onClick={() => setSelectedTier(recipe.baseTier)}
                            className={`rounded-xl p-2 text-center transition-all relative flex flex-col items-center ${
                              isSelected
                                ? 'bg-gradient-to-b from-amber-500/30 to-orange-500/20 border-2 border-amber-400 shadow-md shadow-amber-500/20'
                                : 'bg-white/5 hover:bg-white/10 border border-white/10'
                            }`}
                          >
                            <span className="text-xl">{recipe.baseDog.emoji}</span>
                            <span className="text-[11px] font-black text-white mt-0.5">T{recipe.baseTier}</span>
                            <span className={`text-[9px] font-bold mt-0.5 ${stat.canFuse ? 'text-emerald-400' : stat.availableToFuse > 0 ? 'text-amber-400' : 'text-white/40'}`}>
                              {stat.availableToFuse} / 3
                            </span>
                            {stat.listedCount > 0 ? (
                              <span className="text-[7.5px] font-extrabold text-amber-300/90 -mt-0.5 whitespace-nowrap">
                                {stat.listedCount} listed
                              </span>
                            ) : stat.guardingCount > 0 ? (
                              <span className="text-[7.5px] font-extrabold text-blue-300/80 -mt-0.5 whitespace-nowrap">
                                {stat.guardingCount} guard
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Altar: 3 Base Dogs -> 1 Upgraded Dog */}
                  <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-950/30 via-black/40 to-black/60 p-4 mb-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                      <span className="text-amber-300 font-black flex items-center gap-1">
                        <Flame size={14} /> Soul Forge Chamber
                      </span>
                      <span className="text-white/50 text-[10px]">
                        Fusion Rate: <strong className="text-amber-300">{finalSuccessRate}%</strong>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {/* Left: 3 Base Dogs Slots */}
                      <div className="flex-1 bg-white/5 rounded-2xl p-2.5 border border-white/10 flex flex-col items-center">
                        <p className="text-white/40 text-[9px] font-bold uppercase mb-1.5">Sacrifice (3x)</p>
                        <div className="flex items-center gap-1 mb-1">
                          {[0, 1, 2].map((idx) => {
                            const isFilled = availableSelectedDogs > idx;
                            return (
                              <div
                                key={idx}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border transition-all ${
                                  isFilled
                                    ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                                    : 'bg-white/5 border-dashed border-white/20 text-white/20'
                                }`}
                              >
                                {isFilled ? currentRecipe.baseDog.emoji : '?'}
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-white font-black text-[11px]">{currentRecipe.baseDog.name}</p>
                        <div className="text-[9px] text-white/50 flex flex-col items-center gap-0.5 mt-0.5">
                          <span>Available: <strong className={currentStat.canFuse ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>{currentStat.availableToFuse}</strong> / 3</span>
                          {(currentStat.listedCount > 0 || currentStat.guardingCount > 0) && (
                            <span className="text-[8px] text-white/40 text-center leading-tight">
                              ({currentStat.totalOwned} total{currentStat.listedCount > 0 ? ` · ${currentStat.listedCount} listed` : ''}{currentStat.guardingCount > 0 ? ` · ${currentStat.guardingCount} guarding` : ''})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Center Arrow */}
                      <div className="flex flex-col items-center px-1">
                        <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                          <ArrowRight size={14} />
                        </div>
                        <span className="text-[9px] font-bold text-amber-300 mt-1">Upgrade</span>
                      </div>

                      {/* Right: Target Upgraded Dog */}
                      <div className="flex-1 bg-gradient-to-b from-amber-500/15 to-purple-500/10 rounded-2xl p-2.5 border border-amber-400/30 flex flex-col items-center shadow-lg shadow-amber-500/10">
                        <p className="text-amber-300 text-[9px] font-black uppercase mb-1.5">Reward (1x)</p>
                        <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/60 flex items-center justify-center text-lg mb-1 animate-pulse">
                          {currentRecipe.targetDog.emoji}
                        </div>
                        <p className={`font-black text-[11px] ${currentRecipe.targetDog.color}`}>
                          {currentRecipe.targetDog.name}
                        </p>
                        <p className="text-emerald-300 font-bold text-[9px]">
                          −{currentRecipe.targetDog.defense}% Steal Protection
                        </p>
                      </div>
                    </div>

                    {!hasEnoughDogs && (
                      <div className="flex flex-col gap-1.5">
                        {currentStat.listedCount > 0 && (
                          <div className="bg-amber-500/15 border border-amber-400/40 rounded-xl p-2.5 flex items-start gap-2 text-xs">
                            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-amber-300 font-bold text-[11px]">
                                {currentStat.listedCount} {currentRecipe.baseDog.name}{currentStat.listedCount > 1 ? 's' : ''} Listed on Marketplace
                              </p>
                              <p className="text-amber-200/80 text-[10px] leading-relaxed mt-0.5">
                                Dogs listed for sale cannot be sacrificed in Soul Forge. Cancel your listing in Marketplace → My Listings to make them available.
                              </p>
                            </div>
                          </div>
                        )}
                        {currentStat.guardingCount > 0 && (
                          <div className="bg-blue-500/15 border border-blue-400/40 rounded-xl p-2.5 flex items-start gap-2 text-xs">
                            <Shield size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-blue-300 font-bold text-[11px]">
                                {currentStat.guardingCount} {currentRecipe.baseDog.name}{currentStat.guardingCount > 1 ? 's' : ''} Guarding Farm
                              </p>
                              <p className="text-blue-200/80 text-[10px] leading-relaxed mt-0.5">
                                Dogs currently protecting your farm cannot be fused. Recall them to storage in Storage → Dog Kennel first.
                              </p>
                            </div>
                          </div>
                        )}
                        {currentStat.totalOwned < 3 && (
                          <div className="bg-amber-500/10 border border-amber-400/25 rounded-xl p-2 flex items-center justify-between text-xs">
                            <span className="text-amber-200/80 text-[11px]">
                              Requires 3 {currentRecipe.baseDog.name}s (You have {currentStat.availableToFuse} available)
                            </span>
                            <button
                              onClick={() => setActiveTab('gacha')}
                              className="text-amber-300 font-black text-[10px] underline hover:text-white"
                            >
                              Pull in Gacha &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. GACHA HOOKS: BOOSTERS & PROTECTION */}
                  <div className="glass rounded-2xl p-3 mb-3 flex flex-col gap-2.5 border border-white/10">
                    <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider">
                      2. Fusion Boosters (Optional Hooks)
                    </p>

                    {/* Lucky Bone Toggle */}
                    <div
                      onClick={() => setUseLuckyBone((v) => !v)}
                      className={`rounded-xl p-2.5 border transition-all cursor-pointer flex items-center justify-between ${
                        useLuckyBone
                          ? 'bg-amber-500/15 border-amber-400/50 shadow-md shadow-amber-500/10'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${useLuckyBone ? 'bg-amber-400 text-black' : 'bg-white/10 text-white/50'}`}>
                          🦴
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-bold text-xs">Lucky Bone</span>
                            <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                              +15% Success
                            </span>
                          </div>
                          <p className="text-white/40 text-[10px] mt-0.5">Increases success chance from {currentRecipe.baseRate}% &rarr; {currentRecipe.baseRate + 15}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-amber-300 font-black text-xs font-mono">+50 FARM</span>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${useLuckyBone ? 'bg-amber-400 border-amber-400 text-black' : 'border-white/30'}`}>
                          {useLuckyBone && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    </div>

                    {/* Protection Collar Toggle */}
                    <div
                      onClick={() => setUseCollar((v) => !v)}
                      className={`rounded-xl p-2.5 border transition-all cursor-pointer flex items-center justify-between ${
                        useCollar
                          ? 'bg-blue-500/15 border-blue-400/50 shadow-md shadow-blue-500/10'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${useCollar ? 'bg-blue-400 text-black' : 'bg-white/10 text-white/50'}`}>
                          🛡️
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-bold text-xs">Protection Collar</span>
                            <span className="bg-blue-500/20 text-blue-300 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                              Zero Dog Loss
                            </span>
                          </div>
                          <p className="text-white/40 text-[10px] mt-0.5">Preserves all 3 dogs if fusion fails (Only FARM fee lost)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-amber-300 font-black text-xs font-mono">+150 FARM</span>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${useCollar ? 'bg-blue-400 border-blue-400 text-black' : 'border-white/30'}`}>
                          {useCollar && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    </div>

                    {/* Divine Insurance (Divine Aegis) Toggle */}
                    <div
                      onClick={() => setUseDivineInsurance((v) => !v)}
                      className={`rounded-xl p-2.5 border transition-all cursor-pointer flex items-center justify-between ${
                        useDivineInsurance
                          ? 'bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-blue-500/20 border-amber-400/60 shadow-lg shadow-amber-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${useDivineInsurance ? 'bg-gradient-to-tr from-amber-400 to-purple-400 text-black shadow-md' : 'bg-white/10 text-white/50'}`}>
                          ✨
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-black text-xs">Divine Aegis Insurance</span>
                            <span className="bg-amber-400/20 text-amber-300 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-amber-400/30">
                              Shield + 50% Refund
                            </span>
                          </div>
                          <p className="text-white/60 text-[10px] mt-0.5 leading-snug">
                            On fail: <strong className="text-emerald-300">Keep 3 dogs</strong> + <strong className="text-amber-300">50% FARM refund</strong> + <strong className="text-violet-300">+30 Soul Shards</strong>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-amber-300 font-black text-xs font-mono">
                            +{formatEther(FORGE_INSURANCE_FEES[selectedTier] ?? 2000000000000000n)} BNB
                          </span>
                          <span className="text-[8px] text-white/40 font-bold">75% to Vault</span>
                        </div>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${useDivineInsurance ? 'bg-amber-400 border-amber-400 text-black' : 'border-white/30'}`}>
                          {useDivineInsurance && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. COST & PROBABILITY BREAKDOWN */}
                  <div className="glass rounded-2xl p-3 mb-3 text-xs flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-white/60">
                      <span>Base Fusion Fee:</span>
                      <span className="text-white font-mono">{baseCost} $FARM</span>
                    </div>
                    {useLuckyBone && (
                      <div className="flex justify-between items-center text-amber-300/90">
                        <span>Lucky Bone Boost:</span>
                        <span className="font-mono">+50 $FARM (+15%)</span>
                      </div>
                    )}
                    {useCollar && (
                      <div className="flex justify-between items-center text-blue-300/90">
                        <span>Protection Collar:</span>
                        <span className="font-mono">+150 $FARM (Protected)</span>
                      </div>
                    )}
                    {useDivineInsurance && (
                      <div className="flex justify-between items-center text-amber-300 font-bold">
                        <span>Divine Insurance Fee:</span>
                        <span className="font-mono">+{formatEther(FORGE_INSURANCE_FEES[selectedTier] ?? 2000000000000000n)} BNB (75% to Buyback Vault)</span>
                      </div>
                    )}
                    <div className="border-t border-white/10 pt-1.5 flex justify-between items-center font-bold">
                      <span className="text-white">Total Required:</span>
                      <div className="text-right">
                        <span className="text-amber-300 text-sm font-black font-mono block">
                          {totalFarmCost} $FARM {useDivineInsurance ? `+ ${formatEther(FORGE_INSURANCE_FEES[selectedTier] ?? 2000000000000000n)} BNB` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-white/50 pt-0.5">
                      <span>Failure Consolation:</span>
                      <span className="text-violet-300 font-bold">
                        +{useDivineInsurance ? 30 : currentRecipe.failShards} Soul Shards 💎
                        {useDivineInsurance ? ' (Insurance Boost)' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Forge CTA Button */}
                  <button
                    disabled={!canSign || !hasEnoughDogs || !hasEnoughFarm || isFusionPending}
                    onClick={handleForgeFusion}
                    className="w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{
                      background: canSign && hasEnoughDogs && hasEnoughFarm ? 'linear-gradient(135deg, #d97706, #b45309)' : undefined,
                      color: '#fff',
                      boxShadow: canSign && hasEnoughDogs && hasEnoughFarm ? '0 0 25px rgba(217,119,6,0.45)' : undefined,
                    }}
                  >
                    {!walletAddr ? (
                      'Web3 Wallet Not Connected'
                    ) : walletLocked ? (
                      'Wallet Not Signable on This Device'
                    ) : !hasEnoughDogs ? (
                      currentStat.listedCount > 0 && currentStat.availableToFuse < 3 ? (
                        `Need 3 Available Dogs (${currentStat.listedCount} Listed on Market)`
                      ) : currentStat.guardingCount > 0 && currentStat.availableToFuse < 3 ? (
                        `Need 3 Available Dogs (${currentStat.guardingCount} Guarding Farm)`
                      ) : (
                        `Need 3 ${currentRecipe?.baseDog?.name ?? 'Dogs'} (Own ${currentStat.totalOwned})`
                      )
                    ) : !hasEnoughFarm ? (
                      `Insufficient $FARM (Requires ${totalFarmCost} $FARM)`
                    ) : (
                      <>
                        <Flame size={17} /> Forge into {currentRecipe?.targetDog?.name} ({totalFarmCost} $FARM{useDivineInsurance ? ` + ${formatEther(FORGE_INSURANCE_FEES[selectedTier] ?? 2000000000000000n)} BNB` : ''} · {finalSuccessRate}%)
                      </>
                    )}
                  </button>
                </>
              )}
            </>
          )}

          {/* ================================================================= */}
          {/* TAB 2: PITY CHAMBER (SOUL SHARD REDEMPTION)                       */}
          {/* ================================================================= */}
          {activeTab === 'pity' && (
            <>
              {/* Soul Shards Balance Card */}
              <div className="glass rounded-2xl p-4 mb-3 border border-violet-400/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl">💎</span>
                    <div>
                      <p className="text-white font-black text-sm">Soul Shards Reservoir</p>
                      <p className="text-white/40 text-[10px]">Awarded on failed fusions &amp; low-tier gacha pulls</p>
                    </div>
                  </div>
                  <span className="text-amber-300 font-black text-lg font-mono">
                    {soulShardCount} / 100
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 via-amber-400 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((soulShardCount / 100) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white/40">Progress: {Math.min(100, Math.round((soulShardCount / 100) * 100))}%</span>
                  <span className="text-amber-300 font-bold">
                    {soulShardCount >= 100 ? '✨ Ready to redeem 100 shards!' : `${100 - soulShardCount} more shards needed`}
                  </span>
                </div>
              </div>

              {/* Loader */}
              {isPityPending && (
                <div className="rounded-2xl border border-violet-400/30 bg-violet-950/40 p-4 mb-3 flex items-center justify-center gap-3">
                  <Loader2 size={20} className="text-violet-400 animate-spin" />
                  <p className="text-white font-bold text-xs">Redeeming 100 Soul Shards on BSC Testnet…</p>
                </div>
              )}

              {/* Error */}
              {pityPhase === 'error' && pityError && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3.5 mb-3 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-300 text-xs font-bold leading-relaxed">{pityError}</p>
                    <button onClick={() => setPityPhase('idle')} className="mt-1.5 glass rounded-xl px-2.5 py-1 text-xs text-white">
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Result */}
              {pityPhase === 'result' && pityResultTier && (
                <div className="rounded-3xl border border-violet-400/40 bg-gradient-to-b from-violet-500/20 to-black/60 p-6 flex flex-col items-center gap-3 mb-3 text-center">
                  <div className="text-7xl animate-bounce">{pityResultTier.emoji}</div>
                  <div>
                    <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-black uppercase mb-1 bg-violet-400 text-black">
                      💎 PITY REDEMPTION SUCCESS!
                    </div>
                    <h3 className={`text-2xl font-black ${pityResultTier.color}`}>{pityResultTier.name}</h3>
                    <p className="text-white/70 text-xs mt-1">Tier {pityResultTier.tokenId} · Guard Defense: −{pityResultTier.defense}% Steal</p>
                  </div>

                  {pityTxHash && <TxLink hash={pityTxHash} />}

                  <button
                    onClick={() => { setPityPhase('idle'); setPityResultTier(null); }}
                    className="mt-2 w-full py-3.5 rounded-2xl font-black text-sm text-white shadow-lg active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Guaranteed Tier 3-5 Odds Table */}
              {!isPityPending && pityPhase !== 'result' && (
                <div className="glass rounded-2xl p-3.5 mb-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Guaranteed Tier 3-5 Drop</span>
                    <span className="text-amber-400 text-[10px] font-black uppercase">100% Success</span>
                  </div>

                  <p className="text-white/70 text-xs leading-relaxed">
                    Burn 100 Soul Shards to forge a guaranteed high-tier Guard Dog on-chain:
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl p-2.5 text-center bg-blue-500/15 border border-blue-400/25">
                      <p className="text-2xl">🐺</p>
                      <p className="text-xs font-black text-blue-300 mt-1">Husky (T3)</p>
                      <p className="text-white/40 text-[10px]">−35% steal</p>
                      <span className="bg-blue-400/20 text-blue-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block">60% Rate</span>
                    </div>
                    <div className="rounded-xl p-2.5 text-center bg-violet-500/15 border border-violet-400/25">
                      <p className="text-2xl">🦮</p>
                      <p className="text-xs font-black text-violet-300 mt-1">Rottweiler (T4)</p>
                      <p className="text-white/40 text-[10px]">−50% steal</p>
                      <span className="bg-violet-400/20 text-violet-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block">30% Rate</span>
                    </div>
                    <div className="rounded-xl p-2.5 text-center bg-amber-500/15 border border-amber-400/25">
                      <p className="text-2xl">🐩</p>
                      <p className="text-xs font-black text-amber-300 mt-1">Doberman (T5)</p>
                      <p className="text-white/40 text-[10px]">−65% steal</p>
                      <span className="bg-amber-400/20 text-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block">10% Rate</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action */}
              {pityPhase !== 'result' && (
                <div className="flex flex-col gap-2">
                  <button
                    disabled={!canSign || soulShardCount < 100 || isPityPending}
                    onClick={handleRedeemPity}
                    className="w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{
                      background: canSign && soulShardCount >= 100 ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : undefined,
                      color: '#fff',
                      boxShadow: canSign && soulShardCount >= 100 ? '0 0 20px rgba(124,58,237,0.4)' : undefined,
                    }}
                  >
                    {isPityPending ? (
                      <><Loader2 size={16} className="animate-spin" /> Redeeming on BSC…</>
                    ) : !walletAddr ? (
                      'Web3 Wallet Not Connected'
                    ) : walletLocked ? (
                      'Wallet Not Signable on This Device'
                    ) : soulShardCount >= 100 ? (
                      <><Sparkles size={16} /> Redeem 100 Shards for Tier 3-5 Dog</>
                    ) : (
                      `Need 100 Shards (Current: ${soulShardCount}/100)`
                    )}
                  </button>

                  {soulShardCount < 100 && (
                    <button
                      onClick={() => setActiveTab('forge')}
                      className="w-full py-2.5 rounded-xl glass text-amber-300 font-bold text-xs hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>🔥</span> Go to Soul Forge to upgrade dogs &amp; collect shards
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ================================================================= */}
          {/* TAB 3: LUCKY GACHA (STANDARD / GOLDEN / MEGA BULK x10)            */}
          {/* ================================================================= */}
          {activeTab === 'gacha' && (
            <>
              {/* Pity tracker */}
              <div className="glass rounded-2xl p-3 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star size={14} className="text-amber-400" />
                  <div>
                    <span className="text-white/70 text-xs font-bold block leading-none">Pity Counter</span>
                    <span className="text-white/30 text-[9px]">Guaranteed Rare+ Dog at 10 pulls</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className={`w-3 h-3 rounded-sm transition-colors ${i < pityCount ? 'bg-amber-400' : 'bg-white/10'}`} />
                    ))}
                  </div>
                  <span className="text-amber-300 font-bold text-xs w-7 text-right">{pityCount}/10</span>
                </div>
              </div>

              {/* Gacha Mode Switcher */}
              {!isGachaPending && gachaPhase !== 'result' && (
                <div className="mb-3">
                  <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
                    <button
                      onClick={() => setPullMode('standard')}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                        pullMode === 'standard'
                          ? 'bg-blue-600 text-white shadow-md font-black'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      🎲 Standard
                    </button>
                    <button
                      onClick={() => setPullMode('golden')}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                        pullMode === 'golden'
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md font-black'
                          : 'text-amber-300/60 hover:text-amber-300'
                      }`}
                    >
                      ✨ Golden (2x Rates)
                    </button>
                    <button
                      onClick={() => setPullMode('bulk10')}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                        pullMode === 'bulk10'
                          ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white shadow-md font-black'
                          : 'text-purple-300/60 hover:text-purple-300'
                      }`}
                    >
                      🔥 Bulk x10 (T3+)
                    </button>
                  </div>
                  {/* Vault contribution info per pull mode */}
                  <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[9px]">
                    {pullMode === 'standard' ? (
                      <>
                        <span className="text-white/30">Fee: 50 $FARM burned</span>
                        <span className="text-white/20">·</span>
                        <span className="text-white/25">BNB vault: no contribution</span>
                      </>
                    ) : pullMode === 'golden' ? (
                      <>
                        <span className="text-white/30">Fee: 50 $FARM + 0.002 BNB</span>
                        <span className="text-white/20">·</span>
                        <span className="text-amber-400/60 flex items-center gap-0.5">🔥 +0.0015 BNB → Buyback Vault</span>
                      </>
                    ) : (
                      <>
                        <span className="text-white/30">Fee: 450 $FARM + 0.015 BNB</span>
                        <span className="text-white/20">·</span>
                        <span className="text-amber-400/60 flex items-center gap-0.5">🔥 +0.01125 BNB → Buyback Vault</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Loader */}
              {isGachaPending && (
                <div className="rounded-2xl border border-blue-400/30 bg-blue-950/40 p-4 mb-4 flex flex-col gap-2.5 text-center items-center">
                  <Loader2 size={24} className="text-blue-400 animate-spin" />
                  <p className="text-white font-bold text-xs">
                    {gachaPhase === 'approving' && `Approving ${pullMode === 'bulk10' ? '450' : '50'} $FARM Spending…`}
                    {gachaPhase === 'committing' && `Locking ${pullMode === 'bulk10' ? 'Bulk x10' : pullMode === 'golden' ? 'Golden' : 'Standard'} Commitment on BSC…`}
                    {gachaPhase === 'waiting_blocks' && (blocksLeft > 0 ? `Waiting for block confirmation (${blocksLeft} blocks)…` : 'Waiting for BSC confirmation…')}
                    {gachaPhase === 'revealing' && `Revealing Secret & Minting ${pullMode === 'bulk10' ? '10 Dogs' : 'Dog'} NFT…`}
                  </p>
                  {(gachaCommitTx || gachaRevealTx) && (
                    <TxLink hash={gachaRevealTx || gachaCommitTx || ''} />
                  )}
                </div>
              )}

              {/* Error */}
              {gachaPhase === 'error' && gachaError && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3.5 mb-3 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-300 text-xs font-bold leading-relaxed">{gachaError}</p>
                    <button onClick={() => setGachaPhase('idle')} className="mt-1.5 glass rounded-xl px-2.5 py-1 text-xs text-white">
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Gacha Result: Single Reveal */}
              {gachaPhase === 'result' && gachaRevealedTier && !gachaRevealedBulk && (
                <div className="flex flex-col gap-3 mb-3">
                  <div className={`rounded-3xl border p-6 flex flex-col items-center gap-3 ${gachaRevealedTier.bg} ${gachaRevealedTier.border}`}>
                    <div className="text-7xl animate-bounce">{gachaRevealedTier.emoji}</div>
                    <div className="text-center">
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase mb-1 bg-white/10 text-white">
                        {gachaRevealedTier.rarity} NFT
                      </div>
                      <p className={`text-2xl font-black ${gachaRevealedTier.color}`}>{gachaRevealedTier.name}</p>
                      <p className="text-white/60 text-xs mt-1">Guard Defense: −{gachaRevealedTier.defense}% steal chance</p>
                    </div>
                    {gachaRevealTx && <TxLink hash={gachaRevealTx} />}
                  </div>

                  {bulkShardsEarned > 0 && (
                    <div className="rounded-2xl border border-amber-400/40 bg-amber-500/15 p-3 flex items-center gap-2.5">
                      <span className="text-2xl">💎</span>
                      <div className="flex-1 text-xs">
                        <span className="text-amber-300 font-bold uppercase tracking-wide text-[10px]">Bonus Drop:</span>
                        <p className="text-white font-bold">+{bulkShardsEarned} Soul Shard{bulkShardsEarned > 1 ? 's' : ''} received!</p>
                      </div>
                    </div>
                  )}

                  {jackpotWon && (
                    <div className="rounded-2xl border border-yellow-400 bg-yellow-500/20 p-3 text-center animate-pulse">
                      <p className="text-yellow-300 font-black text-xs uppercase">🏆 JACKPOT SUMMONED!</p>
                      <p className="text-white text-sm font-bold mt-0.5">High-tier Guard Dog awakened the Community Jackpot!</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setGachaPhase('idle'); setGachaRevealedTier(null); }}
                      className="flex-1 py-3.5 rounded-2xl text-sm font-black text-white active:scale-95 transition-all"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                    >
                      Pull Again
                    </button>
                    <button
                      onClick={() => setActiveTab('forge')}
                      className="flex-1 py-3.5 rounded-2xl glass text-amber-300 font-bold text-sm active:scale-95"
                    >
                      🔥 Open Soul Forge
                    </button>
                  </div>
                </div>
              )}

              {/* Gacha Result: Mega Bulk x10 Reveal */}
              {gachaPhase === 'result' && gachaRevealedBulk && gachaRevealedBulk.length > 0 && (
                <div className="flex flex-col gap-3 mb-3">
                  <div className="glass rounded-3xl border border-purple-500/40 p-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase mb-2 bg-gradient-to-r from-purple-500 to-amber-500 text-white shadow-md">
                      <Sparkles size={12} /> 10 Guard Dogs Minted!
                    </div>

                    {jackpotWon && (
                      <div className="rounded-2xl border border-yellow-400 bg-yellow-500/20 p-2.5 mb-3 text-center animate-pulse">
                        <p className="text-yellow-300 font-black text-xs uppercase">🏆 JACKPOT TRIGGERED!</p>
                        <p className="text-white text-xs font-bold mt-0.5">You summoned a Mythic/Legendary Guard Dog!</p>
                      </div>
                    )}

                    {/* 10 Dogs Grid */}
                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {gachaRevealedBulk.map((dog, idx) => {
                        const isHighTier = dog.tokenId >= 3;
                        return (
                          <div
                            key={idx}
                            className={`rounded-xl p-2 text-center flex flex-col items-center relative ${dog.bg} border ${
                              isHighTier ? 'border-amber-400 shadow-md shadow-amber-500/30 ring-1 ring-amber-400/50' : dog.border
                            }`}
                          >
                            {isHighTier && (
                              <span className="absolute -top-1 -right-1 text-[9px] bg-amber-400 text-black font-black px-1 rounded-full">
                                ★
                              </span>
                            )}
                            <span className="text-2xl">{dog.emoji}</span>
                            <span className={`text-[9px] font-black mt-1 ${dog.color} truncate w-full`}>{dog.name}</span>
                            <span className="text-[7.5px] text-white/50">{dog.rarity}</span>
                            <span className="text-[7.5px] text-emerald-300 font-bold mt-0.5">−{dog.defense}%</span>
                          </div>
                        );
                      })}
                    </div>

                    {bulkShardsEarned > 0 && (
                      <div className="bg-violet-950/40 border border-violet-400/30 rounded-xl p-2 flex items-center justify-between text-xs mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">💎</span>
                          <span className="text-violet-300 font-bold text-[11px]">Consolation Soul Shards Awarded:</span>
                        </div>
                        <span className="text-white font-black font-mono">+{bulkShardsEarned} Shards</span>
                      </div>
                    )}

                    {gachaRevealTx && <div className="mb-2"><TxLink hash={gachaRevealTx} /></div>}

                    <div className="flex gap-2">
                      <button
                        onClick={() => { setGachaPhase('idle'); setGachaRevealedBulk(null); }}
                        className="flex-1 py-3 rounded-2xl text-xs font-black text-white active:scale-95 transition-all shadow-lg shadow-purple-500/30"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}
                      >
                        Pull x10 Again
                      </button>
                      <button
                        onClick={() => setActiveTab('forge')}
                        className="flex-1 py-3 rounded-2xl glass text-amber-300 font-bold text-xs active:scale-95"
                      >
                        🔥 Open Soul Forge
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Idle Mode Details & CTA */}
              {!isGachaPending && gachaPhase !== 'result' && (
                <>
                  {/* Mode 1: Standard Pull */}
                  {pullMode === 'standard' && (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 mb-3 flex flex-col items-center gap-2 text-center">
                      <div className="text-4xl">🎲</div>
                      <p className="text-white font-black text-sm">50 $FARM / Pull</p>
                      <p className="text-white/40 text-[11px] leading-relaxed max-w-sm">
                        Transparent Commit-Reveal RNG on BSC · NFT minted directly to wallet.<br />
                        <span className="text-amber-300/90 font-semibold">🎁 Low-tier dogs (T1/T2) drop +1 Soul Shard!</span>
                      </p>
                    </div>
                  )}

                  {/* Mode 2: Golden Lucky Pull */}
                  {pullMode === 'golden' && (
                    <div className="rounded-3xl border border-amber-400/40 bg-gradient-to-b from-amber-500/15 via-black/40 to-black/60 p-4 mb-3 flex flex-col items-center gap-2 text-center shadow-lg shadow-amber-500/10">
                      <div className="text-4xl">✨</div>
                      <div>
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase mb-1 bg-amber-400 text-black">
                          2x-8x DROP RATE BOOST
                        </div>
                        <p className="text-white font-black text-sm">50 $FARM + 0.002 BNB</p>
                      </div>
                      <p className="text-white/60 text-[11px] leading-relaxed max-w-sm">
                        Boosted probabilities for Rare, Epic, Legendary &amp; Mythic dogs!<br />
                        <span className="text-amber-300 font-semibold">💎 +3 Soul Shards on T1/T2 · +2 Pity Counter · 75% to Buyback Vault!</span>
                      </p>
                    </div>
                  )}

                  {/* Mode 3: Mega Bulk Pull x10 */}
                  {pullMode === 'bulk10' && (
                    <div className="rounded-3xl border border-purple-500/40 bg-gradient-to-b from-purple-950/40 via-pink-950/20 to-black/60 p-4 mb-3 flex flex-col items-center gap-2 text-center shadow-xl shadow-purple-500/20">
                      <div className="text-4xl">🔥</div>
                      <div>
                        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase mb-1 bg-gradient-to-r from-purple-500 to-amber-400 text-white">
                          GUARANTEED TIER 3+ RARE
                        </div>
                        <p className="text-white font-black text-sm">450 $FARM + 0.015 BNB</p>
                      </div>
                      <p className="text-white/70 text-[11px] leading-relaxed max-w-sm">
                        <strong className="text-amber-300">Save 50 $FARM &amp; 90% Gas Fees!</strong> 10 dogs minted in a single blockchain transaction with Golden drop rates.
                      </p>
                    </div>
                  )}

                  {/* Drop rates table */}
                  <div className="glass rounded-2xl p-3 mb-3">
                    <p className="text-white/40 text-[10px] font-bold mb-2 text-center tracking-widest uppercase">
                      {pullMode === 'standard' ? 'Standard Drop Rates' : 'Boosted Golden Drop Rates'}
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DOG_TIERS.map((d) => (
                        <div key={d.tokenId} className={`rounded-xl p-2 text-center ${d.bg}`}>
                          <p className="text-lg">{d.emoji}</p>
                          <p className={`text-[9px] font-bold ${d.color}`}>{d.name}</p>
                          <p className="text-white/70 text-[8px] font-mono">
                            {pullMode === 'standard' ? `${d.rarity} · ${d.weight}` : `${d.rarity} · ${d.goldenWeight}`}
                          </p>
                          {d.tokenId < 3 ? (
                            <span className="text-[8px] text-amber-300 font-bold block mt-0.5">
                              {pullMode === 'standard' ? '+1 Shard 💎' : '+3 Shards 💎'}
                            </span>
                          ) : (
                            <span className="text-[8px] text-emerald-300 font-bold block mt-0.5">−{d.defense}% Steal</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pull CTA Button */}
                  {pullMode === 'standard' && (
                    <button
                      disabled={!canSign || (farmFloat !== null && farmFloat < 50) || isGachaPending}
                      onClick={() => handleGachaPull('standard')}
                      className="w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{
                        background: canSign && farmFloat !== null && farmFloat >= 50 ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : undefined,
                        color: '#fff',
                        boxShadow: canSign && farmFloat !== null && farmFloat >= 50 ? '0 0 20px rgba(37,99,235,0.4)' : undefined,
                      }}
                    >
                      {!walletAddr ? (
                        'Web3 Wallet Not Connected'
                      ) : walletLocked ? (
                        'Wallet Not Signable on This Device'
                      ) : farmFloat !== null && farmFloat < 50 ? (
                        'Insufficient $FARM (Requires 50 $FARM)'
                      ) : (
                        <>
                          <Zap size={16} /> Pull Guard Dog (50 $FARM)
                        </>
                      )}
                    </button>
                  )}

                  {pullMode === 'golden' && (
                    <button
                      disabled={!canSign || (farmFloat !== null && farmFloat < 50) || isGachaPending}
                      onClick={() => handleGachaPull('golden')}
                      className="w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{
                        background: canSign && farmFloat !== null && farmFloat >= 50 ? 'linear-gradient(135deg, #d97706, #b45309)' : undefined,
                        color: '#fff',
                        boxShadow: canSign && farmFloat !== null && farmFloat >= 50 ? '0 0 25px rgba(217,119,6,0.45)' : undefined,
                      }}
                    >
                      {!walletAddr ? (
                        'Web3 Wallet Not Connected'
                      ) : walletLocked ? (
                        'Wallet Not Signable on This Device'
                      ) : farmFloat !== null && farmFloat < 50 ? (
                        'Insufficient $FARM (Requires 50 $FARM)'
                      ) : (
                        <>
                          <Sparkles size={16} /> Pull Golden Guard Dog (50 $FARM + 0.002 BNB)
                        </>
                      )}
                    </button>
                  )}

                  {pullMode === 'bulk10' && (
                    <button
                      disabled={!canSign || (farmFloat !== null && farmFloat < 450) || isGachaPending}
                      onClick={() => handleGachaPull('bulk10')}
                      className="w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{
                        background: canSign && farmFloat !== null && farmFloat >= 450 ? 'linear-gradient(135deg, #7c3aed, #db2777)' : undefined,
                        color: '#fff',
                        boxShadow: canSign && farmFloat !== null && farmFloat >= 450 ? '0 0 25px rgba(124,58,237,0.45)' : undefined,
                      }}
                    >
                      {!walletAddr ? (
                        'Web3 Wallet Not Connected'
                      ) : walletLocked ? (
                        'Wallet Not Signable on This Device'
                      ) : farmFloat !== null && farmFloat < 450 ? (
                        'Insufficient $FARM (Requires 450 $FARM)'
                      ) : (
                        <>
                          <Flame size={16} /> Mega Pull x10 (450 $FARM + 0.015 BNB · T3+ Guaranteed)
                        </>
                      )}
                    </button>
                  )}

                  {/* Viral Referral Widget */}
                  <div className="mt-3 p-3 rounded-2xl glass border border-white/10 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <HeartHandshake size={15} className="text-pink-400" />
                        <span className="text-white font-bold text-xs">Earn 15% Instant BNB on Referrals</span>
                      </div>
                      <span className="bg-pink-500/20 text-pink-300 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-pink-500/30">
                        15% BNB Share
                      </span>
                    </div>
                    <p className="text-white/50 text-[10px] leading-relaxed">
                      Share your referral link. Whenever your invited friends perform Golden Pulls, Bulk Pulls x10, or use Divine Insurance, 15% BNB is sent directly to your claimable reward!
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-black/40 rounded-xl px-2.5 py-1.5 text-[10px] font-mono text-white/70 truncate border border-white/10">
                        https://t.me/BarnBuddyBot?start=ref_{profile?.telegramId}
                      </div>
                      <button
                        onClick={() => {
                          if (navigator?.clipboard && profile?.telegramId) {
                            navigator.clipboard.writeText(`https://t.me/BarnBuddyBot?start=ref_${profile?.telegramId}`);
                            setCopiedRefLink(true);
                            setTimeout(() => setCopiedRefLink(false), 2000);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl glass text-xs font-bold text-white hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1 flex-shrink-0"
                      >
                        {copiedRefLink ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                        {copiedRefLink ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <p className="text-white/20 text-[10px] text-center mt-3 leading-relaxed">
            Bandit Buddy Soul Forge &amp; Gacha · Verified Smart Contracts on BSC Testnet
          </p>
        </div>
      </div>
    </div>
  );
}
