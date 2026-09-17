import { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * Retries dynamic import if it fails due to network drop or new deployment chunk-hash changes.
 * Especially helpful on mobile WebViews (Telegram TMA).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retries = 2,
  interval = 1000,
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await componentImport();
      } catch (err) {
        lastError = err;
        console.warn(`[lazyWithRetry] Dynamic import failed (attempt ${attempt + 1}/${retries + 1}):`, err);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }
    }

    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    const isChunkError =
      /failed to (fetch|load)|dynamically imported|importing a module script|chunkloaderror|loading chunk|load failed/i.test(msg);

    if (isChunkError && typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      const reloadKey = 'bb_last_chunk_reload';
      const lastReload = Number(sessionStorage.getItem(reloadKey) || '0');
      const now = Date.now();
      if (now - lastReload > 15000) {
        sessionStorage.setItem(reloadKey, String(now));
        console.info('[lazyWithRetry] Stale chunk detected after deployment. Auto-reloading to fetch updated code...');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
    }

    throw lastError;
  });
}

