import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, isAddress, type Hash } from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { getStoredWalletPk } from '@/hooks/useAutoWallet';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useGame } from '@/providers/GameProvider';
import { useDynamicRates } from '@/hooks/useDynamicRates';
import WebApp from '@twa-dev/sdk';

export const FARM_TOKEN_ADDRESS = (import.meta.env.VITE_FARM_TOKEN_ADDRESS || '0xB10067A034078E3FC8335Fb003eEF7334C44952f') as `0x${string}`;
export const USDT_TOKEN_ADDRESS = (
  import.meta.env.VITE_USDT_TOKEN_ADDRESS ||
  (import.meta.env.VITE_NETWORK === 'mainnet'
    ? '0x55d398326f99059fF775485246999027B3197955'
    : '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd')
) as `0x${string}`;
export const GACHA_CONTRACT_ADDRESS = (import.meta.env.VITE_GACHA_CONTRACT_ADDRESS || '0x8fdD78C87793084384257fe14Fe448E12220e9d6') as `0x${string}`;
export const TREASURY_VAULT_ADDRESS = '0xe59FfB05EdF59464e8803E81A4d790d828915006' as `0x${string}`;
export const PANCAKE_ROUTER_ADDRESS = '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3' as `0x${string}`;
export const WALLET_GATEWAY_ADDRESS = (import.meta.env.VITE_WALLET_GATEWAY_ADDRESS || '0xCB7B00e0f168124C0be09A7Fae628e0261E3440B') as `0x${string}`;
export const WITHDRAWAL_FEE_BPS = 30; // 0.3%

export const WALLET_GATEWAY_ABI = [
  {
    name: 'routeBNBTransfer',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
  },
  {
    name: 'routeTokenTransfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    // SA ADR-01 Option B: atomic FARM→USDT swap + 1% fee in one transaction
    name: 'cashoutFarmToUSDT',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'farmAmount', type: 'uint256' },
      { name: 'minUsdtOut', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'feeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export type FiatCurrency = 'USD' | 'EUR' | 'VND';

export interface WalletTxRecord {
  id: string;
  txHash: string;
  type: 'send_bnb' | 'send_farm' | 'send_usdt' | 'receive' | 'gacha_pull' | 'revoke' | 'claim';
  token: 'BNB' | 'FARM' | 'USDT';
  amount: string;
  recipientOrSpender?: string;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
  title: string;
}

export interface ContractApproval {
  contractName: string;
  spenderAddress: `0x${string}`;
  allowanceRaw: bigint;
  allowanceFormatted: string;
  isUnlimited: boolean;
  category: 'Game Core' | 'DEX Router' | 'Vault Protocol';
}

const FIAT_RATES: Record<FiatCurrency, { symbol: string; rateFromUsd: number; prefix: boolean }> = {
  USD: { symbol: '$', rateFromUsd: 1.0, prefix: true },
  EUR: { symbol: '€', rateFromUsd: 0.92, prefix: true },
  VND: { symbol: '₫', rateFromUsd: 25450, prefix: false },
};

const STORAGE_CURRENCY_KEY = 'bb_wallet_fiat_currency';
const STORAGE_BACKUP_KEY = 'bb_wallet_backup_status';
const STORAGE_BACKUP_DATE_KEY = 'bb_wallet_backup_date';
const STORAGE_TX_HISTORY_KEY = 'bb_wallet_tx_history';
const CLOUD_PK_KEY = 'bb_wk';      // legacy single-key slot (kept for backward compat)
const CLOUD_LIST_KEY = 'bb_wk_v2'; // multi-wallet list slot

export { tgCloudGet, tgCloudAvailable } from '@/hooks/telegramCloud';
import { tgCloudSet, tgCloudGet, tgCloudAvailable } from '@/hooks/telegramCloud';

// Internal: full entry with private key (never exposed outside this module)
interface CloudWalletEntry {
  address: string;
  pk: string;
  label: string;
  backedUpAt: string;
}

// Public: display-safe entry — private key stripped before leaving the hook
export interface CloudWalletDisplay {
  address: string;
  label: string;
  backedUpAt: string;
}

function toDisplay(e: CloudWalletEntry): CloudWalletDisplay {
  return { address: e.address, label: e.label, backedUpAt: e.backedUpAt };
}

function isValidEntry(e: unknown): e is CloudWalletEntry {
  return (
    typeof (e as any)?.address === 'string' &&
    typeof (e as any)?.pk === 'string' &&
    typeof (e as any)?.label === 'string' &&
    typeof (e as any)?.backedUpAt === 'string'
  );
}

async function readCloudWallets(): Promise<CloudWalletEntry[]> {
  const raw = await tgCloudGet(CLOUD_LIST_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(isValidEntry)) return parsed;
    } catch {}
  }
  // Migrate from legacy single-key backup
  const legacyPk = await tgCloudGet(CLOUD_PK_KEY);
  if (legacyPk) {
    try {
      const acct = privateKeyToAccount(legacyPk as `0x${string}`);
      const entry: CloudWalletEntry = {
        address: acct.address,
        pk: legacyPk,
        label: 'My Wallet',
        backedUpAt: new Date().toISOString().split('T')[0],
      };
      await tgCloudSet(CLOUD_LIST_KEY, JSON.stringify([entry])).catch(() => {});
      return [entry];
    } catch {}
  }
  return [];
}

export function useMPCWallet() {
  const qc = useQueryClient();
  const { farmPriceUsd, farmPriceBnb } = useDynamicRates(30_000);

  // Derive BNB Price in USD from live DEX oracle
  const bnbPriceUsd = useMemo(() => {
    if (farmPriceBnb && farmPriceBnb > 0 && farmPriceUsd && farmPriceUsd > 0) {
      return farmPriceUsd / farmPriceBnb;
    }
    return 600.0; // fallback standard BNB price
  }, [farmPriceBnb, farmPriceUsd]);

  // Canonical wallet — profile.walletAddress is the single source of truth for the address,
  // shared with GachaModal, ClaimModal, DEX tab, and all other game features.
  const { profile } = useGame();
  const { address, account, canSign, walletLocked } = useActiveWallet(profile);

  // Local private key: read for key-management UI only (export, backup, QR, import).
  // Never used to derive address — use `address` from useActiveWallet for all on-chain reads.
  const localPk = getStoredWalletPk(profile?.telegramId);

  const shortAddress = useMemo(() => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  // Currency preference
  const [currency, setCurrencyState] = useState<FiatCurrency>(() => {
    return (localStorage.getItem(STORAGE_CURRENCY_KEY) as FiatCurrency) || 'USD';
  });

  const setCurrency = useCallback((c: FiatCurrency) => {
    setCurrencyState(c);
    localStorage.setItem(STORAGE_CURRENCY_KEY, c);
  }, []);

  // Format currency helper
  const formatFiat = useCallback((amountInUsd: number): string => {
    const info = FIAT_RATES[currency] || FIAT_RATES.USD;
    const converted = amountInUsd * info.rateFromUsd;

    if (currency === 'VND') {
      return `${Math.round(converted).toLocaleString('vi-VN')} ${info.symbol}`;
    }
    return `${info.symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [currency]);

  // Backup states — initialized from localStorage, then verified against CloudStorage on mount
  const [isBackedUp, setIsBackedUp] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_BACKUP_KEY) === '1';
  });

  const [lastBackupDate, setLastBackupDate] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_BACKUP_DATE_KEY);
  });

  const [cloudWallets, setCloudWallets] = useState<CloudWalletDisplay[]>([]);

  // On address change: load cloud wallet list and sync isBackedUp badge.
  // isBackedUp = true when the profile wallet's key exists in Telegram CloudStorage.
  useEffect(() => {
    if (!address) return;
    readCloudWallets().then((wallets) => {
      setCloudWallets(wallets.map(toDisplay));
      const activeEntry = wallets.find((w) => w.address.toLowerCase() === address.toLowerCase());
      if (activeEntry) {
        const savedDate = localStorage.getItem(STORAGE_BACKUP_DATE_KEY) || activeEntry.backedUpAt;
        localStorage.setItem(STORAGE_BACKUP_KEY, '1');
        localStorage.setItem(STORAGE_BACKUP_DATE_KEY, savedDate);
        setIsBackedUp(true);
        setLastBackupDate(savedDate);
      } else if (localStorage.getItem(STORAGE_BACKUP_KEY) === '1') {
        localStorage.removeItem(STORAGE_BACKUP_KEY);
        localStorage.removeItem(STORAGE_BACKUP_DATE_KEY);
        setIsBackedUp(false);
        setLastBackupDate(null);
      }
    });
  }, [address]);

  // Client instances
  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: bscTestnet,
      transport: http('https://bsc-testnet-rpc.publicnode.com'),
    });
  }, []);

  const walletClient = useMemo(() => {
    if (!account) return null;
    return createWalletClient({
      account,
      chain: bscTestnet,
      transport: http('https://bsc-testnet-rpc.publicnode.com'),
    });
  }, [account]);

  // Query on-chain balances
  const balancesQuery = useQuery({
    queryKey: ['mpc-wallet-balances', address],
    queryFn: async () => {
      if (!address) return { bnb: 0n, farm: 0n, usdt: 0n };
      const [bnb, farm, usdt] = await Promise.all([
        publicClient.getBalance({ address }),
        publicClient.readContract({
          address: FARM_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }).catch(() => 0n),
        publicClient.readContract({
          address: USDT_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }).catch(() => 0n),
      ]);
      return { bnb, farm, usdt };
    },
    enabled: !!address,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const bnbBalance = balancesQuery.data?.bnb ?? null;
  const farmBalance = balancesQuery.data?.farm ?? null;
  const usdtBalance = balancesQuery.data?.usdt ?? null;

  const bnbFloat = bnbBalance !== null ? parseFloat(formatEther(bnbBalance)) : 0;
  const farmFloat = farmBalance !== null ? parseFloat(formatEther(farmBalance)) : 0;
  const usdtFloat = usdtBalance !== null ? parseFloat(formatEther(usdtBalance)) : 0;

  const usdtPriceUsd = 1.0;
  const bnbValueUsd = bnbFloat * bnbPriceUsd;
  const farmValueUsd = farmFloat * (farmPriceUsd || 0.00022);
  const usdtValueUsd = usdtFloat * usdtPriceUsd;
  const totalAssetsUsd = bnbValueUsd + farmValueUsd + usdtValueUsd;

  const bnbFormatted = bnbBalance !== null ? bnbFloat.toFixed(4) : '0.0000';
  const farmFormatted = farmBalance !== null ? farmFloat.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0.00';
  const usdtFormatted = usdtBalance !== null ? usdtFloat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

  // 24h Price Changes badge percentages
  const priceChanges24h = useMemo(() => ({
    BNB: 2.45,
    FARM: 12.80,
    USDT: 0.01,
  }), []);

  // Transaction history local persistence
  const [txHistory, setTxHistory] = useState<WalletTxRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_TX_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addTxRecord = useCallback((rec: Omit<WalletTxRecord, 'id' | 'timestamp'>) => {
    const newRecord: WalletTxRecord = {
      ...rec,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    setTxHistory((prev) => {
      const updated = [newRecord, ...prev].slice(0, 50);
      localStorage.setItem(STORAGE_TX_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Cloud Backup — upserts the locally stored key into the multi-wallet cloud list.
  // Uses localPk directly (not the canSign account) so users can always back up
  // whatever key is on this device, even when it doesn't match the profile wallet.
  const performCloudBackup = useCallback(async () => {
    if (!localPk) throw new Error('No wallet key to back up on this device');
    let backupAcct: ReturnType<typeof privateKeyToAccount>;
    try {
      backupAcct = privateKeyToAccount(localPk);
    } catch {
      throw new Error('Invalid private key stored on this device');
    }
    const wallets = await readCloudWallets();
    const idx = wallets.findIndex((w) => w.address.toLowerCase() === backupAcct.address.toLowerCase());
    const today = new Date().toISOString().split('T')[0];
    const entry: CloudWalletEntry = {
      address: backupAcct.address,
      pk: localPk,
      label: idx >= 0 ? wallets[idx].label : `Wallet ${wallets.length + 1}`,
      backedUpAt: today,
    };
    if (idx >= 0) {
      wallets[idx] = entry;
    } else {
      if (wallets.length >= 20) {
        throw new Error('Cloud backup limit reached (20 wallets max). Delete old backups first.');
      }
      wallets.push(entry);
    }
    await tgCloudSet(CLOUD_LIST_KEY, JSON.stringify(wallets));
    await tgCloudSet(CLOUD_PK_KEY, localPk).catch(() => {});
    localStorage.setItem(STORAGE_BACKUP_KEY, '1');
    localStorage.setItem(STORAGE_BACKUP_DATE_KEY, today);
    setIsBackedUp(true);
    setLastBackupDate(today);
    setCloudWallets(wallets.map(toDisplay));
    try { (WebApp as any)?.HapticFeedback?.notificationOccurred?.('success'); } catch {}
    return true;
  }, [localPk]);

  // Restore a specific wallet by address, or the only wallet if list has 1 entry
  const restoreFromCloud = useCallback(async (targetAddress?: string): Promise<boolean> => {
    const wallets = await readCloudWallets();
    let target: CloudWalletEntry | undefined;
    if (targetAddress) {
      target = wallets.find((w) => w.address.toLowerCase() === targetAddress.toLowerCase());
    } else {
      target = wallets.length === 1 ? wallets[0] : undefined;
    }
    if (!target) return false;
    try {
      const derived = privateKeyToAccount(target.pk as `0x${string}`);
      // Verify the stored key actually derives the claimed address — catches corrupted entries
      if (derived.address.toLowerCase() !== target.address.toLowerCase()) return false;
    } catch {
      return false;
    }
    const tid = (WebApp as any)?.initDataUnsafe?.user?.id;
    const userKey = tid ? `bb_wallet_pk_${tid}` : 'bb_wallet_pk';
    localStorage.setItem(userKey, target.pk);
    localStorage.setItem('bb_wallet_pk', target.pk);
    return true;
  }, []);

  // Remove a wallet entry from the cloud backup list
  const deleteCloudWallet = useCallback(async (targetAddress: string): Promise<void> => {
    const wallets = await readCloudWallets();
    const filtered = wallets.filter((w) => w.address.toLowerCase() !== targetAddress.toLowerCase());
    await tgCloudSet(CLOUD_LIST_KEY, JSON.stringify(filtered));
    setCloudWallets(filtered.map(toDisplay));
    if (address && address.toLowerCase() === targetAddress.toLowerCase()) {
      localStorage.removeItem(STORAGE_BACKUP_KEY);
      localStorage.removeItem(STORAGE_BACKUP_DATE_KEY);
      setIsBackedUp(false);
      setLastBackupDate(null);
    }
  }, [address]);

  // Rename a wallet entry label in the cloud backup list
  const renameCloudWallet = useCallback(async (targetAddress: string, newLabel: string): Promise<void> => {
    const wallets = await readCloudWallets();
    const idx = wallets.findIndex((w) => w.address.toLowerCase() === targetAddress.toLowerCase());
    if (idx < 0) return;
    wallets[idx] = { ...wallets[idx], label: newLabel.trim() || wallets[idx].label };
    await tgCloudSet(CLOUD_LIST_KEY, JSON.stringify(wallets));
    setCloudWallets(wallets.map(toDisplay));
  }, []);

  // Send BNB Action
  const sendBnb = useCallback(async ({ recipient, amountEther }: { recipient: string; amountEther: string }): Promise<Hash> => {
    if (!canSign || !account || !walletClient) throw new Error(walletLocked ? 'Wallet not signable on this device. Import the correct key in Settings.' : 'No wallet connected.');
    if (!isAddress(recipient)) throw new Error('Invalid BSC recipient address');

    const value = parseEther(amountEther);
    if (value <= 0n) throw new Error('Amount must be greater than zero');

    // Route through WalletGateway (0.3% fee to Treasury Buyback Vault)
    const txHash = await walletClient.writeContract({
      address: WALLET_GATEWAY_ADDRESS,
      abi: WALLET_GATEWAY_ABI,
      functionName: 'routeBNBTransfer',
      args: [recipient as `0x${string}`],
      value,
    });

    addTxRecord({
      txHash,
      type: 'send_bnb',
      token: 'BNB',
      amount: amountEther,
      recipientOrSpender: recipient,
      status: 'confirmed',
      title: `Send ${amountEther} BNB (0.3% Treasury Fee)`,
    });

    // Invalidate queries to refresh balance
    qc.invalidateQueries({ queryKey: ['mpc-wallet-balances'] });
    qc.invalidateQueries({ queryKey: ['treasury-status'] });
    return txHash;
  }, [walletClient, account, addTxRecord, qc]);

  // Send FARM Action
  const sendFarm = useCallback(async ({ recipient, amountFarm }: { recipient: string; amountFarm: string }): Promise<Hash> => {
    if (!canSign || !account || !walletClient) throw new Error(walletLocked ? 'Wallet not signable on this device. Import the correct key in Settings.' : 'No wallet connected.');
    if (!isAddress(recipient)) throw new Error('Invalid BSC recipient address');

    const amountWei = parseEther(amountFarm);
    if (amountWei <= 0n) throw new Error('Amount must be greater than zero');

    // Ensure allowance for WALLET_GATEWAY_ADDRESS
    const allowance = (await publicClient.readContract({
      address: FARM_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account.address, WALLET_GATEWAY_ADDRESS],
    })) as bigint;

    if (allowance < amountWei) {
      const approveTx = await walletClient.writeContract({
        address: FARM_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [WALLET_GATEWAY_ADDRESS, parseEther('1000000000')],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }

    // Route through WalletGateway (0.3% fee to Treasury Buyback Vault)
    const txHash = await walletClient.writeContract({
      address: WALLET_GATEWAY_ADDRESS,
      abi: WALLET_GATEWAY_ABI,
      functionName: 'routeTokenTransfer',
      args: [FARM_TOKEN_ADDRESS, recipient as `0x${string}`, amountWei],
    });

    addTxRecord({
      txHash,
      type: 'send_farm',
      token: 'FARM',
      amount: amountFarm,
      recipientOrSpender: recipient,
      status: 'confirmed',
      title: `Send ${amountFarm} $FARM (0.3% Burn Fee)`,
    });

    qc.invalidateQueries({ queryKey: ['mpc-wallet-balances'] });
    qc.invalidateQueries({ queryKey: ['treasury-status'] });
    return txHash;
  }, [walletClient, account, publicClient, addTxRecord, qc]);

  // Send USDT Action
  const sendUsdt = useCallback(async ({ recipient, amountUsdt }: { recipient: string; amountUsdt: string }): Promise<Hash> => {
    if (!canSign || !account || !walletClient) throw new Error(walletLocked ? 'Wallet not signable on this device. Import the correct key in Settings.' : 'No wallet connected.');
    if (!isAddress(recipient)) throw new Error('Invalid BSC recipient address');

    const amountWei = parseEther(amountUsdt);
    if (amountWei <= 0n) throw new Error('Amount must be greater than zero');

    // Ensure allowance for WALLET_GATEWAY_ADDRESS
    const allowance = (await publicClient.readContract({
      address: USDT_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account.address, WALLET_GATEWAY_ADDRESS],
    })) as bigint;

    if (allowance < amountWei) {
      const approveTx = await walletClient.writeContract({
        address: USDT_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [WALLET_GATEWAY_ADDRESS, parseEther('1000000000')],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }

    // Route through WalletGateway (0.3% fee to Treasury Buyback Vault)
    const txHash = await walletClient.writeContract({
      address: WALLET_GATEWAY_ADDRESS,
      abi: WALLET_GATEWAY_ABI,
      functionName: 'routeTokenTransfer',
      args: [USDT_TOKEN_ADDRESS, recipient as `0x${string}`, amountWei],
    });

    addTxRecord({
      txHash,
      type: 'send_usdt',
      token: 'USDT',
      amount: amountUsdt,
      recipientOrSpender: recipient,
      status: 'confirmed',
      title: `Send ${amountUsdt} USDT (0.3% Treasury Fee)`,
    });

    qc.invalidateQueries({ queryKey: ['mpc-wallet-balances'] });
    qc.invalidateQueries({ queryKey: ['treasury-status'] });
    return txHash;
  }, [walletClient, account, publicClient, addTxRecord, qc]);

  // Estimate Max Sendable BNB (reserving 0.0005 BNB for gas)
  const getMaxSendableBnb = useCallback(() => {
    if (!bnbBalance) return '0';
    const gasReserve = parseEther('0.0005'); // 21,000 gas * 3 gwei * buffer = ~0.0001 BNB
    if (bnbBalance <= gasReserve) return '0';
    return formatEther(bnbBalance - gasReserve);
  }, [bnbBalance]);

  // Approvals query & Revoke logic
  const approvalsQuery = useQuery({
    queryKey: ['mpc-wallet-approvals', address],
    queryFn: async (): Promise<ContractApproval[]> => {
      if (!address) return [];
      const spenders: Array<{ name: string; address: `0x${string}`; category: 'Game Core' | 'DEX Router' | 'Vault Protocol' }> = [
        { name: 'Bandit Dog Fusion & Gacha v4.2', address: GACHA_CONTRACT_ADDRESS, category: 'Game Core' },
        { name: 'PancakeSwap V2 Router', address: PANCAKE_ROUTER_ADDRESS, category: 'DEX Router' },
        { name: 'Treasury Buyback Vault', address: TREASURY_VAULT_ADDRESS, category: 'Vault Protocol' },
        { name: 'Wallet Gateway (0.3% Fee Router)', address: WALLET_GATEWAY_ADDRESS, category: 'Vault Protocol' },
      ];

      const results = await Promise.all(
        spenders.map(async (s) => {
          try {
            const raw = (await publicClient.readContract({
              address: FARM_TOKEN_ADDRESS,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [address, s.address],
            })) as bigint;

            const isUnlimited = raw > parseEther('10000000');
            return {
              contractName: s.name,
              spenderAddress: s.address,
              allowanceRaw: raw,
              allowanceFormatted: isUnlimited ? 'Unlimited' : parseFloat(formatEther(raw)).toLocaleString(),
              isUnlimited,
              category: s.category,
            };
          } catch {
            return null;
          }
        })
      );

      return results.filter((r): r is ContractApproval => r !== null && r.allowanceRaw > 0n);
    },
    enabled: !!address,
  });

  const revokeApproval = useCallback(async (spenderAddress: `0x${string}`): Promise<Hash> => {
    if (!canSign || !account || !walletClient) throw new Error(walletLocked ? 'Wallet not signable on this device.' : 'No wallet connected.');

    const txHash = await walletClient.writeContract({
      address: FARM_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spenderAddress, 0n],
    });

    addTxRecord({
      txHash,
      type: 'revoke',
      token: 'FARM',
      amount: '0',
      recipientOrSpender: spenderAddress,
      status: 'confirmed',
      title: 'Revoke Smart Contract Allowance',
    });

    qc.invalidateQueries({ queryKey: ['mpc-wallet-approvals'] });
    return txHash;
  }, [walletClient, account, addTxRecord, qc]);

  const refreshBalances = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['mpc-wallet-balances'] });
    qc.invalidateQueries({ queryKey: ['mpc-wallet-approvals'] });
  }, [qc]);

  return {
    account,
    address,
    shortAddress,
    hasWallet: !!address,
    canSign,
    walletLocked,
    pk: localPk,
    bnbBalance,
    farmBalance,
    usdtBalance,
    bnbFormatted,
    farmFormatted,
    usdtFormatted,
    bnbPriceUsd,
    farmPriceUsd: farmPriceUsd || 0.00022,
    usdtPriceUsd,
    bnbValueUsd,
    farmValueUsd,
    usdtValueUsd,
    totalAssetsUsd,
    priceChanges24h,
    currency,
    setCurrency,
    formatFiat,
    isBackedUp,
    lastBackupDate,
    cloudStorageAvailable: tgCloudAvailable(),
    cloudWallets,
    performCloudBackup,
    restoreFromCloud,
    deleteCloudWallet,
    renameCloudWallet,
    sendBnb,
    sendFarm,
    sendUsdt,
    getMaxSendableBnb,
    approvals: approvalsQuery.data ?? [],
    isLoadingApprovals: approvalsQuery.isLoading,
    revokeApproval,
    txHistory,
    refreshBalances,
    isLoadingBalances: balancesQuery.isLoading,
    withdrawalFeeBps: WITHDRAWAL_FEE_BPS,
    walletGatewayAddress: WALLET_GATEWAY_ADDRESS,
  };
}
