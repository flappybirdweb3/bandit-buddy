import { useState } from 'react';
import { MousePointer2, Shovel, Sprout, Droplets, Bug, Hand, Users, Trophy, Gem } from 'lucide-react';
import { ClaimModal } from '@/components/modals/ClaimModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useGame } from '@/providers/GameProvider';
import { eventBus } from '@/game/EventBus';

export type ToolId = 'cursor' | 'dig' | 'seed' | 'water' | 'spray' | 'steal';

const TOOLS: { id: ToolId; icon: React.ReactNode; label: string; steal?: boolean }[] = [
  { id: 'cursor', icon: <MousePointer2 size={20} />, label: 'Select' },
  { id: 'dig',    icon: <Shovel size={20} />,        label: 'Dig' },
  { id: 'seed',   icon: <Sprout size={20} />,        label: 'Plant' },
  { id: 'water',  icon: <Droplets size={20} />,      label: 'Water' },
  { id: 'spray',  icon: <Bug size={20} />,           label: 'Spray' },
  { id: 'steal',  icon: <Hand size={20} />,          label: 'Steal', steal: true },
];

interface Props {
  onShowFriends: () => void;
}

export function BottomBar({ onShowFriends }: Props) {
  const [activeTool, setActiveTool] = useState<ToolId>('cursor');
  const [showClaim, setShowClaim] = useState(false);
  const { profile } = useGame();

  const handleTool = (id: ToolId) => {
    setActiveTool(id);
    eventBus.emit('tool-changed', id);
  };

  const claimReady = !!profile && profile.goldBalance >= 100;

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {/* ── Tool dock ── */}
        <div className="flex justify-center mb-2 px-4">
          <div className="glass rounded-full px-3 py-2 flex items-center gap-1 pointer-events-auto">
            {TOOLS.map((tool) => {
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => handleTool(tool.id)}
                  title={tool.label}
                  className={[
                    'relative flex flex-col items-center justify-center w-11 h-11 rounded-full transition-all active:scale-90',
                    tool.steal
                      ? isActive
                        ? 'bg-red-500 text-white tool-steal-glow scale-110'
                        : 'text-red-400 hover:bg-red-500/20'
                      : isActive
                        ? 'bg-white/20 text-white scale-110'
                        : 'text-white/60 hover:text-white hover:bg-white/10',
                  ].join(' ')}
                >
                  {tool.icon}
                  {tool.steal && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Nav bar ── */}
        <div className="flex items-center gap-2 px-3 pointer-events-auto">
          {/* Friends */}
          <NavBtn
            icon={<Users size={18} />}
            label="Friends"
            onClick={onShowFriends}
          />

          {/* Claim $FARM — centre, bigger */}
          <button
            onClick={() => setShowClaim(true)}
            className={[
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95',
              claimReady
                ? 'glass-purple text-violet-200 pulse-gold'
                : 'glass text-white/50',
            ].join(' ')}
          >
            <Gem size={16} />
            <span>Claim $FARM</span>
            {claimReady && (
              <span className="bg-violet-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {profile!.goldBalance.toFixed(0)}G
              </span>
            )}
          </button>

          {/* Leaderboard */}
          <NavBtn
            icon={<Trophy size={18} />}
            label="Ranks"
            onClick={() => {}}
          />
        </div>
      </div>

      {showClaim && (
        <ErrorBoundary>
          <ClaimModal onClose={() => setShowClaim(false)} />
        </ErrorBoundary>
      )}
    </>
  );
}

function NavBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass flex flex-col items-center justify-center gap-0.5 w-16 py-2.5 rounded-2xl text-white/70 hover:text-white active:scale-95 transition-all pointer-events-auto"
    >
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}
