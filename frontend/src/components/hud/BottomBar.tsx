import { useState } from 'react';
import { ClaimModal } from '@/components/modals/ClaimModal';
import { useGame } from '@/providers/GameProvider';

interface BottomBarProps {
  onShowFriends: () => void;
}

export function BottomBar({ onShowFriends }: BottomBarProps) {
  const [showClaim, setShowClaim] = useState(false);
  const { profile } = useGame();

  return (
    <>
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
        padding: '16px 16px max(16px, env(safe-area-inset-bottom))',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        gap: 8,
      }}>
        <NavBtn icon="👥" label="Friends" onClick={onShowFriends} />
        <NavBtn
          icon="💎"
          label={`Claim $FARM`}
          onClick={() => setShowClaim(true)}
          highlight={!!profile && profile.goldBalance >= 100}
        />
        <NavBtn icon="🏆" label="Leaderboard" onClick={() => {}} />
        <NavBtn icon="🛒" label="Shop" onClick={() => {}} />
      </div>

      {showClaim && <ClaimModal onClose={() => setShowClaim(false)} />}
    </>
  );
}

function NavBtn({
  icon, label, onClick, highlight,
}: {
  icon: string; label: string; onClick: () => void; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: highlight
          ? 'linear-gradient(135deg, #ffd700, #ff8f00)'
          : 'rgba(0,0,0,0.5)',
        border: highlight
          ? '1px solid rgba(255,215,0,0.5)'
          : '1px solid rgba(255,255,255,0.15)',
        borderRadius: 14,
        padding: '8px 14px',
        color: highlight ? '#1a1a1a' : '#fff',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        minWidth: 60, fontSize: 10, fontWeight: 600,
        transition: 'transform 0.1s',
      }}
      onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)'; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
