import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import WebApp from '@twa-dev/sdk';
import { Web3AppProvider } from '@/providers/WagmiProvider';
import { GameProvider } from '@/providers/GameProvider';
import { App } from './App';

// Initialize Telegram Mini App
WebApp.ready();
WebApp.expand();
WebApp.setHeaderColor('#0a0a0a');
WebApp.setBackgroundColor('#0a0a0a');

// ── Telegram WebView wallet deep-link patch ──────────────────────────────────
// Telegram's WebView blocks window.open() for custom URL schemes (metamask://,
// trust://, wc://).  Patch it so wallet universal links open via location.href
// (which iOS handles natively) and HTTPS wallet links use Telegram.WebApp.openLink().
if ((window as any).Telegram?.WebApp) {
  const _open = window.open.bind(window);
  window.open = function (url?: string | URL, target?: string, features?: string) {
    if (!url) return _open(url, target, features);
    const href = url.toString();

    // Custom wallet schemes — let iOS handle natively
    if (/^(metamask|trust|rainbow|zerion|imtoken|tokenpocket|wc):\/\//i.test(href)) {
      window.location.href = href;
      return null;
    }

    // HTTPS wallet universal links — open via Telegram API (avoids popup block)
    if (/metamask\.app\.link|trustwallet\.com|link\.trustwallet|walletconnect\.com|walletlink\.org/i.test(href)) {
      (window as any).Telegram.WebApp.openLink(href);
      return null;
    }

    return _open(url, target, features);
  } as typeof window.open;
}
// ────────────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Web3AppProvider>
      <GameProvider>
        <App />
      </GameProvider>
    </Web3AppProvider>
  </React.StrictMode>,
);
