import { useState } from 'react';
import { X, Wheat, UserPlus, ArrowLeft, Hand, DoorOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { FarmData } from '@/types/game.types';

interface Props { onClose: () => void }

const MOCK_FRIENDS = [
  { id: 'u1', username: 'alice_farmer', hasRipeCrops: true },
  { id: 'u2', username: 'bob_thief', hasRipeCrops: false },
  { id: 'u3', username: 'charlie_grower', hasRipeCrops: true },
];

const SEED_EMOJI: Record<string, string> = {
  wheat: '🌾', carrot: '🥕', corn: '🌽', tomato: '🍅', pumpkin: '🎃',
};

export function FriendsModal({ onClose }: Props) {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  const { data: farm, isLoading } = useQuery({
    queryKey: ['friendFarm', selected?.id],
    queryFn: () => api.getFarm(selected!.id),
    enabled: !!selected,
  });

  const handleVisit = (userId: string, username: string) => {
    eventBus.emit('visit-farm', { userId, username });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {selected && (
              <button onClick={() => setSelected(null)} className="glass rounded-full p-1.5 text-white/60 hover:text-white active:scale-90 mr-1">
                <ArrowLeft size={15} />
              </button>
            )}
            <div>
              <h2 className="text-white font-black text-base leading-none">
                {selected ? `@${selected.name}'s Farm` : "Friends' Farms"}
              </h2>
              <p className="text-white/40 text-xs">
                {selected ? 'Preview & raid' : 'Bandit Buddy network'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {!selected ? (
          /* Friends list */
          <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
            {MOCK_FRIENDS.map((f) => (
              <div
                key={f.id}
                className={`glass rounded-2xl flex items-center gap-3 p-3 ${f.hasRipeCrops ? 'border-amber-400/30' : ''}`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {f.username[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm">@{f.username}</div>
                  {f.hasRipeCrops
                    ? <div className="text-amber-400 text-[10px] flex items-center gap-1 mt-0.5"><Wheat size={9} /> Ripe crops!</div>
                    : <div className="text-white/30 text-[10px] mt-0.5">Nothing to steal</div>}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelected({ id: f.id, name: f.username })}
                    className="glass text-white/60 text-xs font-semibold px-2.5 py-1.5 rounded-xl active:scale-90 transition-all"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleVisit(f.id, f.username)}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-xl active:scale-90 transition-all ${f.hasRipeCrops ? 'glass-red text-red-300' : 'glass-green text-green-300'}`}
                  >
                    {f.hasRipeCrops ? '🥷 Steal' : '🚪 Visit'}
                  </button>
                </div>
              </div>
            ))}

            {/* Invite */}
            <button className="glass rounded-2xl flex items-center justify-center gap-2 p-3 text-white/40 hover:text-white/60 active:scale-95 transition-all border-dashed">
              <UserPlus size={16} />
              <span className="text-sm font-semibold">Invite Friends</span>
            </button>
          </div>
        ) : (
          /* Farm preview */
          <FarmPreview
            farm={farm}
            loading={isLoading}
            username={selected.name}
            onVisit={() => handleVisit(selected.id, selected.name)}
          />
        )}
      </div>
    </div>
  );
}

function FarmPreview({ farm, loading, username, onVisit }: {
  farm?: FarmData; loading: boolean; username: string; onVisit: () => void;
}) {
  if (loading) {
    return (
      <div className="text-center py-10 text-white/40 text-sm">Loading {username}'s farm…</div>
    );
  }

  const ripePlots = farm?.plots.filter((p) => !p.isEmpty && p.isRipe && p.stealableRemaining > 0) ?? [];
  const totalStealable = ripePlots.reduce((s, p) => s + p.stealableRemaining, 0);

  return (
    <div>
      {ripePlots.length > 0 ? (
        <div className="glass-red rounded-2xl p-3 mb-4 flex items-center gap-2">
          <Hand size={16} className="text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">
            <strong>{ripePlots.length} ripe plot{ripePlots.length > 1 ? 's' : ''}</strong> — up to <strong>{totalStealable.toFixed(1)}G</strong> stealable
          </span>
        </div>
      ) : (
        <div className="glass rounded-2xl p-3 mb-4 text-white/40 text-sm text-center">
          No crops to steal right now.
        </div>
      )}

      {/* Plot grid */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {(farm?.plots ?? Array(6).fill(null)).map((p, i) => (
          <div
            key={p?.id ?? i}
            className={`rounded-xl p-2.5 text-center ${
              !p || p.isEmpty ? 'bg-amber-900/30' :
              p.isRipe ? 'bg-amber-400/15 border border-amber-400/40' :
              'bg-green-900/30'
            }`}
          >
            <div className="text-2xl mb-1">
              {!p || p.isEmpty ? '🟫' : p.isRipe ? SEED_EMOJI[p.seed?.iconKey ?? ''] ?? '✨' : '🌱'}
            </div>
            <div className="text-white/50 text-[10px]">
              {!p || p.isEmpty ? 'Empty' : p.seed?.name}
            </div>
            {p && !p.isEmpty && p.isRipe && (
              <div className="text-amber-400 text-[9px] font-bold">RIPE</div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onVisit}
        className={`w-full py-4 rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2 ${
          ripePlots.length > 0
            ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white tool-steal-glow'
            : 'glass text-white'
        }`}
      >
        {ripePlots.length > 0
          ? <><Hand size={16} /> Enter & Steal</>
          : <><DoorOpen size={16} /> Visit Farm</>}
      </button>
    </div>
  );
}
