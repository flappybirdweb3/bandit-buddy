import { createWeb3Modal } from '@web3modal/wagmi';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { bscTestnet } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const projectId = (import.meta.env as Record<string, string>).VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

export const wagmiConfig = createConfig({
  chains: [bscTestnet],
  transports: { [bscTestnet.id]: http() },
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
createWeb3Modal({ wagmiConfig: wagmiConfig as any, projectId, defaultChain: bscTestnet });

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
