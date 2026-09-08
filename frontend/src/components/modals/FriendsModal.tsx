import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { FarmData } from '@/types/game.types';
import WebApp from '@twa-dev/sdk';

interface Props {
  onClose: () => void;
}

// Telegram provides friends who have also opened our bot
const getMockFriends = () => [
  { id: 'u1', username: 'alice_farmer', hasRipeCrops: true },
  { id: 'u2', username: 'bob_thief', hasRipeCrops: false },
  { id: 'u3', username: 'charlie_grower', hasRipeCrops: true },
];

export function FriendsModal({ onClose }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUsername, setSelectedUsername] = useState<string>('');

  const { data: friendFarm, isLoading: loadingFarm } = useQuery({
    queryKey: ['friendFarm', selectedUserId],
    queryFn: () => api.getFarm(selectedUserId!),
    enabled: !!selectedUserId,
  });

  const handleVisit = (userId: string, username: string) => {
    eventBus.emit('visit-farm', { userId, username });
    onClose();
  };

  const friends = getMockFriends();

  return (
    <Modal title="👥 Friends' Farms" onClose={onClose} maxWidth={400}>
      {!selectedUserId ? (
        <FriendsList
          friends={friends}
          onPreview={(id, name) => { setSelectedUserId(id); setSelectedUsername(name); }}
          onVisit={handleVisit}
        />
      ) : (
        <FarmPreview
          userId={selectedUserId}
          username={selectedUsername}
          farm={friendFarm}
          loading={loadingFarm}
          onVisit={() => handleVisit(selectedUserId, selectedUsername)}
          onBack={() => setSelectedUserId(null)}
        />
      )}
    </Modal>
  );
}

function FriendsList({ friends, onPreview, onVisit }: {
  friends: { id: string; username: string; hasRipeCrops: boolean }[];
  onPreview: (id: string, name: string) => void;
  onVisit: (id: string, name: string) => void;
}) {
  return (
    <div>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 12 }}>
        Friends playing Barn Buddy
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {friends.map((f) => (
          <div
            key={f.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(255,255,255,0.07)', borderRadius: 12,
              padding: '10px 14px',
              border: f.hasRipeCrops ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #43a047, #1b5e20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              👤
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>@{f.username}</div>
              {f.hasRipeCrops && (
                <div style={{ color: '#ffd700', fontSize: 11, marginTop: 2 }}>
                  🌾 Has ripe crops!
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button
                variant="ghost"
                onClick={() => onPreview(f.id, f.username)}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                👁 Preview
              </Button>
              <Button
                variant={f.hasRipeCrops ? 'danger' : 'primary'}
                onClick={() => onVisit(f.id, f.username)}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                {f.hasRipeCrops ? '🥷 Steal' : '🚪 Visit'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => WebApp.openTelegramLink(`https://t.me/barnbuddybot?startgroup=1`)}
        style={{
          width: '100%', marginTop: 14, background: 'rgba(255,255,255,0.05)',
          border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 12,
          color: 'rgba(255,255,255,0.5)', padding: '10px', cursor: 'pointer', fontSize: 13,
        }}
      >
        + Invite more friends
      </button>
    </div>
  );
}

function FarmPreview({ userId, username, farm, loading, onVisit, onBack }: {
  userId: string; username: string; farm?: FarmData;
  loading: boolean; onVisit: () => void; onBack: () => void;
}) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.5)' }}>
        Loading {username}'s farm...
      </div>
    );
  }

  const ripePlots = farm?.plots.filter((p) => !p.isEmpty && p.isRipe && p.stealableRemaining > 0) ?? [];

  return (
    <div>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginBottom: 12 }}
      >
        ← Back to friends
      </button>
      <h4 style={{ color: '#fff', marginBottom: 12 }}>🏡 @{username}'s Farm</h4>

      {ripePlots.length > 0 ? (
        <div style={{
          background: 'rgba(255,87,34,0.1)', border: '1px solid rgba(255,87,34,0.3)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#ff8a65',
        }}>
          🌾 {ripePlots.length} ripe crop{ripePlots.length > 1 ? 's' : ''} ready to steal!
          ({ripePlots.reduce((s, p) => s + p.stealableRemaining, 0).toFixed(1)} G max)
        </div>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 14 }}>
          No stealable crops right now.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {(farm?.plots ?? []).map((p) => (
          <div
            key={p.id}
            style={{
              background: p.isEmpty ? 'rgba(139,94,60,0.4)' :
                p.isRipe ? 'rgba(255,193,7,0.2)' : 'rgba(76,175,80,0.2)',
              border: p.isRipe && !p.isEmpty ? '1px solid rgba(255,193,7,0.5)' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '8px', textAlign: 'center', fontSize: 12,
            }}
          >
            <div style={{ fontSize: 20 }}>
              {p.isEmpty ? '🟫' : p.isRipe ? '✨🌾' : '🌱'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              {p.isEmpty ? 'Empty' : p.seed?.name}
            </div>
            {!p.isEmpty && p.isRipe && (
              <div style={{ color: '#76ff03', fontSize: 10 }}>Ripe!</div>
            )}
          </div>
        ))}
      </div>

      <Button fullWidth variant={ripePlots.length > 0 ? 'danger' : 'primary'} onClick={onVisit}>
        {ripePlots.length > 0 ? '🥷 Enter & Steal' : '🚪 Visit Farm'}
      </Button>
    </div>
  );
}
