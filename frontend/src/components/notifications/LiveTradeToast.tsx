import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useGame } from '@/providers/GameProvider';
import { soundManager } from '@/sounds/SoundManager';
import WebApp from '@twa-dev/sdk';
import { Coins, Sparkles, X } from 'lucide-react';

interface TradeToastData {
  itemTitle: string;
  price: string;
  timestamp: number;
}

export function LiveTradeToast() {
  const { profile } = useGame();
  const queryClient = useQueryClient();
  const [activeTrade, setActiveTrade] = useState<TradeToastData | null>(null);

  const dismiss = useCallback(() => {
    setActiveTrade(null);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;

    // Connect to WebSocket gateway namespace /ws/events
    const socket: Socket = io('/ws/events', {
      query: { userId: profile.id },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socket.disconnected) {
        socket.connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    socket.on('connect', () => {
      socket.emit('subscribe_user', { userId: profile.id });
    });

    socket.on('trade_filled', (payload: { itemType: string; quantity: number; price?: string; priceFormatted?: string }) => {
      // Audio chime
      soundManager.play('coin');

      // Tactile haptic feedback
      try {
        if (WebApp.HapticFeedback?.notificationOccurred) {
          WebApp.HapticFeedback.notificationOccurred('success');
        }
      } catch {}

      const itemFormatted = (payload.itemType || 'Item')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      const qty = payload.quantity > 1 ? `${payload.quantity.toLocaleString()} ` : '';
      const price = payload.priceFormatted || (payload.price ? `${payload.price} FARM` : 'FARM');

      setActiveTrade({
        itemTitle: `${qty}${itemFormatted}`,
        price,
        timestamp: Date.now(),
      });

      // Synchronize game state
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socket.disconnect();
    };
  }, [profile?.id, queryClient]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!activeTrade) return;
    const timer = setTimeout(() => {
      setActiveTrade(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeTrade]);

  if (!activeTrade) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[250] w-[94vw] max-w-sm pointer-events-auto cursor-pointer animate-fade-in-down"
      style={{ top: 'calc(max(10px, var(--tg-safe-area-inset-top, env(safe-area-inset-top, 10px))) + 54px)' }}
      onClick={dismiss}
    >
      <div className="relative glass rounded-2xl p-3.5 border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/30 via-yellow-500/25 to-amber-900/40 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -left-6 -top-6 w-20 h-20 rounded-full bg-amber-400/20 blur-xl pointer-events-none" />

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-300/50 flex-shrink-0">
            <Coins size={22} className="animate-bounce" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-300 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={11} className="text-yellow-300" />
                Cha-ching! Item Sold!
              </span>
            </div>
            <p className="text-white text-xs font-bold leading-tight truncate mt-0.5">
              {activeTrade.itemTitle}
            </p>
            <p className="text-amber-200 text-[11px] font-mono font-black mt-0.5">
              +{activeTrade.price}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 active:scale-90 transition-all flex-shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
