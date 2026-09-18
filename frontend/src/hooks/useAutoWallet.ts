import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { tgCloudGet } from '@/hooks/telegramCloud';
import WebApp from '@twa-dev/sdk';
import type { UserProfile } from '@/types/game.types';

const WALLET_PK_KEY_LEGACY = 'bb_wallet_pk';
const WALLET_SETUP_SHOWN_KEY = 'bb_wallet_setup_shown';

export function getUserWalletKey(telegramId?: number | string | null): string {
  const tid = telegramId ?? WebApp.initDataUnsafe?.user?.id;
  return tid ? `bb_wallet_pk_${tid}` : WALLET_PK_KEY_LEGACY;
}

export function useAutoWallet(profile: UserProfile | undefined) {
  const [showSetup, setShowSetup] = useState(false);
  // True when the account is already linked to a wallet this device cannot sign for.
  // The UI should offer "import private key" instead of silently minting a second wallet.
  const [walletLocked, setWalletLocked] = useState(false);
  const ran = useRef(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!profile || ran.current) return;
    ran.current = true;

    const userKey = getUserWalletKey(profile.telegramId);
    let existingPk = localStorage.getItem(userKey) as `0x${string}` | null;
    const legacyPk = localStorage.getItem(WALLET_PK_KEY_LEGACY) as `0x${string}` | null;
    const alreadyShown =
      localStorage.getItem(`${WALLET_SETUP_SHOWN_KEY}_${profile.telegramId}`) === '1' ||
      localStorage.getItem(WALLET_SETUP_SHOWN_KEY) === '1';

    // Lazy-load viem — keeps it out of the initial bundle
    import('viem/accounts').then(async ({ generatePrivateKey, privateKeyToAccount }) => {
      // If no scoped key yet, check if legacy pk belongs to this profile
      if (!existingPk && legacyPk) {
        try {
          const legacyAccount = privateKeyToAccount(legacyPk);
          if (
            profile.walletAddress &&
            legacyAccount.address.toLowerCase() === profile.walletAddress.toLowerCase()
          ) {
            existingPk = legacyPk;
            localStorage.setItem(userKey, legacyPk);
          }
        } catch {}
      }

      // ── Case 1: this user already holds a key ──────────────────────────────
      if (existingPk) {
        try {
          const account = privateKeyToAccount(existingPk);
          const matches =
            !!profile.walletAddress &&
            account.address.toLowerCase() === profile.walletAddress.toLowerCase();

          if (!profile.walletAddress) {
            // Account has no wallet at all yet — link the one this device holds.
            api
              .updateWallet(account.address)
              .then(() => qc.invalidateQueries({ queryKey: ['profile'] }))
              .catch(() => {});
          } else if (!matches) {
            // Account is linked to a DIFFERENT wallet. This device's key cannot sign for it;
            // flag it instead of relinking the account to a wallet that would strand funds.
            setWalletLocked(true);
          }
          return;
        } catch {
          // Corrupt existing key, fall through
        }
      }

      // ── Case 2: no local key for this user, but account already has a wallet ───────────
      // Try to restore from Telegram CloudStorage before giving up.
      if (profile.walletAddress) {
        const cloudPk = await tgCloudGet('bb_wk');
        if (cloudPk) {
          try {
            const cloudAccount = privateKeyToAccount(cloudPk as `0x${string}`);
            if (cloudAccount.address.toLowerCase() === profile.walletAddress.toLowerCase()) {
              localStorage.setItem(userKey, cloudPk);
              localStorage.setItem('bb_wallet_pk', cloudPk);
              qc.invalidateQueries({ queryKey: ['profile'] });
              return; // restored — no walletLocked
            }
          } catch {}
        }
        setWalletLocked(true);
        return;
      }

      // ── Case 3: brand-new account with no wallet anywhere — safe to create ───
      const pk = generatePrivateKey();
      localStorage.setItem(userKey, pk);
      localStorage.setItem(WALLET_PK_KEY_LEGACY, pk);
      const account = privateKeyToAccount(pk);

      api
        .updateWallet(account.address)
        .then(() => {
          qc.invalidateQueries({ queryKey: ['profile'] });
          if (!alreadyShown) setShowSetup(true);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : '';
          if (/already (has a linked|linked to)/i.test(msg)) {
            localStorage.removeItem(userKey);
            setWalletLocked(true);
          }
        });
    });
  }, [profile]);

  const dismissSetup = () => {
    if (profile?.telegramId) {
      localStorage.setItem(`${WALLET_SETUP_SHOWN_KEY}_${profile.telegramId}`, '1');
    }
    localStorage.setItem(WALLET_SETUP_SHOWN_KEY, '1');
    setShowSetup(false);
  };

  return { showSetup, dismissSetup, walletLocked };
}

export function getStoredWalletPk(telegramId?: number | string | null): `0x${string}` | null {
  const tid = telegramId ?? WebApp.initDataUnsafe?.user?.id;
  if (tid) {
    const userPk = localStorage.getItem(`bb_wallet_pk_${tid}`);
    if (userPk) return userPk as `0x${string}`;
  }
  return localStorage.getItem(WALLET_PK_KEY_LEGACY) as `0x${string}` | null;
}
