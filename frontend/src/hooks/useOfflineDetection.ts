import { useEffect, useState } from 'react';
import { eventBus } from '@/game/EventBus';

export function useOfflineDetection() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      eventBus.emit('show-toast', { message: '📡 No connection — changes may not save', type: 'error' });
    };
    const goOnline = () => {
      setIsOffline(false);
      eventBus.emit('show-toast', { message: '✅ Back online', type: 'success' });
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  return isOffline;
}
