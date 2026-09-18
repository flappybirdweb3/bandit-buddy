import WebApp from '@twa-dev/sdk';

function getTgCloud(): { setItem: Function; getItem: Function } | null {
  const cs = (WebApp as any)?.CloudStorage;
  return cs && typeof cs.setItem === 'function' && typeof cs.getItem === 'function' ? cs : null;
}

export function tgCloudAvailable(): boolean {
  return getTgCloud() !== null;
}

export function tgCloudSet(key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cs = getTgCloud();
    if (!cs) {
      reject(new Error('Telegram CloudStorage is not available on this version of Telegram. Please update the app.'));
      return;
    }
    try {
      cs.setItem(key, value, (err: string | null, stored: boolean) => {
        if (err || !stored) reject(new Error(err || 'CloudStorage.setItem failed'));
        else resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

export function tgCloudGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const cs = getTgCloud();
    if (!cs) { resolve(null); return; }
    try {
      cs.getItem(key, (err: string | null, value: string) => {
        resolve(err || !value ? null : value);
      });
    } catch {
      resolve(null);
    }
  });
}
