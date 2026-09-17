import { createWeb3Modal } from '@web3modal/wagmi/react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { bscTestnet } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const projectId = (import.meta.env as Record<string, string>).VITE_WALLETCONNECT_PROJECT_ID ?? '';
const hasValidProjectId = projectId.length >= 32;

// In Telegram WebView, window.ethereum is never injected — injected() is useless
const isInTelegram = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initData;

const WC_METADATA = {
  name: 'Bandit Buddy',
  description: 'Web3 Farming Game on BSC — plant, steal & earn $FARM',
  url: 'https://dapp.banditbuddy.xyz',
  icons: ['https://dapp.banditbuddy.xyz/favicon.ico'],
};

export const wagmiConfig = createConfig({
  chains: [bscTestnet],
  transports: { [bscTestnet.id]: http() },
  connectors: hasValidProjectId
    ? [
        // Skip injected inside Telegram — no window.ethereum available
        ...(!isInTelegram ? [injected()] : []),
        walletConnect({ projectId, metadata: WC_METADATA, showQrModal: false }),
      ]
    : [injected()],
});

export let web3ModalReady = false;

try {
  createWeb3Modal({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wagmiConfig: wagmiConfig as any,
    projectId: projectId || '00000000000000000000000000000000',
    defaultChain: bscTestnet,
    enableAnalytics: false,
    enableOnramp: false,
    // Force MetaMask + Trust Wallet to show on main picker screen (not buried in All Wallets)
    featuredWalletIds: [
      'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
      '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
    ],
    includeWalletIds: [
      'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
      '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
      '8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4', // Binance Web3 Wallet
    ],
  });
  web3ModalReady = true;
} catch {
  console.warn('[Web3] createWeb3Modal init failed');
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
});

export function Web3AppProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
