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
// iOS Telegram WebView blocks ALL custom URL schemes (metamask://, trust://, wc://).
// Solution: convert custom schemes → HTTPS Universal Links, then open via
// Telegram.WebApp.openLink() which uses Safari — and Safari DOES redirect to the
// wallet app via iOS Universal Links.
//
// Scheme → Universal Link mapping (official app-links from each wallet):
//   metamask://   → https://metamask.app.link/
//   trust://      → https://link.trustwallet.com/
//   rainbow://    → https://rnbwapp.com/
//   zerion://     → https://app.zerion.io/
//   imtoken://    → https://token.im/
//   tokenpocket:// → https://tokenpocket.pro/
if ((window as any).Telegram?.WebApp) {
  const tgOpenLink = (url: string) => (window as any).Telegram.WebApp.openLink(url);

  const SCHEME_TO_UNIVERSAL: Record<string, string> = {
    'metamask':    'https://metamask.app.link/',
    'trust':       'https://link.trustwallet.com/',
    'rainbow':     'https://rnbwapp.com/',
    'zerion':      'https://app.zerion.io/',
    'imtoken':     'https://token.im/',
    'tokenpocket': 'https://tokenpocket.pro/',
  };

  function toUniversalLink(href: string): string | null {
    const m = href.match(/^([a-z]+):\/\//i);
    if (!m) return null;
    const base = SCHEME_TO_UNIVERSAL[m[1].toLowerCase()];
    return base ? href.replace(`${m[1]}://`, base) : null;
  }

  const _open = window.open.bind(window);
  window.open = function (url?: string | URL, target?: string, features?: string) {
    if (!url) return _open(url, target, features);
    const href = url.toString();

    // 1. Custom wallet scheme → convert to Universal Link, open in Safari
    const universal = toUniversalLink(href);
    if (universal) {
      tgOpenLink(universal);
      return null;
    }

    // 2. HTTPS wallet universal link already — open via Telegram (Safari)
    if (/metamask\.app\.link|link\.trustwallet|rnbwapp\.com|zerion\.io|walletconnect\.com/i.test(href)) {
      tgOpenLink(href);
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
