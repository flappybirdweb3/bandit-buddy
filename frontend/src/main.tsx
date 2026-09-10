import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import WebApp from '@twa-dev/sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameProvider } from '@/providers/GameProvider';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
});

// Initialize Telegram Mini App
WebApp.ready();
WebApp.expand();
WebApp.setHeaderColor('#0a0a0a');
WebApp.setBackgroundColor('#0a0a0a');

// Sync Telegram viewport height → CSS variable so #root always fills it
function syncViewportHeight() {
  const h = WebApp.viewportHeight || window.innerHeight;
  const sh = WebApp.viewportStableHeight || h;
  document.documentElement.style.setProperty('--tg-viewport-height', `${h}px`);
  document.documentElement.style.setProperty('--tg-viewport-stable-height', `${sh}px`);
}
syncViewportHeight();
WebApp.onEvent('viewportChanged', syncViewportHeight);

// Sync Telegram safe area → CSS variable so HUD clears the Telegram header bar
function syncSafeArea() {
  const tg = WebApp as any;
  // contentSafeAreaInset.top (Telegram 10+) already includes header bar
  const contentTop: unknown = tg.contentSafeAreaInset?.top;
  // safeAreaInset.top (Telegram 8+) is device-only (notch/status bar)
  const safeTop: unknown = tg.safeAreaInset?.top;

  let topPx: number;
  if (typeof contentTop === 'number' && contentTop > 0) {
    topPx = contentTop;
  } else if (typeof safeTop === 'number' && safeTop >= 0) {
    topPx = safeTop + 50; // add ~50px Telegram header bar
  } else {
    topPx = 90; // safe fallback: status bar + Telegram header on most iPhones
  }
  document.documentElement.style.setProperty('--tg-safe-area-inset-top', `${topPx}px`);
}
syncSafeArea();
WebApp.onEvent('safeAreaChanged' as Parameters<typeof WebApp.onEvent>[0], syncSafeArea);
WebApp.onEvent('contentSafeAreaChanged' as Parameters<typeof WebApp.onEvent>[0], syncSafeArea);

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

// Hide pre-React splash screen once JS is ready to render
const splash = document.getElementById('bb-splash');
if (splash) {
  splash.classList.add('hidden');
  setTimeout(() => splash.remove(), 350);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <GameProvider>
        <App />
      </GameProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
