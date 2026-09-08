import { useGame } from '@/providers/GameProvider';

export function HUD() {
  const { profile } = useGame();
  if (!profile) return null;

  const energyPct = Math.round((profile.energy / 100) * 100);
  const energyColor = energyPct > 50 ? '#76ff03' : energyPct > 20 ? '#ffea00' : '#ff5722';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 50, pointerEvents: 'none',
      padding: '8px 12px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* Gold */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(0,0,0,0.45)', borderRadius: 20,
        padding: '5px 12px', border: '1px solid rgba(255,215,0,0.3)',
      }}>
        <span style={{ fontSize: 18 }}>🪙</span>
        <span style={{ color: '#ffd700', fontWeight: 700, fontSize: 15 }}>
          {profile.goldBalance.toFixed(0)}
        </span>
      </div>

      {/* Energy */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(0,0,0,0.45)', borderRadius: 20,
        padding: '5px 12px', border: '1px solid rgba(118,255,3,0.3)',
        flex: 1, maxWidth: 140,
      }}>
        <span style={{ fontSize: 16 }}>⚡</span>
        <div style={{ flex: 1 }}>
          <div style={{
            height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${energyPct}%`,
              background: energyColor, borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ color: energyColor, fontSize: 11, fontWeight: 600 }}>
            {profile.energy}/100
          </span>
        </div>
      </div>

      {/* Username */}
      <div style={{
        marginLeft: 'auto', color: 'rgba(255,255,255,0.7)', fontSize: 12,
        background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: 12,
      }}>
        {profile.username || 'Farmer'}
      </div>
    </div>
  );
}
