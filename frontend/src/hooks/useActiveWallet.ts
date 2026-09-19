import { useMemo } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import type { UserProfile } from '@/types/game.types';
import WebApp from '@twa-dev/sdk';

export interface ActiveWallet {
  address: `0x${string}` | null;
  account: ReturnType<typeof privateKeyToAccount> | null;
  canSign: boolean;
  walletLocked: boolean;
  hasWallet: boolean;
}

/**
 * Returns a single canonical wallet for all on-chain game features.
 *
 * Scans ALL candidate localStorage keys (`bb_wallet_pk_<tid>` and `bb_wallet_pk`)
 * to find a pk whose derived address matches profile.walletAddress.
 * This handles the multi-device / key-migration edge case where the user-specific
 * key may hold a stale pk while the legacy key holds the correct one.
 *
 * Resolution rules:
 *  1. No profile wallet → everything null/false.
 *  2. Any stored pk derives the profile address → canSign = true.
 *  3. No matching pk found → walletLocked = true (can read, cannot sign).
 */
export function useActiveWallet(profile: UserProfile | undefined | null): ActiveWallet {
  return useMemo<ActiveWallet>(() => {
    const profileAddr = profile?.walletAddress as `0x${string}` | undefined;

    if (!profileAddr) {
      return { address: null, account: null, canSign: false, walletLocked: false, hasWallet: false };
    }

    // Build ordered list of storage keys to probe. The user-specific key is tried
    // first (preferred when correct), then the legacy fallback.
    const tid = profile?.telegramId ?? (WebApp as any)?.initDataUnsafe?.user?.id;
    const candidateKeys: string[] = [];
    if (tid) candidateKeys.push(`bb_wallet_pk_${tid}`);
    candidateKeys.push('bb_wallet_pk');

    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const pk = (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
      try {
        const derived = privateKeyToAccount(pk);
        if (derived.address.toLowerCase() === profileAddr.toLowerCase()) {
          return { address: profileAddr, account: derived, canSign: true, walletLocked: false, hasWallet: true };
        }
      } catch {}
    }

    return { address: profileAddr, account: null, canSign: false, walletLocked: true, hasWallet: true };
  }, [profile?.walletAddress, profile?.telegramId]);
}
