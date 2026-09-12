import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { UserProfile } from '@/types/game.types';

const WALLET_PK_KEY = 'bb_wallet_pk';
const WALLET_SETUP_SHOWN_KEY = 'bb_wallet_setup_shown';

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

    const existingPk = localStorage.getItem(WALLET_PK_KEY) as `0x${string}` | null;
    const alreadyShown = localStorage.getItem(WALLET_SETUP_SHOWN_KEY) === '1';

    // Lazy-load viem — keeps it out of the initial bundle
    import('viem/accounts').then(({ generatePrivateKey, privateKeyToAccount }) => {
      // ── Case 1: this device already holds a key ──────────────────────────────
      if (existingPk) {
        const account = privateKeyToAccount(existingPk);
        const matches = !!profile.walletAddress
          && account.address.toLowerCase() === profile.walletAddress.toLowerCase();

        if (!profile.walletAddress) {
          // Account has no wallet at all yet — link the one this device holds.
          api.updateWallet(account.address)
            .then(() => qc.invalidateQueries({ queryKey: ['profile'] }))
            .catch(() => {});
        } else if (!matches) {
          // Account is linked to a DIFFERENT wallet. This device's key cannot sign for it;
          // flag it instead of relinking the account to a wallet that would strand the
          // $FARM the linked wallet already holds.
          setWalletLocked(true);
        }
        return;
      }

      // ── Case 2: no local key, but the account already has a wallet ───────────
      //
      // That wallet was created on another device. Generating a key here would produce a
      // different address and (previously) overwrite the account's wallet — which is why
      // the same Telegram account reported a different wallet address on every machine.
      // The user must import the existing private key instead.
      if (profile.walletAddress) {
        setWalletLocked(true);
        return;
      }

      // ── Case 3: brand-new account with no wallet anywhere — safe to create ───
      const pk = generatePrivateKey();
      localStorage.setItem(WALLET_PK_KEY, pk);
      const account = privateKeyToAccount(pk);

      api.updateWallet(account.address)
        .then(() => {
          qc.invalidateQueries({ queryKey: ['profile'] });
          if (!alreadyShown) setShowSetup(true);
        })
        .catch((err: unknown) => {
          // Lost a race with another device, or the address is taken: drop the unusable
          // local key so the next launch takes Case 1/2 instead of retrying it forever.
          const msg = err instanceof Error ? err.message : '';
          if (/already (has a linked|linked to)/i.test(msg)) {
            localStorage.removeItem(WALLET_PK_KEY);
            setWalletLocked(true);
          }
        });
    });
  }, [profile]);

  const dismissSetup = () => {
    localStorage.setItem(WALLET_SETUP_SHOWN_KEY, '1');
    setShowSetup(false);
  };

  return { showSetup, dismissSetup, walletLocked };
}

export function getStoredWalletPk(): `0x${string}` | null {
  return localStorage.getItem(WALLET_PK_KEY) as `0x${string}` | null;
}
