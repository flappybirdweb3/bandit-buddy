import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  createWalletClient,
  createPublicClient,
  http,
  custom,
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { useQueryClient } from '@tanstack/react-query';
import { useGame } from '@/providers/GameProvider';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useDexTier } from '@/hooks/useDexTier';
import { eventBus } from '@/game/EventBus';

// ── Addresses & Config ────────────────────────────────────────────────────────

const CHAIN_ID = Number(import.meta.env.VITE_BSC_CHAIN_ID || 97);
const IS_MAINNET = CHAIN_ID === 56;

export const PANCAKE_ROUTER_ADDRESS: `0x${string}` = (
  import.meta.env.VITE_PANCAKE_ROUTER_ADDRESS ||
  (IS_MAINNET
    ? '0x10ED43C718714eb63d5aA57B78B54704E256024E'
    : '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3')
) as `0x${string}`;

export const WBNB_ADDRESS: `0x${string}` = (
  import.meta.env.VITE_WBNB_ADDRESS ||
  (IS_MAINNET
    ? '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
    : '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd')
) as `0x${string}`;

export const FARM_TOKEN_ADDRESS: `0x${string}` = (
  import.meta.env.VITE_FARM_TOKEN_ADDRESS ||
  '0xB10067A034078E3FC8335Fb003eEF7334C44952f'
) as `0x${string}`;

export const USDT_TOKEN_ADDRESS: `0x${string}` = (
  import.meta.env.VITE_USDT_TOKEN_ADDRESS ||
  (IS_MAINNET
    ? '0x55d398326f99059fF775485246999027B3197955'
    : '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd')
) as `0x${string}`;

const BSC_RPC_URL = IS_MAINNET
  ? 'https://bsc-dataseed.binance.org/'
  : 'https://data-seed-prebsc-1-s1.binance.org:8545/';

const GAS_BUFFER_BNB = BigInt('2000000000000000'); // 0.002 BNB for gas

export const WALLET_GATEWAY_ADDRESS: `0x${string}` = (
  import.meta.env.VITE_WALLET_GATEWAY_ADDRESS ||
  '0xCB7B00e0f168124C0be09A7Fae628e0261E3440B'
) as `0x${string}`;

// ── ABIs ──────────────────────────────────────────────────────────────────────

const PANCAKE_ROUTER_ABI = [
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'swapExactTokensForETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;

// Minimal WalletGateway ABI — only the cashout function needed for FARM→USDT (SA ADR-01 Option B)
const WALLET_GATEWAY_ABI = [
  {
    name: 'cashoutFarmToUSDT',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'farmAmount', type: 'uint256' },
      { name: 'minUsdtOut', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export type BaseToken = 'BNB' | 'USDT';
export type SwapDirection = 'BNB_TO_FARM' | 'FARM_TO_BNB' | 'USDT_TO_FARM' | 'FARM_TO_USDT';
export type SwapStep =
  | 'idle'
  | 'checking'
  | 'approving'
  | 'swapping'
  | 'confirming'
  | 'success'
  | 'error';

export interface SwapReceipt {
  status: 'success' | 'error';
  direction: SwapDirection;
  fromAmount: string;
  fromToken: string;
  toAmount: string;
  toToken: string;
  txHash?: `0x${string}` | null;
  errorMessage?: string;
  walletAddress?: string;
  farmBalanceAfter?: string;
  bnbBalanceAfter?: string;
  usdtBalanceAfter?: string;
  timestamp: number;
}

function parseErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/insufficient funds|gas.*balance|balance.*gas/i.test(msg)) {
    return '⛽ Not enough BNB for gas and transaction value.';
  }
  if (/user rejected|user denied/i.test(msg)) {
    return 'Transaction was cancelled.';
  }
  if (/INSUFFICIENT_OUTPUT_AMOUNT/i.test(msg)) {
    return 'Price moved too fast (slippage exceeded). Try again.';
  }
  if (/TRANSFER_FAILED/i.test(msg)) {
    return 'Transfer failed on PancakeSwap pair.';
  }
  if (/execution reverted/i.test(msg)) {
    return 'Contract reverted the swap. Please verify liquidity & token balance.';
  }
  return msg.length > 150 ? msg.slice(0, 150) + '…' : msg;
}

// ── Hook Implementation ───────────────────────────────────────────────────────

export function usePancakeSwap() {
  const qc = useQueryClient();
  const { profile } = useGame();
  const { farmPriceBnb, farmPriceUsd, isLive, killSwitchActive } = useExchangeRate(30_000);
  const { buyTax, sellTax } = useDexTier(60_000);

  const [baseToken, setBaseTokenState] = useState<BaseToken>('BNB');
  const [direction, setDirection] = useState<SwapDirection>('BNB_TO_FARM');
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [isEstimating, setIsEstimating] = useState<boolean>(false);

  const [bnbBalance, setBnbBalance] = useState<bigint | null>(null);
  const [farmBalance, setFarmBalance] = useState<bigint | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<bigint | null>(null);
  const [balLoading, setBalLoading] = useState<boolean>(false);

  const [step, setStep] = useState<SwapStep>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dedicated Swap Receipt & Modal State
  const [receipt, setReceipt] = useState<SwapReceipt | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  const fromToken = useMemo(() => {
    switch (direction) {
      case 'BNB_TO_FARM': return 'BNB';
      case 'FARM_TO_BNB': return 'FARM';
      case 'USDT_TO_FARM': return 'USDT';
      case 'FARM_TO_USDT': return 'FARM';
    }
  }, [direction]);

  const toToken = useMemo(() => {
    switch (direction) {
      case 'BNB_TO_FARM': return 'FARM';
      case 'FARM_TO_BNB': return 'BNB';
      case 'USDT_TO_FARM': return 'FARM';
      case 'FARM_TO_USDT': return 'USDT';
    }
  }, [direction]);

  const setBaseToken = useCallback((newBase: BaseToken) => {
    setBaseTokenState(newBase);
    setFromAmount('');
    setToAmount('');
    setError(null);
    if (newBase === 'BNB') {
      setDirection((prev) => (prev === 'FARM_TO_USDT' || prev === 'FARM_TO_BNB' ? 'FARM_TO_BNB' : 'BNB_TO_FARM'));
    } else {
      setDirection((prev) => (prev === 'FARM_TO_BNB' || prev === 'FARM_TO_USDT' ? 'FARM_TO_USDT' : 'USDT_TO_FARM'));
    }
  }, []);

  const chain = IS_MAINNET ? bsc : bscTestnet;

  const { address: activeAddress, account: activeAccount, canSign: canSwap } = useActiveWallet(profile);

  // ── 1. Fetch Balances ───────────────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    const address = activeAddress;
    if (!address) return;

    try {
      setBalLoading(true);
      const publicClient = createPublicClient({
        chain,
        transport: http(BSC_RPC_URL),
      });

      const [bnb, farm, usdt] = await Promise.all([
        publicClient.getBalance({ address }).catch(() => 0n),
        publicClient
          .readContract({
            address: FARM_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          })
          .catch(() => 0n),
        publicClient
          .readContract({
            address: USDT_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          })
          .catch(() => 0n),
      ]);

      setBnbBalance(bnb as bigint);
      setFarmBalance(farm as bigint);
      setUsdtBalance(usdt as bigint);
    } catch {
      // ignore
    } finally {
      setBalLoading(false);
    }
  }, [activeAddress, chain]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // ── 2. Estimate Output ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    if (!fromAmount || isNaN(Number(fromAmount)) || Number(fromAmount) <= 0) {
      setToAmount('');
      return;
    }

    const estimate = async () => {
      setIsEstimating(true);
      try {
        const publicClient = createPublicClient({
          chain,
          transport: http(BSC_RPC_URL),
        });

        if (direction === 'BNB_TO_FARM') {
          const parsedIn = parseEther(fromAmount);
          // Try router getAmountsOut
          try {
            const amounts = (await publicClient.readContract({
              address: PANCAKE_ROUTER_ADDRESS,
              abi: PANCAKE_ROUTER_ABI,
              functionName: 'getAmountsOut',
              args: [parsedIn, [WBNB_ADDRESS, FARM_TOKEN_ADDRESS]],
            })) as bigint[];

            if (!cancelled && amounts && amounts[1]) {
              setToAmount(Number(formatUnits(amounts[1], 18)).toFixed(2));
              return;
            }
          } catch {
            // fallback to oracle price
            if (farmPriceBnb > 0 && !cancelled) {
              const est = Number(fromAmount) / farmPriceBnb;
              setToAmount(est.toFixed(2));
              return;
            }
          }
        } else if (direction === 'FARM_TO_BNB') {
          const parsedIn = parseUnits(fromAmount, 18);
          try {
            const amounts = (await publicClient.readContract({
              address: PANCAKE_ROUTER_ADDRESS,
              abi: PANCAKE_ROUTER_ABI,
              functionName: 'getAmountsOut',
              args: [parsedIn, [FARM_TOKEN_ADDRESS, WBNB_ADDRESS]],
            })) as bigint[];

            if (!cancelled && amounts && amounts[1]) {
              setToAmount(Number(formatEther(amounts[1])).toFixed(6));
              return;
            }
          } catch {
            // fallback to oracle price
            if (farmPriceBnb > 0 && !cancelled) {
              const est = Number(fromAmount) * farmPriceBnb;
              setToAmount(est.toFixed(6));
              return;
            }
          }
        } else if (direction === 'USDT_TO_FARM') {
          const parsedIn = parseUnits(fromAmount, 18);
          try {
            const amounts = (await publicClient.readContract({
              address: PANCAKE_ROUTER_ADDRESS,
              abi: PANCAKE_ROUTER_ABI,
              functionName: 'getAmountsOut',
              args: [parsedIn, [USDT_TOKEN_ADDRESS, WBNB_ADDRESS, FARM_TOKEN_ADDRESS]],
            })) as bigint[];

            if (!cancelled && amounts && amounts[2]) {
              setToAmount(Number(formatUnits(amounts[2], 18)).toFixed(2));
              return;
            }
          } catch {
            // fallback to oracle price
            if (farmPriceUsd > 0 && !cancelled) {
              const est = Number(fromAmount) / farmPriceUsd;
              setToAmount(est.toFixed(2));
              return;
            }
          }
        } else {
          // FARM_TO_USDT
          const parsedIn = parseUnits(fromAmount, 18);
          try {
            const amounts = (await publicClient.readContract({
              address: PANCAKE_ROUTER_ADDRESS,
              abi: PANCAKE_ROUTER_ABI,
              functionName: 'getAmountsOut',
              args: [parsedIn, [FARM_TOKEN_ADDRESS, WBNB_ADDRESS, USDT_TOKEN_ADDRESS]],
            })) as bigint[];

            if (!cancelled && amounts && amounts[2]) {
              setToAmount(Number(formatUnits(amounts[2], 18)).toFixed(2));
              return;
            }
          } catch {
            // fallback to oracle price
            if (farmPriceUsd > 0 && !cancelled) {
              const est = Number(fromAmount) * farmPriceUsd;
              setToAmount(est.toFixed(2));
              return;
            }
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsEstimating(false);
      }
    };

    const timer = setTimeout(estimate, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fromAmount, direction, farmPriceBnb, farmPriceUsd, chain]);

  // ── 3. Toggle Direction ─────────────────────────────────────────────────────
  const toggleDirection = useCallback(() => {
    setDirection((prev) => {
      switch (prev) {
        case 'BNB_TO_FARM': return 'FARM_TO_BNB';
        case 'FARM_TO_BNB': return 'BNB_TO_FARM';
        case 'USDT_TO_FARM': return 'FARM_TO_USDT';
        case 'FARM_TO_USDT': return 'USDT_TO_FARM';
      }
    });
    setFromAmount('');
    setToAmount('');
    setError(null);
  }, []);

  // ── 4. Max, Half & Percent Handlers ────────────────────────────────────────
  const setPercent = useCallback((pct: number) => {
    if (direction === 'BNB_TO_FARM') {
      if (!bnbBalance) return;
      const usable = bnbBalance > GAS_BUFFER_BNB ? bnbBalance - GAS_BUFFER_BNB : 0n;
      const val = (Number(formatEther(usable)) * (pct / 100));
      setFromAmount(val > 0 ? (val < 0.0001 ? val.toFixed(6) : val.toFixed(4)) : '');
    } else if (direction === 'USDT_TO_FARM') {
      if (!usdtBalance) return;
      const val = (Number(formatUnits(usdtBalance, 18)) * (pct / 100));
      setFromAmount(val > 0 ? val.toFixed(2) : '');
    } else {
      if (!farmBalance) return;
      const val = (Number(formatUnits(farmBalance, 18)) * (pct / 100));
      setFromAmount(val > 0 ? val.toFixed(2) : '');
    }
  }, [direction, bnbBalance, usdtBalance, farmBalance]);

  const setMax = useCallback(() => setPercent(100), [setPercent]);
  const setHalf = useCallback(() => setPercent(50), [setPercent]);

  // ── 5. Slippage & Minimum Received ──────────────────────────────────────────
  const slippageTolerance = 0.02; // 2% slippage
  const minReceived = useMemo(() => {
    if (!toAmount || Number(toAmount) <= 0) return '0.0';
    const num = Number(toAmount);
    const taxRate = (direction === 'BNB_TO_FARM' || direction === 'USDT_TO_FARM') ? buyTax : sellTax;
    let factor = Math.max(0.85, 1 - slippageTolerance - taxRate);
    // FARM→USDT goes through WalletGateway.cashoutFarmToUSDT: additional 1% cashout fee on gross USDT.
    // Multiply by 0.99 so displayed "min received" reflects what the user actually receives.
    if (direction === 'FARM_TO_USDT') factor *= 0.99;
    const decimals = direction === 'FARM_TO_BNB' ? 6 : 2;
    return (num * factor).toFixed(decimals);
  }, [toAmount, direction, buyTax, sellTax]);

  // ── 6. Execute Swap ─────────────────────────────────────────────────────────
  const swap = async () => {
    if (!fromAmount || Number(fromAmount) <= 0) return;
    if (killSwitchActive) {
      setError('Conversion temporarily paused due to high market volatility.');
      return;
    }

    setError(null);
    setTxHash(null);

    let walletClient;
    let userAddress: `0x${string}`;

    if (canSwap && activeAccount && activeAddress) {
      userAddress = activeAddress;
      walletClient = createWalletClient({
        account: activeAccount,
        chain,
        transport: http(BSC_RPC_URL),
      });
    } else if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const [addr] = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        userAddress = addr as `0x${string}`;
        walletClient = createWalletClient({
          chain,
          transport: custom((window as any).ethereum),
        });
      } catch {
        const msg = 'Wallet connection was denied.';
        setError(msg);
        setStep('error');
        setReceipt({
          status: 'error',
          direction,
          fromAmount: fromAmount || '0',
          fromToken,
          toAmount: toAmount || '0',
          toToken,
          errorMessage: msg,
          timestamp: Date.now(),
        });
        setShowResultModal(true);
        return;
      }
    } else {
      const msg = 'Wallet not signable on this device. Import the correct private key in Settings → BSC Wallet.';
      setError(msg);
      setStep('error');
      setReceipt({
        status: 'error',
        direction,
        fromAmount: fromAmount || '0',
        fromToken,
        toAmount: toAmount || '0',
        toToken,
        errorMessage: msg,
        timestamp: Date.now(),
      });
      setShowResultModal(true);
      return;
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(BSC_RPC_URL),
    });

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 minutes
    const signingAccount = activeAccount ?? userAddress;

    try {
      let hash: `0x${string}`;

      if (direction === 'BNB_TO_FARM') {
        // Buy FARM with BNB
        setStep('swapping');
        const amountIn = parseEther(fromAmount);
        const amountOutMin = parseUnits(
          Math.max(0, Number(minReceived)).toFixed(4),
          18
        );

        try {
          hash = await walletClient.writeContract({
            account: signingAccount,
            address: PANCAKE_ROUTER_ADDRESS,
            abi: PANCAKE_ROUTER_ABI,
            functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
            args: [
              amountOutMin,
              [WBNB_ADDRESS, FARM_TOKEN_ADDRESS],
              userAddress,
              deadline,
            ],
            value: amountIn,
          });
        } catch {
          // Fallback to standard swapExactETHForTokens
          hash = await walletClient.writeContract({
            account: signingAccount,
            address: PANCAKE_ROUTER_ADDRESS,
            abi: PANCAKE_ROUTER_ABI,
            functionName: 'swapExactETHForTokens',
            args: [
              amountOutMin,
              [WBNB_ADDRESS, FARM_TOKEN_ADDRESS],
              userAddress,
              deadline,
            ],
            value: amountIn,
          });
        }

        setTxHash(hash);
        setStep('confirming');
        await publicClient.waitForTransactionReceipt({ hash });
      } else if (direction === 'FARM_TO_BNB') {
        // Sell FARM for BNB
        const amountIn = parseUnits(fromAmount, 18);
        const amountOutMin = parseEther(
          Math.max(0, Number(minReceived)).toFixed(8)
        );

        // Step 1: Check allowance
        setStep('checking');
        const allowance = (await publicClient.readContract({
          address: FARM_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [userAddress, PANCAKE_ROUTER_ADDRESS],
        })) as bigint;

        if (allowance < amountIn) {
          setStep('approving');
          const approveTx = await walletClient.writeContract({
            account: signingAccount,
            address: FARM_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [PANCAKE_ROUTER_ADDRESS, amountIn],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        // Step 2: Swap
        setStep('swapping');
        try {
          hash = await walletClient.writeContract({
            account: signingAccount,
            address: PANCAKE_ROUTER_ADDRESS,
            abi: PANCAKE_ROUTER_ABI,
            functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
            args: [
              amountIn,
              amountOutMin,
              [FARM_TOKEN_ADDRESS, WBNB_ADDRESS],
              userAddress,
              deadline,
            ],
          });
        } catch {
          hash = await walletClient.writeContract({
            account: signingAccount,
            address: PANCAKE_ROUTER_ADDRESS,
            abi: PANCAKE_ROUTER_ABI,
            functionName: 'swapExactTokensForETH',
            args: [
              amountIn,
              amountOutMin,
              [FARM_TOKEN_ADDRESS, WBNB_ADDRESS],
              userAddress,
              deadline,
            ],
          });
        }

        setTxHash(hash);
        setStep('confirming');
        await publicClient.waitForTransactionReceipt({ hash });
      } else if (direction === 'USDT_TO_FARM') {
        // Buy FARM with USDT
        const amountIn = parseUnits(fromAmount, 18);
        const amountOutMin = parseUnits(
          Math.max(0, Number(minReceived)).toFixed(4),
          18
        );

        // Step 1: Check USDT allowance
        setStep('checking');
        const allowance = (await publicClient.readContract({
          address: USDT_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [userAddress, PANCAKE_ROUTER_ADDRESS],
        })) as bigint;

        if (allowance < amountIn) {
          setStep('approving');
          const approveTx = await walletClient.writeContract({
            account: signingAccount,
            address: USDT_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [PANCAKE_ROUTER_ADDRESS, amountIn],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        // Step 2: Swap USDT -> WBNB -> FARM
        setStep('swapping');
        try {
          hash = await walletClient.writeContract({
            account: signingAccount,
            address: PANCAKE_ROUTER_ADDRESS,
            abi: PANCAKE_ROUTER_ABI,
            functionName: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
            args: [
              amountIn,
              amountOutMin,
              [USDT_TOKEN_ADDRESS, WBNB_ADDRESS, FARM_TOKEN_ADDRESS],
              userAddress,
              deadline,
            ],
          });
        } catch {
          hash = await walletClient.writeContract({
            account: signingAccount,
            address: PANCAKE_ROUTER_ADDRESS,
            abi: PANCAKE_ROUTER_ABI,
            functionName: 'swapExactTokensForTokens',
            args: [
              amountIn,
              amountOutMin,
              [USDT_TOKEN_ADDRESS, WBNB_ADDRESS, FARM_TOKEN_ADDRESS],
              userAddress,
              deadline,
            ],
          });
        }

        setTxHash(hash);
        setStep('confirming');
        await publicClient.waitForTransactionReceipt({ hash });
      } else {
        // Sell FARM for USDT via WalletGateway.cashoutFarmToUSDT() (SA ADR-01 Option B)
        // Atomic: swap + 1% treasury fee in one transaction; prevents client-side fee bypass.
        const amountIn = parseUnits(fromAmount, 18);
        const minUsdtOut = parseUnits(
          Math.max(0, Number(minReceived)).toFixed(4),
          18
        );

        // Step 1: Approve FARM to WalletGateway (not PancakeRouter — gateway pulls the tokens)
        setStep('checking');
        const allowance = (await publicClient.readContract({
          address: FARM_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [userAddress, WALLET_GATEWAY_ADDRESS],
        })) as bigint;

        if (allowance < amountIn) {
          setStep('approving');
          const approveTx = await walletClient.writeContract({
            account: signingAccount,
            address: FARM_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [WALLET_GATEWAY_ADDRESS, amountIn],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }

        // Step 2: Call gateway — swap FARM→WBNB→USDT atomically with 1% cashout fee deducted
        setStep('swapping');
        hash = await walletClient.writeContract({
          account: signingAccount,
          address: WALLET_GATEWAY_ADDRESS,
          abi: WALLET_GATEWAY_ABI,
          functionName: 'cashoutFarmToUSDT',
          args: [amountIn, minUsdtOut],
        });

        setTxHash(hash);
        setStep('confirming');
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // ── Immediately fetch updated on-chain balances ─────────────────────────
      let latestBnb = bnbBalance;
      let latestFarm = farmBalance;
      let latestUsdt = usdtBalance;
      try {
        const [bnb, farm, usdt] = await Promise.all([
          publicClient.getBalance({ address: userAddress }).catch(() => 0n),
          publicClient
            .readContract({
              address: FARM_TOKEN_ADDRESS,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [userAddress],
            })
            .catch(() => 0n),
          publicClient
            .readContract({
              address: USDT_TOKEN_ADDRESS,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [userAddress],
            })
            .catch(() => 0n),
        ]);
        latestBnb = bnb as bigint;
        latestFarm = farm as bigint;
        latestUsdt = usdt as bigint;
        setBnbBalance(latestBnb);
        setFarmBalance(latestFarm);
        setUsdtBalance(latestUsdt);
      } catch {}

      const farmFmt = latestFarm != null ? Number(formatUnits(latestFarm, 18)).toFixed(2) : undefined;
      const bnbFmt = latestBnb != null ? Number(formatEther(latestBnb)).toFixed(4) : undefined;
      const usdtFmt = latestUsdt != null ? Number(formatUnits(latestUsdt, 18)).toFixed(2) : undefined;

      const successReceipt: SwapReceipt = {
        status: 'success',
        direction,
        fromAmount,
        fromToken,
        toAmount: toAmount || minReceived,
        toToken,
        txHash: hash,
        walletAddress: userAddress,
        farmBalanceAfter: farmFmt,
        bnbBalanceAfter: bnbFmt,
        usdtBalanceAfter: usdtFmt,
        timestamp: Date.now(),
      };

      setReceipt(successReceipt);
      setShowResultModal(true);
      setStep('success');

      eventBus.emit('wallet-balance-updated', {
        bnb: latestBnb,
        farm: latestFarm,
        walletAddress: userAddress,
      });
      eventBus.emit('swap-success', {
        txHash: hash,
        fromAmount,
        fromToken,
        toAmount: toAmount || minReceived,
        toToken,
      });

      // Background secondary checks (1.5s & 3.5s) to guarantee RPC indexing synchronization
      setTimeout(async () => {
        try {
          const [b2, f2, u2] = await Promise.all([
            publicClient.getBalance({ address: userAddress }).catch(() => 0n),
            publicClient
              .readContract({
                address: FARM_TOKEN_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
              })
              .catch(() => 0n),
            publicClient
              .readContract({
                address: USDT_TOKEN_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
              })
              .catch(() => 0n),
          ]);
          setBnbBalance(b2 as bigint);
          setFarmBalance(f2 as bigint);
          setUsdtBalance(u2 as bigint);
          eventBus.emit('wallet-balance-updated', {
            bnb: b2 as bigint,
            farm: f2 as bigint,
            walletAddress: userAddress,
          });
        } catch {}
      }, 1500);

      setTimeout(async () => {
        try {
          const [b3, f3, u3] = await Promise.all([
            publicClient.getBalance({ address: userAddress }).catch(() => 0n),
            publicClient
              .readContract({
                address: FARM_TOKEN_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
              })
              .catch(() => 0n),
            publicClient
              .readContract({
                address: USDT_TOKEN_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
              })
              .catch(() => 0n),
          ]);
          setBnbBalance(b3 as bigint);
          setFarmBalance(f3 as bigint);
          setUsdtBalance(u3 as bigint);
          eventBus.emit('wallet-balance-updated', {
            bnb: b3 as bigint,
            farm: f3 as bigint,
            walletAddress: userAddress,
          });
        } catch {}
      }, 3500);

      eventBus.emit('show-toast', {
        message: `🎉 Swapped ${fromAmount} ${fromToken} → ${toAmount || minReceived} ${toToken}!`,
        type: 'success',
      });
      eventBus.emit('play-sound', 'coin');

      // Clear input and invalidate caches
      setFromAmount('');
      setToAmount('');
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['cashout-quota'] });
      qc.invalidateQueries({ queryKey: ['dex-tier'] });
      qc.invalidateQueries({ queryKey: ['exchange-rate'] });
    } catch (err) {
      const errMsg = parseErrorMessage(err);
      setStep('error');
      setError(errMsg);
      setReceipt({
        status: 'error',
        direction,
        fromAmount: fromAmount || '0',
        fromToken,
        toAmount: toAmount || minReceived || '0',
        toToken,
        errorMessage: errMsg,
        walletAddress: userAddress || activeAddress || undefined,
        timestamp: Date.now(),
      });
      setShowResultModal(true);
    }
  };

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
    setTxHash(null);
  }, []);

  const dismissResultModal = useCallback(() => {
    setShowResultModal(false);
  }, []);

  const openResultModal = useCallback(() => {
    if (receipt) setShowResultModal(true);
  }, [receipt]);

  const formattedBnbBalance = bnbBalance != null ? Number(formatEther(bnbBalance)).toFixed(4) : '0.0000';
  const formattedFarmBalance = farmBalance != null ? Number(formatUnits(farmBalance, 18)).toFixed(2) : '0.00';
  const formattedUsdtBalance = usdtBalance != null ? Number(formatUnits(usdtBalance, 18)).toFixed(2) : '0.00';

  const fromBalanceDisplay = useMemo(() => {
    if (fromToken === 'BNB') return formattedBnbBalance;
    if (fromToken === 'USDT') return formattedUsdtBalance;
    return formattedFarmBalance;
  }, [fromToken, formattedBnbBalance, formattedUsdtBalance, formattedFarmBalance]);

  const toBalanceDisplay = useMemo(() => {
    if (toToken === 'BNB') return formattedBnbBalance;
    if (toToken === 'USDT') return formattedUsdtBalance;
    return formattedFarmBalance;
  }, [toToken, formattedBnbBalance, formattedUsdtBalance, formattedFarmBalance]);

  const insufficientBalance = useMemo(() => {
    if (!fromAmount || isNaN(Number(fromAmount))) return false;
    const num = Number(fromAmount);
    if (direction === 'BNB_TO_FARM') {
      const bnbNum = bnbBalance ? Number(formatEther(bnbBalance)) : 0;
      return num > bnbNum;
    } else if (direction === 'USDT_TO_FARM') {
      const usdtNum = usdtBalance ? Number(formatUnits(usdtBalance, 18)) : 0;
      return num > usdtNum;
    } else {
      const farmNum = farmBalance ? Number(formatUnits(farmBalance, 18)) : 0;
      return num > farmNum;
    }
  }, [fromAmount, direction, bnbBalance, usdtBalance, farmBalance]);

  const stepLabel = useMemo(() => {
    switch (step) {
      case 'checking':
        return 'Checking Allowance…';
      case 'approving':
        return `Approving ${fromToken}…`;
      case 'swapping':
        return `Swapping ${fromToken} → ${toToken}…`;
      case 'confirming':
        return 'Confirming on BSC…';
      case 'success':
        return 'Swap Success!';
      case 'error':
        return 'Try Again';
      default:
        return `Swap ${fromToken} → ${toToken}`;
    }
  }, [step, fromToken, toToken]);

  const rateText = useMemo(() => {
    if (baseToken === 'BNB') {
      if (farmPriceBnb > 0) {
        const farmPerBnb = Math.round(1 / farmPriceBnb).toLocaleString();
        return direction === 'BNB_TO_FARM'
          ? `1 BNB ≈ ${farmPerBnb} FARM`
          : `1 FARM ≈ ${farmPriceBnb.toFixed(8)} BNB`;
      }
      return direction === 'BNB_TO_FARM' ? '1 BNB ≈ 200,000 FARM' : '1 FARM ≈ 0.000005 BNB';
    } else {
      if (farmPriceUsd > 0) {
        const farmPerUsdt = Math.round(1 / farmPriceUsd).toLocaleString();
        return direction === 'USDT_TO_FARM'
          ? `1 USDT ≈ ${farmPerUsdt} FARM`
          : `1 FARM ≈ $${farmPriceUsd.toFixed(4)} USDT`;
      }
      return direction === 'USDT_TO_FARM' ? '1 USDT ≈ 1,000 FARM' : '1 FARM ≈ $0.001 USDT';
    }
  }, [baseToken, farmPriceBnb, farmPriceUsd, direction]);

  return {
    baseToken,
    setBaseToken,
    direction,
    fromToken,
    toToken,
    fromAmount,
    setFromAmount,
    toAmount,
    isEstimating,
    toggleDirection,
    setMax,
    setHalf,
    setPercent,
    bnbBalance,
    farmBalance,
    usdtBalance,
    formattedBnbBalance,
    formattedFarmBalance,
    formattedUsdtBalance,
    fromBalanceDisplay,
    toBalanceDisplay,
    balLoading,
    refetchBalances: fetchBalances,
    step,
    stepLabel,
    txHash,
    error,
    swap,
    reset,
    receipt,
    showResultModal,
    setShowResultModal,
    dismissResultModal,
    openResultModal,
    minReceived,
    rateText,
    insufficientBalance,
    isLive,
    killSwitchActive,
    farmPriceUsd,
    farmPriceBnb,
    walletAddress: activeAddress,
    canSwap,
  };
}
