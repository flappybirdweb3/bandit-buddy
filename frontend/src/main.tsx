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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Web3AppProvider>
      <GameProvider>
        <App />
      </GameProvider>
    </Web3AppProvider>
  </React.StrictMode>,
);
