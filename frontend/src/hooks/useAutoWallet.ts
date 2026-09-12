import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { UserProfile } from '@/types/game.types';

const WALLET_PK_KEY = 'bb_wallet_pk';
const WALLET_SETUP_SHOWN_KEY = 'bb_wallet_setup_shown';

export function useAutoWallet(profile: UserProfile | undefined) {
  const [showSetup, setShowSetup] = useState(false);
  const ran = useRef(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!profile || ran.current) return;
    ran.current = true;

    const existingPk = localStorage.getItem(WALLET_PK_KEY) as `0x${string}` | null;
    const alreadyShown = localStorage.getItem(WALLET_SETUP_SHOWN_KEY) === '1';

    // Lazy-load viem — keeps it out of the initial bundle
    import('viem/accounts').then(({ generatePrivateKey, privateKeyToAccount }) => {
      let pk: `0x${string}`;
      let isNew = false;

      if (existingPk) {
        pk = existingPk;
      } else {
        pk = generatePrivateKey();
        localStorage.setItem(WALLET_PK_KEY, pk);
        isNew = true;
      }

      const account = privateKeyToAccount(pk);

      // Always sync: update DB if address is missing or PK doesn't match stored walletAddress
      if (
        !profile.walletAddress ||
        account.address.toLowerCase() !== profile.walletAddress.toLowerCase()
      ) {
        api.updateWallet(account.address)
          .then(() => qc.invalidateQueries({ queryKey: ['profile'] }))
          .catch(() => {});
      }

      if (isNew && !alreadyShown) {
        setShowSetup(true);
      }
    });
  }, [profile]);

  const dismissSetup = () => {
    localStorage.setItem(WALLET_SETUP_SHOWN_KEY, '1');
    setShowSetup(false);
  };

  return { showSetup, dismissSetup };
}

export function getStoredWalletPk(): `0x${string}` | null {
  return localStorage.getItem(WALLET_PK_KEY) as `0x${string}` | null;
}
