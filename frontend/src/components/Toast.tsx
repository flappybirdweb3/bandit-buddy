import { useState, useEffect } from 'react';
import { eventBus } from '@/game/EventBus';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let nextId = 0;

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsub = eventBus.on('show-toast', ({ message, type = 'info' }) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    });
    return unsub;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg backdrop-blur-sm',
            'animate-fade-in-up max-w-xs text-center',
            t.type === 'success' ? 'bg-green-500/90 text-white' :
            t.type === 'error'   ? 'bg-red-500/90 text-white' :
                                   'bg-white/20 text-white',
          ].join(' ')}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
