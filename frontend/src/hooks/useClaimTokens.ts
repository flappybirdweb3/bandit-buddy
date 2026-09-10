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

export type ClaimStep =
  | 'idle'
  | 'requesting_sig'
  | 'sending_tx'
  | 'confirming'
  | 'success'
  | 'error';

export function useClaimTokens() {
  const qc = useQueryClient();
  const [step, setStep] = useState<ClaimStep>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const claim = async (goldAmount: number) => {
    const pk = getStoredWalletPk();
    if (!pk) {
      setError('No wallet found. Please re-open the app.');
      return;
    }

    setError(null);
    setTxHash(null);

    try {
      setStep('requesting_sig');
      const payload = await api.claimSignature(goldAmount);

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
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Claim failed';
      setError(msg.length > 120 ? msg.slice(0, 120) + '…' : msg);
      setStep('error');
    }
  };

  const reset = () => {
    setStep('idle');
    setError(null);
    setTxHash(null);
  };

  return { claim, step, txHash, error, reset };
}

export async function getWalletBnbBalance(address: `0x${string}`): Promise<bigint> {
  return publicClient.getBalance({ address });
}
