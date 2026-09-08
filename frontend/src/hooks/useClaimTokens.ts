import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

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

const CLAIM_CONTRACT_ADDRESS = (import.meta.env.VITE_CLAIM_CONTRACT_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

export function useClaimTokens() {
  const { isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const qc = useQueryClient();
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending: walletPending } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const claim = async (goldAmount: number) => {
    setError(null);

    if (!isConnected) {
      open();
      return;
    }

    setIsRequesting(true);
    try {
      const payload = await api.claimSignature(goldAmount);

      writeContract({
        address: CLAIM_CONTRACT_ADDRESS,
        abi: CLAIM_CONTRACT_ABI,
        functionName: 'claimTokens',
        args: [
          BigInt(payload.amountWei),
          BigInt(payload.nonce),
          payload.signature as `0x${string}`,
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setIsRequesting(false);
    }
  };

  // Refresh profile after successful claim
  if (confirmed) {
    qc.invalidateQueries({ queryKey: ['profile'] });
  }

  return {
    claim,
    txHash,
    isRequesting,
    walletPending,
    confirming,
    confirmed,
    error,
  };
}
