import { useState, useEffect } from 'react';
import { X, CheckCircle2, Coins, Zap, Loader2, Swords, Wheat, Sprout, Trophy } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { DailyQuest, QuestType } from '@/types/game.types';

interface Props { onClose: () => void }

// ── Quest type metadata ───────────────────────────────────────────
const QUEST_META: Record<QuestType, { emoji: string; color: string; bg: string; border: string; label: string }> = {
  harvest_count: { emoji: '🌾', color: 'text-yellow-300', bg: 'bg-yellow-500/15',  border: 'border-yellow-400/30',  label: 'Harvest' },
  harvest_gold:  { emoji: '✨', color: 'text-amber-300',  bg: 'bg-amber-500/15',   border: 'border-amber-400/30',   label: 'Gold' },
  plant_count:   { emoji: '🌱', color: 'text-green-300',  bg: 'bg-green-500/15',   border: 'border-green-400/30',   label: 'Plant' },
  steal_attempts:{ emoji: '🥷', color: 'text-red-300',    bg: 'bg-red-500/15',     border: 'border-red-400/30',     label: 'Raid' },
  steal_count:   { emoji: '🗡️', color: 'text-red-300',    bg: 'bg-red-500/15',     border: 'border-red-400/30',     label: 'Raid' },
  steal_gold:    { emoji: '💰', color: 'text-orange-300', bg: 'bg-orange-500/15',  border: 'border-orange-400/30',  label: 'Loot' },
  attack_count:  { emoji: '🐛', color: 'text-lime-300',   bg: 'bg-lime-500/15',    border: 'border-lime-400/30',    label: 'Attack' },
  water_count:   { emoji: '💧', color: 'text-blue-300',   bg: 'bg-blue-500/15',    border: 'border-blue-400/30',    label: 'Water' },
};

const DEFAULT_META = { emoji: '📋', color: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10', label: 'Quest' };

function getMeta(questType: QuestType) {
  return QUEST_META[questType] ?? DEFAULT_META;
}

// ── Countdown to midnight UTC ────────────────────────────────────
function useResetCountdown() {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setUTCHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setDisplay(`${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return display;
}

// ── Progress bar ──────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Quest card ────────────────────────────────────────────────────
function QuestCard({ quest, onClaim }: { quest: DailyQuest; onClaim: (id: string) => void }) {
  const [claimed, setClaimed] = useState(false);
  const meta     = getMeta(quest.questType);
  const progress = Number(quest.progress);
  const pct      = Math.min(100, Math.round((progress / quest.targetValue) * 100));
  const canClaim = quest.completed && !quest.claimed && !claimed;
  const isDone   = quest.claimed || claimed;

  const progressColor = isDone
    ? 'bg-green-400'
    : pct >= 100
      ? 'bg-green-400'
      : meta.color.replace('text-', 'bg-');

  return (
    <div className={[
      'rounded-2xl border p-4 flex flex-col gap-3 transition-all',
      isDone
        ? 'opacity-50 bg-white/3 border-white/8'
        : canClaim
          ? `${meta.bg} border-green-400/50 shadow-[0_0_12px_rgba(74,222,128,0.15)]`
          : `${meta.bg} ${meta.border}`,
    ].join(' ')}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${meta.bg}`}>
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-bold leading-tight ${isDone ? 'text-white/50' : 'text-white'}`}>
              {quest.title}
            </p>
            {isDone && <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />}
          </div>
          <p className="text-white/35 text-xs mt-0.5">{quest.description}</p>
        </div>
        {/* Rewards badge */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          {quest.rewardGold > 0 && (
            <span className="flex items-center gap-0.5 text-amber-300 text-[10px] font-bold">
              <Coins size={9} /> +{quest.rewardGold}G
            </span>
          )}
          {quest.rewardEnergy > 0 && (
            <span className="flex items-center gap-0.5 text-blue-300 text-[10px] font-bold">
              <Zap size={9} /> +{quest.rewardEnergy}
            </span>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <ProgressBar value={progress} max={quest.targetValue} color={progressColor} />
        <div className="flex items-center justify-between">
          <span className="text-white/35 text-[10px]">
            {Math.min(progress, quest.targetValue).toFixed(0)} / {quest.targetValue}
          </span>
          <span className={`text-[10px] font-bold ${pct >= 100 ? 'text-green-400' : meta.color}`}>
            {pct}%
          </span>
        </div>
      </div>

      {/* CTA */}
      {canClaim && (
        <button
          onClick={() => { setClaimed(true); onClaim(quest.id); }}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-400 text-black font-black text-sm active:scale-95 transition-all shadow-[0_0_16px_rgba(74,222,128,0.3)]"
        >
          🎁 Claim Reward
        </button>
      )}
      {isDone && (
        <div className="text-center text-green-400/50 text-xs font-semibold">Claimed ✓</div>
      )}
    </div>
  );
}

// ── Summary header ────────────────────────────────────────────────
function SummaryBar({ quests }: { quests: DailyQuest[] }) {
  const totalGold   = quests.reduce((s, q) => s + q.rewardGold, 0);
  const totalEnergy = quests.reduce((s, q) => s + q.rewardEnergy, 0);
  const claimed     = quests.filter((q) => q.claimed).length;
  const claimable   = quests.filter((q) => q.completed && !q.claimed).length;
  const countdown   = useResetCountdown();

  return (
    <div className="px-5 pb-4 flex-shrink-0">
      <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
        {/* Steps */}
        <div className="flex gap-1.5 flex-shrink-0">
          {quests.map((q, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
              q.claimed ? 'bg-green-400' : q.completed ? 'bg-amber-400 animate-pulse' : 'bg-white/15'
            }`} />
          ))}
        </div>

        {/* Stats */}
        <div className="flex-1 min-w-0">
          {claimable > 0 ? (
            <p className="text-green-300 text-xs font-bold">{claimable} reward{claimable > 1 ? 's' : ''} ready!</p>
          ) : claimed === quests.length && quests.length > 0 ? (
            <p className="text-white/60 text-xs font-semibold">All done today 🎉</p>
          ) : (
            <p className="text-white/50 text-xs">Keep playing to complete</p>
          )}
          <p className="text-white/25 text-[10px] mt-0.5">Resets in {countdown}</p>
        </div>

        {/* Total pot */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className="text-amber-300 text-[10px] font-bold flex items-center gap-0.5">
            <Coins size={8} /> {totalGold}G total
          </span>
          {totalEnergy > 0 && (
            <span className="text-blue-300 text-[10px] font-bold flex items-center gap-0.5">
              <Zap size={8} /> {totalEnergy}⚡
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Claim success toast ───────────────────────────────────────────
function ClaimToast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mx-5 mb-3 px-4 py-3 bg-green-500/20 border border-green-400/40 rounded-2xl flex items-center gap-3 flex-shrink-0 animate-fade-in-up">
      <span className="text-xl">🎁</span>
      <div>
        <p className="text-green-300 text-sm font-black">{msg}</p>
        <p className="text-green-400/60 text-xs">Added to your balance</p>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────
export function QuestModal({ onClose }: Props) {
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: quests = [], isLoading } = useQuery({
    queryKey: ['dailyQuests'],
    queryFn: api.getDailyQuests,
    staleTime: 30_000,
  });

  const { mutate: claimReward } = useMutation({
    mutationFn: api.claimQuestReward,
    onSuccess: (result) => {
      const parts = [`+${result.rewardGold}G`];
      if (result.rewardEnergy > 0) parts.push(`+${result.rewardEnergy}⚡`);
      setClaimMsg(parts.join(' · '));
      eventBus.emit('play-sound', 'quest');
      queryClient.invalidateQueries({ queryKey: ['dailyQuests'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  // Sort: claimable first, then incomplete, then done
  const sorted = [...quests].sort((a, b) => {
    const rank = (q: DailyQuest) => (q.completed && !q.claimed ? 0 : !q.completed ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-amber-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Daily Quests</h2>
              <p className="text-white/40 text-xs mt-0.5">
                {quests.filter(q => q.claimed).length}/{quests.length} claimed today
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Summary bar */}
        {!isLoading && quests.length > 0 && <SummaryBar quests={quests} />}

        {/* Claim toast */}
        {claimMsg && <ClaimToast msg={claimMsg} onDone={() => setClaimMsg(null)} />}

        {/* Quest list */}
        <div className="overflow-y-auto flex-1 px-5 pb-8 flex flex-col gap-3">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-white/40 text-sm">
              <Loader2 size={16} className="animate-spin" /> Loading quests…
            </div>
          )}

          {!isLoading && quests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Trophy size={40} className="text-white/15" />
              <p className="text-white/30 text-sm">No quests today.</p>
              <p className="text-white/20 text-xs">Check back tomorrow!</p>
            </div>
          )}

          {sorted.map((q) => (
            <QuestCard key={q.id} quest={q} onClaim={(id) => claimReward(id)} />
          ))}

          {/* Quest type legend */}
          {!isLoading && quests.length > 0 && (
            <div className="mt-2 pt-4 border-t border-white/8">
              <p className="text-white/20 text-[10px] text-center mb-2">QUEST TYPES</p>
              <div className="flex flex-wrap justify-center gap-2">
                {([
                  ['harvest_count', 'Harvest'], ['plant_count', 'Plant'],
                  ['steal_count', 'Raid'], ['steal_gold', 'Loot'],
                ] as [QuestType, string][]).map(([type, label]) => {
                  const m = getMeta(type);
                  return (
                    <span key={type} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.bg} ${m.color}`}>
                      {m.emoji} {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
