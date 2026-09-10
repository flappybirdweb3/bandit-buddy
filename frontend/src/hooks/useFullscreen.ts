import { useState, useEffect, useCallback } from 'react';

type TgWebApp = {
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  isFullscreen?: boolean;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
};

function getTg(): TgWebApp | null {
  return (window as any).Telegram?.WebApp ?? null;
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => getTg()?.isFullscreen ?? false);
  const [supported] = useState(() => {
    const tg = getTg();
    const ok = typeof tg?.requestFullscreen === 'function';
    console.log('[Fullscreen] WebApp:', !!tg, 'requestFullscreen:', typeof tg?.requestFullscreen, 'supported:', ok);
    return ok;
  });

  useEffect(() => {
    const tg = getTg();
    if (!tg?.onEvent) return;

    const onChanged = () => setIsFullscreen(tg.isFullscreen ?? false);
    const onFailed = () => setIsFullscreen(false);

    tg.onEvent('fullscreenChanged', onChanged);
    tg.onEvent('fullscreenFailed', onFailed);
    return () => {
      tg.offEvent?.('fullscreenChanged', onChanged);
      tg.offEvent?.('fullscreenFailed', onFailed);
    };
  }, []);

  const requestFullscreen = useCallback(() => {
    const tg = getTg();
    if (tg?.requestFullscreen) tg.requestFullscreen();
  }, []);

  const exitFullscreen = useCallback(() => {
    const tg = getTg();
    if (tg?.exitFullscreen) tg.exitFullscreen();
  }, []);

  const toggle = useCallback(() => {
    if (isFullscreen) exitFullscreen();
    else requestFullscreen();
  }, [isFullscreen, requestFullscreen, exitFullscreen]);

  return { isFullscreen, supported, requestFullscreen, exitFullscreen, toggle };
}
