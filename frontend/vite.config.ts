import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3002', changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    // Telegram WebView (modern Chromium/WebKit) supports <link rel="modulepreload"> natively.
    // Disabling the polyfill prevents Vite from injecting it into the web3 chunk, which
    // would otherwise force web3 (287KB) to download before main.tsx can execute.
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Phaser is lazy-loaded (only after user enters farm) — keep separate
          if (id.includes('phaser')) return 'phaser';

          // viem is used only by ClaimModal/SettingsModal/WalletSetupModal (all lazy).
          // Wagmi/reown are dead code (WagmiProvider removed from root).
          // Let Rollup inline them into their lazy chunks — no eager web3 chunk needed.

          if (id.includes('@tanstack')) return 'query';
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/scheduler')
          ) return 'react';
          if (id.includes('node_modules/lucide-react')) return 'lucide';
          // viem chain defs are heavy (61KB gz) — keep them in lazy web3 chunks only
          if (id.includes('viem/chains') || id.includes('node_modules/viem')) return undefined;
        },
      },
    },
  },
});
