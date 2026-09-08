import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useClaimTokens } from '@/hooks/useClaimTokens';
import { useGame } from '@/providers/GameProvider';

interface Props { onClose: () => void; }

export function ClaimModal({ onClose }: Props) {
  const { profile } = useGame();
  const { address, isConnected } = useAccount();
  const { open: openWallet } = useWeb3Modal();
  const { claim, txHash, isRequesting, walletPending, confirming, confirmed, error } = useClaimTokens();
  const [amount, setAmount] = useState<string>('');

  const maxClaimable = Math.floor(profile?.goldBalance ?? 0);
  const parsedAmount = parseInt(amount, 10) || 0;
  const canClaim = parsedAmount >= 1 && parsedAmount <= maxClaimable && isConnected && !isRequesting;

  return (
    <Modal title="💎 Claim $FARM Token" onClose={onClose} maxWidth={380}>
      <div style={{ paddingBottom: 8 }}>
        {/* Wallet status */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16,
        }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>BSC Wallet</div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
              {isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Not connected'}
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => openWallet()}
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            {isConnected ? 'Switch' : 'Connect'}
          </Button>
        </div>

        {/* Balance */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16,
        }}>
          <StatBox label="GOLD Balance" value={`${maxClaimable}`} icon="🪙" color="#ffd700" />
          <StatBox label="Rate" value="1 G = 1 $FARM" icon="💱" color="#64b5f6" />
        </div>

        {/* Amount input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, display: 'block', marginBottom: 6 }}>
            Amount to claim
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Min 1 GOLD"
              min={1}
              max={maxClaimable}
              style={{
                flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 15,
                outline: 'none',
              }}
            />
            <Button
              variant="ghost"
              onClick={() => setAmount(String(maxClaimable))}
              style={{ padding: '10px 14px', fontSize: 13 }}
            >
              MAX
            </Button>
          </div>
        </div>

        {/* Trust score warning */}
        {profile && profile.trustScore < 30 && (
          <div style={{
            background: 'rgba(255,87,34,0.15)', border: '1px solid rgba(255,87,34,0.4)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#ff8a65',
          }}>
            ⚠️ Your trust score ({profile.trustScore}) is too low. Play more to increase it.
          </div>
        )}

        {/* Confirmed tx */}
        {confirmed && txHash && (
          <div style={{
            background: 'rgba(118,255,3,0.1)', border: '1px solid rgba(118,255,3,0.3)',
            borderRadius: 10, padding: '12px', marginBottom: 14, fontSize: 13, color: '#76ff03',
            textAlign: 'center',
          }}>
            ✅ Claimed successfully!<br />
            <a
              href={`https://testnet.bscscan.com/tx/${txHash}`}
              target="_blank" rel="noreferrer"
              style={{ color: '#64b5f6', fontSize: 11 }}
            >
              View on BSCScan ↗
            </a>
          </div>
        )}

        {/* Claim button */}
        <Button
          fullWidth
          disabled={!canClaim}
          onClick={() => claim(parsedAmount)}
        >
          {!isConnected ? '🔌 Connect Wallet First'
            : isRequesting ? '⏳ Requesting signature...'
            : walletPending ? '📱 Approve in wallet...'
            : confirming ? '⛓ Confirming on BSC...'
            : `💎 Claim ${parsedAmount || 0} $FARM`}
        </Button>

        {error && (
          <p style={{ color: '#ff5722', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
            {error}
          </p>
        )}

        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
          Backend signs the claim. Your GOLD will be deducted immediately.
          $FARM arrives in your wallet after BSC confirmation (~3 sec).
        </p>
      </div>
    </Modal>
  );
}

function StatBox({ label, value, icon, color }: {
  label: string; value: string; icon: string; color: string;
}) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ color, fontWeight: 700, fontSize: 16 }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{label}</div>
    </div>
  );
}
