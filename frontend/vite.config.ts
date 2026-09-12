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
      // Target must match the backend's listening port: backend/src/main.ts binds
      // `process.env.PORT || 3003`, and run_load_test.sh probes :3003. This pointed at
      // :3002, so `npm run dev` proxied every /api call to a port nothing listens on
      // (ECONNREFUSED → "Failed to fetch") while the backend was running fine on 3003.
      // A deployed build never notices, because a reverse proxy owns that mapping there.
      //
      // Env-overridable so a container that genuinely publishes a different port
      // (e.g. `-p 3002:3003`) stays reachable without editing this file.
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3003',
        changeOrigin: true,
      },
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
