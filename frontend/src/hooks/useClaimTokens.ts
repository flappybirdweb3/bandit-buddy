import { useState } from 'react';
import { createWalletClient, createPublicClient, http } from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { getStoredWalletPk } from '@/hooks/useAutoWallet';

const CLAIM_CONTRACT_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'nonce', type: 'uint256' },
      { internalType: 'bytes', name: 'signature', type: 'bytes' },
    ],
    name: 'claimTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Custom errors declared in FarmTokenClaim.sol. Without them viem cannot decode a
  // revert, so every failure collapses into the literal string "execution reverted" and
  // the player is told to "check your gold balance" even when the real cause is a drained
  // pool, a stale nonce, or a wallet mismatch. Declaring them lets simulateContract() read
  // the actual error name off the revert data.
  { inputs: [], name: 'InvalidSignature', type: 'error' },
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'uint256', name: 'nonce', type: 'uint256' },
    ],
    name: 'NonceAlreadyUsed',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'available', type: 'uint256' },
      { internalType: 'uint256', name: 'requested', type: 'uint256' },
    ],
    name: 'InsufficientPoolBalance',
    type: 'error',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'min', type: 'uint256' },
      { internalType: 'uint256', name: 'max', type: 'uint256' },
    ],
    name: 'AmountOutOfBounds',
    type: 'error',
  },
  { inputs: [], name: 'EnforcedPause', type: 'error' },
  { inputs: [], name: 'ZeroAddress', type: 'error' },
] as const;

const CLAIM_CONTRACT_ADDRESS = (
  import.meta.env.VITE_CLAIM_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`;

const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(BSC_TESTNET_RPC),
});

/**
 * Walk the viem error `cause` chain looking for a decoded custom-error name.
 *
 * viem wraps reverts in several layers (ContractFunctionExecutionError →
 * ContractFunctionRevertedError → …). The name can live on `.data.errorName` at any
 * depth, so probe a bounded number of links instead of assuming one shape.
 */
function extractRevertName(err: unknown): string | null {
  let cursor: unknown = err;
  for (let depth = 0; cursor && depth < 8; depth++) {
    const anyErr = cursor as { data?: { errorName?: unknown }; errorName?: unknown; cause?: unknown };
    const name = anyErr?.data?.errorName ?? anyErr?.errorName;
    if (typeof name === 'string' && name.length > 0) return name;
    cursor = anyErr?.cause;
  }
  return null;
}

function friendlyError(err: unknown): string {
  const revertName = extractRevertName(err);
  const msg = err instanceof Error ? err.message : String(err);
  const haystack = `${revertName ?? ''} ${msg}`;

  // Decoded on-chain custom errors first — these are the actionable verdicts.
  if (revertName === 'InvalidSignature' || /InvalidSignature/i.test(haystack))
    return 'Signature rejected on-chain. This usually means the wallet on this device differs from the wallet linked to your account (Settings → BSC Wallet). Your GOLD was returned.';
  if (revertName === 'NonceAlreadyUsed' || /NonceAlreadyUsed|nonce.*already used/i.test(haystack))
    return 'This claim was already processed on-chain. Refresh your balance — you were not charged twice.';
  if (revertName === 'InsufficientPoolBalance' || /InsufficientPoolBalance/i.test(haystack))
    return 'The FARM reward pool is empty right now. Your GOLD was returned — please try again later.';
  if (revertName === 'AmountOutOfBounds' || /AmountOutOfBounds/i.test(haystack))
    return 'Claim amount is outside the contract limit (1 – 100,000 FARM). Try a smaller amount. Your GOLD was returned.';
  if (revertName === 'EnforcedPause' || /EnforcedPause/i.test(haystack))
    return 'Claims are temporarily paused. Your GOLD was returned — try again later.';

  // Transport / wallet-level conditions.
  if (/total cost|insufficient funds|gas.*balance|balance.*gas/i.test(msg))
    return '⛽ Not enough BNB for gas. Send tBNB to your wallet first.';
  if (/user rejected|user denied|rejected the request/i.test(msg))
    return 'Transaction cancelled.';
  if (/network|timeout|fetch|detect network/i.test(msg))
    return 'Network error reaching BSC. Check your connection and try again.';
  if (/execution reverted/i.test(msg))
    return 'Contract rejected the transaction. Your GOLD was returned — see the console for the raw revert.';

  return msg.length > 160 ? msg.slice(0, 160) + '…' : msg;
}

export type ClaimStep =
  | 'idle'
  | 'requesting_sig'
  | 'sending_tx'
  | 'confirming'
  | 'success'
  | 'error';

export function useClaimTokens() {
  const qc = useQueryClient();
  const [step,         setStep]         = useState<ClaimStep>('idle');
  const [txHash,       setTxHash]       = useState<`0x${string}` | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [pendingNonce, setPendingNonce] = useState<number | null>(null);
  const [refundable,   setRefundable]   = useState(false);
  const [refunding,    setRefunding]    = useState(false);

  const claim = async (goldAmount: number) => {
    const pk = getStoredWalletPk();
    if (!pk) {
      setError('No wallet found. Please re-open the app.');
      return;
    }

    setError(null);
    setTxHash(null);
    setPendingNonce(null);
    setRefundable(false);

    // Local trackers — state updates are async, so the catch block cannot read them.
    let receivedNonce: number | null = null;
    // True once a tx hash exists, i.e. the tx may be sitting in the mempool and could
    // still confirm. Auto-refunding in that window would pay the player twice.
    let broadcasted = false;

    try {
      setStep('requesting_sig');
      const payload = await api.claimSignature(goldAmount);
      // GOLD was deducted server-side — track the nonce for the refund path.
      receivedNonce = payload.nonce;
      setPendingNonce(payload.nonce);

      const account = privateKeyToAccount(pk);
      const walletClient = createWalletClient({
        account,
        chain: bscTestnet,
        transport: http(BSC_TESTNET_RPC),
      });

      // The signature is domain-bound to payload.userAddress. Sending from any other
      // address makes the contract recover a different signer and revert InvalidSignature
      // — burning gas for a claim that can never succeed. Fail loudly and let the
      // auto-refund below return the GOLD.
      if (payload.userAddress && account.address.toLowerCase() !== payload.userAddress.toLowerCase()) {
        throw new Error(
          `Wallet mismatch: this device signs with ${account.address}, but your account is ` +
            `linked to ${payload.userAddress}. Import the linked wallet's private key in Settings.`,
        );
      }

      const args = [
        BigInt(payload.amountWei),
        BigInt(payload.nonce),
        payload.signature as `0x${string}`,
      ] as const;

      setStep('sending_tx');

      // SIMULATE first. Nothing is broadcast, so a revert here is provably NOT on-chain —
      // which is what makes the automatic refund in catch safe instead of a double-pay.
      // It also decodes the custom error name for a precise message, and surfaces
      // insufficient-gas-funds before any tx leaves the wallet.
      const { request } = await publicClient.simulateContract({
        account,
        address: CLAIM_CONTRACT_ADDRESS,
        abi: CLAIM_CONTRACT_ABI,
        functionName: 'claimTokens',
        args,
      });

      const hash = await walletClient.writeContract(request);
      broadcasted = true;
      setTxHash(hash);
      setStep('confirming');

      await publicClient.waitForTransactionReceipt({ hash });

      setStep('success');
      // Mark intent as completed (best-effort)
      api.markClaimCompleted(payload.nonce).catch(() => {});
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (err) {
      let message = friendlyError(err);

      if (receivedNonce !== null) {
        if (!broadcasted) {
          // No tx reached the mempool, so there is no on-chain success to race against.
          // Return the GOLD now instead of making the player find a Refund button.
          // The backend independently re-checks isNonceUsed() before crediting.
          try {
            await api.refundClaim(receivedNonce);
            setPendingNonce(null);
            qc.invalidateQueries({ queryKey: ['profile'] });
            message += ' ↩ GOLD refunded automatically.';
          } catch {
            // Refund endpoint unreachable/failed — fall back to the manual button.
            setRefundable(true);
          }
        } else {
          // A tx hash exists: it may still confirm. Never auto-refund; let the player
          // confirm on BSCScan first.
          setRefundable(true);
        }
      }

      setError(message);
      setStep('error');
    }
  };

  const refund = async () => {
    if (pendingNonce === null) return;
    setRefunding(true);
    try {
      await api.refundClaim(pendingNonce);
      setPendingNonce(null);
      setRefundable(false);
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Refund failed';
      setError(msg.length > 120 ? msg.slice(0, 120) + '…' : msg);
    } finally {
      setRefunding(false);
    }
  };

  const reset = () => {
    setStep('idle');
    setError(null);
    setTxHash(null);
    setPendingNonce(null);
    setRefundable(false);
  };

  return { claim, refund, step, txHash, error, reset, refundable, refunding };
}

export async function getWalletBnbBalance(address: `0x${string}`): Promise<bigint> {
  return publicClient.getBalance({ address });
}
