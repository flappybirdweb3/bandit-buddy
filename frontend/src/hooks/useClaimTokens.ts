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
] as const;

const CLAIM_CONTRACT_ADDRESS = (
  import.meta.env.VITE_CLAIM_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`;

const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(BSC_TESTNET_RPC),
});

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/total cost|insufficient funds|gas.*balance|balance.*gas/i.test(msg))
    return '⛽ Not enough BNB for gas. Send tBNB to your wallet first.';
  if (/user rejected|user denied|rejected the request/i.test(msg))
    return 'Transaction cancelled.';
  if (/nonce.*already used|NonceAlreadyUsed/i.test(msg))
    return 'This claim was already processed (nonce used).';
  if (/execution reverted/i.test(msg))
    return 'Contract rejected transaction. Check your gold balance and try again.';
  if (/network|timeout|fetch/i.test(msg))
    return 'Network error. Check connection and try again.';
  return msg.length > 120 ? msg.slice(0, 120) + '…' : msg;
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

    // Local tracker — state updates are async so we can't read pendingNonce in catch
    let receivedNonce: number | null = null;

    try {
      setStep('requesting_sig');
      const payload = await api.claimSignature(goldAmount);
      // GOLD was deducted server-side — track nonce for potential refund
      receivedNonce = payload.nonce;
      setPendingNonce(payload.nonce);

      const account = privateKeyToAccount(pk);
      const walletClient = createWalletClient({
        account,
        chain: bscTestnet,
        transport: http(BSC_TESTNET_RPC),
      });

      setStep('sending_tx');
      const hash = await walletClient.writeContract({
        address: CLAIM_CONTRACT_ADDRESS,
        abi: CLAIM_CONTRACT_ABI,
        functionName: 'claimTokens',
        args: [
          BigInt(payload.amountWei),
          BigInt(payload.nonce),
          payload.signature as `0x${string}`,
        ],
      });

      setTxHash(hash);
      setStep('confirming');

      await publicClient.waitForTransactionReceipt({ hash });

      setStep('success');
      // Mark intent as completed (best-effort)
      api.markClaimCompleted(payload.nonce).catch(() => {});
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (err) {
      setError(friendlyError(err));
      setStep('error');
      // Only show Refund button if GOLD was actually deducted (nonce received from server)
      if (receivedNonce !== null) {
        setRefundable(true);
      }
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
