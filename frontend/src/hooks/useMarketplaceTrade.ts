import { useState } from 'react';
import { createWalletClient, createPublicClient, http, parseEther, parseUnits } from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { getStoredWalletPk } from '@/hooks/useAutoWallet';

const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';

const DEFAULT_MARKET_CONTRACT = '0xe2326Fa33b9293488FDCaA3F34Be2745a2f49e11';

const MARKET_CONTRACT_ADDRESS = (
  import.meta.env.VITE_MARKET_CONTRACT_ADDRESS || DEFAULT_MARKET_CONTRACT
) as `0x${string}`;

const NFT_CONTRACT_ADDRESS = (
  import.meta.env.VITE_NFT_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`;

const FARM_TOKEN_ADDRESS = (
  import.meta.env.VITE_FARM_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`;

const MARKET_ABI = [
  {
    name: 'buyNFT',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'order',
        type: 'tuple',
        components: [
          { name: 'seller',      type: 'address' },
          { name: 'nftContract', type: 'address' },
          { name: 'tokenId',     type: 'uint256' },
          { name: 'amount',      type: 'uint256' },
          { name: 'priceFarm',   type: 'uint256' },
          { name: 'nonce',       type: 'uint256' },
          { name: 'deadline',    type: 'uint256' },
        ],
      },
      { name: 'sig', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

const ERC1155_ABI = [
  {
    name: 'isApprovedForAll',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account',  type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'setApprovalForAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
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
      { name: 'owner',   type: 'address' },
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
      { name: 'value',   type: 'uint256' },
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

export type TradeStep =
  | 'idle'
  | 'checking'
  | 'approving_nft'
  | 'signing'
  | 'submitting_listing'
  | 'approving_farm'
  | 'executing_trade'
  | 'confirming'
  | 'success'
  | 'error';

function shortAddr(addr?: string | null) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}

function makeClients(pk: `0x${string}`) {
  const account = privateKeyToAccount(pk);
  const transport = http(BSC_TESTNET_RPC);
  return {
    account,
    walletClient: createWalletClient({ account, chain: bscTestnet, transport }),
    publicClient: createPublicClient({ chain: bscTestnet, transport }),
  };
}

// ── Sell (create listing) ────────────────────────────────────────────────────

export function useCreateListing() {
  const qc = useQueryClient();
  const [step, setStep]     = useState<TradeStep>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError]   = useState<string | null>(null);

  const createListing = async (
    tokenId: number,
    priceFarm: number,
    deadlineDays: number,
    telegramId?: string | number | null,
    expectedWalletAddress?: string | null,
  ) => {
    const pk = getStoredWalletPk(telegramId);
    if (!pk) { setError('No wallet private key found — please check Settings → BSC Wallet'); return; }

    setError(null);
    setTxHash(null);

    try {
      const { account, walletClient, publicClient } = makeClients(pk);
      const seller = account.address;

      if (expectedWalletAddress && seller.toLowerCase() !== expectedWalletAddress.toLowerCase()) {
        setError(`Active wallet (${shortAddr(seller)}) does not match linked account wallet (${shortAddr(expectedWalletAddress)}). Please check Settings.`);
        setStep('error');
        return;
      }

      setStep('checking');

      // 1. Get nonce and target market contract address from backend
      const { nonce, marketContractAddress } = await api.getMarketplaceNonce(NFT_CONTRACT_ADDRESS, tokenId);
      const marketAddress = (marketContractAddress || MARKET_CONTRACT_ADDRESS) as `0x${string}`;

      // 2. Check NFT approval
      const approved = await publicClient.readContract({
        address: NFT_CONTRACT_ADDRESS,
        abi: ERC1155_ABI,
        functionName: 'isApprovedForAll',
        args: [seller, marketAddress],
      });

      if (!approved) {
        setStep('approving_nft');
        const approveTx = await walletClient.writeContract({
          address: NFT_CONTRACT_ADDRESS,
          abi: ERC1155_ABI,
          functionName: 'setApprovalForAll',
          args: [marketAddress, true],
        });
        setTxHash(approveTx);
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      // 3. Calculate deadline timestamp
      setStep('signing');
      const deadlineTs = BigInt(Math.floor(Date.now() / 1000) + deadlineDays * 86_400);
      const priceWei = parseEther(priceFarm.toString());

      // 4. Sign EIP-712 order (Must match BanditMarket v2 & backend NFTOrder specification)
      const sig = await walletClient.signTypedData({
        domain: {
          name:              'BanditMarket',
          version:           '2',
          chainId:           97,
          verifyingContract: marketAddress,
        },
        types: {
          NFTOrder: [
            { name: 'seller',      type: 'address' },
            { name: 'nftContract', type: 'address' },
            { name: 'tokenId',     type: 'uint256' },
            { name: 'amount',      type: 'uint256' },
            { name: 'priceFarm',   type: 'uint256' },
            { name: 'nonce',       type: 'uint256' },
            { name: 'deadline',    type: 'uint256' },
          ],
        },
        primaryType: 'NFTOrder',
        message: {
          seller:      seller,
          nftContract: NFT_CONTRACT_ADDRESS,
          tokenId:     BigInt(tokenId),
          amount:      1n,
          priceFarm:   priceWei,
          nonce:       BigInt(nonce),
          deadline:    deadlineTs,
        },
      });

      // 5. Submit listing to backend
      setStep('submitting_listing');
      const deadline = new Date(Number(deadlineTs) * 1000).toISOString();
      await api.createMarketplaceListing({
        nftContract: NFT_CONTRACT_ADDRESS,
        tokenId,
        amount: 1,
        priceFarm,
        deadline,
        eip712Sig: sig,
      });

      setStep('success');
      qc.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      qc.invalidateQueries({ queryKey: ['nft-marketplace-listings'] });
      qc.invalidateQueries({ queryKey: ['marketplace-listings'] });
      qc.invalidateQueries({ queryKey: ['nftStatus'] });
      qc.invalidateQueries({ queryKey: ['barnData'] });
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['dailyQuests'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Listing failed';
      setError(msg.length > 150 ? msg.slice(0, 150) + '…' : msg);
      setStep('error');
    }
  };

  const reset = () => { setStep('idle'); setError(null); setTxHash(null); };
  return { createListing, step, txHash, error, reset };
}

// ── Buy (execute on-chain after backend match) ───────────────────────────────

type OrderPayload = {
  seller: string; nftContract: string; tokenId: number; amount: number;
  priceFarm: string; nonce: number; deadline: number; signature: string;
};

export function useBuyListing() {
  const qc = useQueryClient();
  const [step, setStep]     = useState<TradeStep>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError]   = useState<string | null>(null);

  const buy = async (listingId: string, telegramId?: string | number | null) => {
    const pk = getStoredWalletPk(telegramId);
    if (!pk) { setError('No wallet found — re-open the app'); return; }

    setError(null);
    setTxHash(null);

    try {
      const { account, walletClient, publicClient } = makeClients(pk);
      const buyer = account.address;

      // 1. Match order on backend (marks listing filled, returns order for on-chain execution)
      setStep('checking');
      const buyRes = await api.buyMarketplaceListing(listingId) as {
        order: OrderPayload;
        contractAddress?: string;
        message: string;
      };
      const { order } = buyRes;
      const marketAddress = (buyRes.contractAddress || MARKET_CONTRACT_ADDRESS) as `0x${string}`;

      const priceWei = BigInt(order.priceFarm);

      // 2. Check $FARM allowance
      const allowance = await publicClient.readContract({
        address: FARM_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [buyer, marketAddress],
      }) as bigint;

      if (allowance < priceWei) {
        setStep('approving_farm');
        const approveTx = await walletClient.writeContract({
          address: FARM_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [marketAddress, priceWei],
        });
        setTxHash(approveTx);
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      // 3. Execute trade on-chain (buyNFT on BanditMarket v2)
      setStep('executing_trade');
      const tradeTx = await walletClient.writeContract({
        address: marketAddress,
        abi: MARKET_ABI,
        functionName: 'buyNFT',
        args: [
          {
            seller:      order.seller as `0x${string}`,
            nftContract: order.nftContract as `0x${string}`,
            tokenId:     BigInt(order.tokenId),
            amount:      BigInt(order.amount),
            priceFarm:   priceWei,
            nonce:       BigInt(order.nonce),
            deadline:    BigInt(order.deadline),
          },
          order.signature as `0x${string}`,
        ],
      });

      setTxHash(tradeTx);
      setStep('confirming');
      await publicClient.waitForTransactionReceipt({ hash: tradeTx });

      setStep('success');
      qc.invalidateQueries({ queryKey: ['nft-marketplace-listings'] });
      qc.invalidateQueries({ queryKey: ['marketplace-listings'] });
      qc.invalidateQueries({ queryKey: ['my-marketplace-listings'] });
      qc.invalidateQueries({ queryKey: ['nftStatus'] });
      qc.invalidateQueries({ queryKey: ['barnData'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['myFarm'] });
      qc.invalidateQueries({ queryKey: ['dailyQuests'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Buy failed';
      setError(msg.length > 150 ? msg.slice(0, 150) + '…' : msg);
      setStep('error');
    }
  };

  const reset = () => { setStep('idle'); setError(null); setTxHash(null); };
  return { buy, step, txHash, error, reset };
}

// Helper: human-readable step labels
export function stepLabel(step: TradeStep): string {
  switch (step) {
    case 'checking':          return 'Checking wallet…';
    case 'approving_nft':     return 'Approving NFT transfer…';
    case 'signing':           return 'Waiting for signature…';
    case 'submitting_listing': return 'Submitting listing…';
    case 'approving_farm':    return 'Approving $FARM spend…';
    case 'executing_trade':   return 'Executing trade…';
    case 'confirming':        return 'Confirming on BSC…';
    case 'success':           return 'Done!';
    default:                  return '';
  }
}
