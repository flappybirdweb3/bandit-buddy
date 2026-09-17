import { useState, useEffect, useMemo } from 'react';
import {
  X, CheckCircle2, Coins, Zap, Loader2, Trophy, Award,
  Flame, Users, Sparkles, Check, ChevronRight, Sprout, Swords
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import type { DailyQuest, QuestType, Achievement, AchievementCategory } from '@/types/game.types';

interface Props {
  onClose: () => void;
}

// ── Quest type metadata ───────────────────────────────────────────
const QUEST_META: Record<QuestType, { emoji: string; color: string; bg: string; border: string; label: string }> = {
  harvest_count: { emoji: '🌾', color: 'text-yellow-300', bg: 'bg-yellow-500/15', border: 'border-yellow-400/30', label: 'Harvest' },
  harvest_gold:  { emoji: '✨', color: 'text-amber-300',  bg: 'bg-amber-500/15',  border: 'border-amber-400/30',  label: 'Gold' },
  plant_count:   { emoji: '🌱', color: 'text-green-300',  bg: 'bg-green-500/15',  border: 'border-green-400/30',  label: 'Plant' },
  steal_attempts:{ emoji: '🥷', color: 'text-red-300',    bg: 'bg-red-500/15',    border: 'border-red-400/30',    label: 'Raid' },
  steal_count:   { emoji: '🗡️', color: 'text-red-300',    bg: 'bg-red-500/15',    border: 'border-red-400/30',    label: 'Raid' },
  steal_gold:    { emoji: '💰', color: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-400/30', label: 'Loot' },
  attack_count:  { emoji: '🐛', color: 'text-lime-300',   bg: 'bg-lime-500/15',   border: 'border-lime-400/30',   label: 'Attack' },
  water_count:   { emoji: '💧', color: 'text-blue-300',   bg: 'bg-blue-500/15',   border: 'border-blue-400/30',   label: 'Water' },
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
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Daily Quest Card ──────────────────────────────────────────────
function QuestCard({
  quest,
  onClaim,
  isClaiming,
}: {
  quest: DailyQuest;
  onClaim: (id: string) => void;
  isClaiming: boolean;
}) {
  const [claimedLocal, setClaimedLocal] = useState(false);
  const meta     = getMeta(quest.questType);
  const progress = Number(quest.progress);
  const pct      = Math.min(100, Math.round((progress / Math.max(1, quest.targetValue)) * 100));
  const canClaim = quest.completed && !quest.claimed && !claimedLocal;
  const isDone   = quest.claimed || claimedLocal;

  const progressColor = isDone
    ? 'bg-green-400'
    : pct >= 100
      ? 'bg-green-400'
      : meta.color.replace('text-', 'bg-');

  return (
    <div
      className={[
        'rounded-2xl border p-4 flex flex-col gap-3 transition-all',
        isDone
          ? 'opacity-55 bg-white/3 border-white/8'
          : canClaim
            ? `${meta.bg} border-green-400/50 shadow-[0_0_12px_rgba(74,222,128,0.15)]`
            : `${meta.bg} ${meta.border}`,
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${meta.bg}`}>
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`text-sm font-bold leading-tight ${isDone ? 'text-white/50' : 'text-white'}`}>
              {quest.title}
            </p>
            {isDone && <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />}
          </div>
          <p className="text-white/40 text-xs mt-0.5 leading-snug">{quest.description}</p>
        </div>

        {/* Rewards badge */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {quest.rewardGold > 0 && (
            <span className="flex items-center gap-1 text-amber-300 text-xs font-black bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
              <Coins size={11} /> +{quest.rewardGold}G
            </span>
          )}
          {quest.rewardEnergy > 0 && (
            <span className="flex items-center gap-1 text-blue-300 text-xs font-black bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
              <Zap size={11} /> +{quest.rewardEnergy}⚡
            </span>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <ProgressBar value={progress} max={quest.targetValue} color={progressColor} />
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/40 font-medium">
            {Math.min(progress, quest.targetValue).toFixed(0)} / {quest.targetValue}
          </span>
          <span className={`font-bold ${pct >= 100 ? 'text-green-400' : meta.color}`}>
            {pct}%
          </span>
        </div>
      </div>

      {/* CTA */}
      {canClaim && (
        <button
          onClick={() => {
            setClaimedLocal(true);
            onClaim(quest.id);
          }}
          disabled={isClaiming}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-400 text-black font-black text-sm active:scale-95 transition-all shadow-[0_0_16px_rgba(74,222,128,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isClaiming ? <Loader2 size={16} className="animate-spin" /> : <span>🎁</span>}
          <span>Claim Reward</span>
        </button>
      )}
      {isDone && (
        <div className="text-center text-green-400/70 text-xs font-semibold py-1">Claimed ✓</div>
      )}
    </div>
  );
}

// ── Summary Bar with Claim All ────────────────────────────────────
function SummaryBar({
  quests,
  onClaimAll,
  isClaimingAll,
}: {
  quests: DailyQuest[];
  onClaimAll: () => void;
  isClaimingAll: boolean;
}) {
  const totalGold   = quests.reduce((s, q) => s + q.rewardGold, 0);
  const totalEnergy = quests.reduce((s, q) => s + q.rewardEnergy, 0);
  const claimed     = quests.filter((q) => q.claimed).length;
  const claimable   = quests.filter((q) => q.completed && !q.claimed).length;
  const countdown   = useResetCountdown();

  return (
    <div className="px-5 pb-3 flex-shrink-0">
      <div className="glass rounded-2xl p-3.5 flex items-center justify-between gap-3 border border-white/10">
        {/* Left indicators & status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex gap-1 flex-shrink-0">
            {quests.map((q, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  q.claimed
                    ? 'bg-green-400'
                    : q.completed
                      ? 'bg-amber-400 ring-2 ring-amber-400/40 animate-pulse'
                      : 'bg-white/15'
                }`}
              />
            ))}
          </div>

          <div className="min-w-0">
            {claimable > 0 ? (
              <p className="text-green-300 text-xs font-extrabold truncate">
                {claimable} reward{claimable > 1 ? 's' : ''} ready!
              </p>
            ) : claimed === quests.length && quests.length > 0 ? (
              <p className="text-white/70 text-xs font-semibold truncate">All completed 🎉</p>
            ) : (
              <p className="text-white/50 text-xs truncate">Keep playing to earn</p>
            )}
            <p className="text-white/30 text-[10px] mt-0.5">Resets in {countdown}</p>
          </div>
        </div>

        {/* Right side: Claim All Button or Pot summary */}
        {claimable >= 1 ? (
          <button
            onClick={onClaimAll}
            disabled={isClaimingAll}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 active:scale-95 text-black font-black text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.35)] disabled:opacity-50 transition-all flex-shrink-0"
          >
            {isClaimingAll ? <Loader2 size={13} className="animate-spin" /> : <span>🎁</span>}
            <span>Claim All ({claimable})</span>
          </button>
        ) : (
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <span className="text-amber-300 text-xs font-bold flex items-center gap-1">
              <Coins size={11} /> {totalGold}G pot
            </span>
            {totalEnergy > 0 && (
              <span className="text-blue-300 text-[10px] font-bold flex items-center gap-1">
                <Zap size={10} /> +{totalEnergy}⚡
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Achievement Card ──────────────────────────────────────────────
function AchievementCard({ ach }: { ach: Achievement }) {
  const isUnlocked = ach.unlocked;
  const progress   = Number(ach.progress ?? 0);
  const target     = Number(ach.target ?? 1);
  const pct        = Math.min(100, Math.round((progress / target) * 100));

  return (
    <div
      className={[
        'rounded-2xl border p-3.5 flex flex-col gap-2.5 transition-all',
        isUnlocked
          ? 'bg-amber-500/10 border-amber-400/35 shadow-[0_0_12px_rgba(251,191,36,0.08)]'
          : 'bg-white/4 border-white/8 opacity-80',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            'w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform',
            isUnlocked
              ? 'bg-amber-400/20 border border-amber-400/30'
              : 'bg-white/5 border border-white/10 grayscale',
          ].join(' ')}
        >
          {ach.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-sm font-bold truncate ${isUnlocked ? 'text-amber-200' : 'text-white/80'}`}>
              {ach.name}
            </h4>
            {isUnlocked ? (
              <span className="flex items-center gap-1 text-[10px] font-black text-amber-300 bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-400/30 flex-shrink-0">
                <Check size={10} /> Unlocked
              </span>
            ) : (
              <span className="text-[10px] font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 flex-shrink-0">
                {pct}%
              </span>
            )}
          </div>
          <p className="text-white/45 text-xs mt-0.5 leading-snug">{ach.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isUnlocked ? 'bg-amber-400' : 'bg-emerald-500/80'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-white/35 font-medium">
          <span>{progress} / {target}</span>
          <span>{isUnlocked ? 'Completed' : `${target - progress} remaining`}</span>
        </div>
      </div>
    </div>
  );
}

// ── Claim Toast Notification ──────────────────────────────────────
function ClaimToast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="mx-5 mb-3 px-4 py-3 bg-gradient-to-r from-green-500/25 to-emerald-500/25 border border-green-400/50 rounded-2xl flex items-center gap-3 flex-shrink-0 shadow-lg shadow-green-950/40 animate-fade-in-up">
      <span className="text-2xl">🎁</span>
      <div className="min-w-0 flex-1">
        <p className="text-green-200 text-sm font-black truncate">{msg}</p>
        <p className="text-green-400/70 text-xs">Claimed & credited to your account!</p>
      </div>
    </div>
  );
}

// ── Main Modal Component ──────────────────────────────────────────
export function QuestModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'daily' | 'achievements'>('daily');
  const [achFilter, setAchFilter] = useState<AchievementCategory | 'all'>('all');
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Queries
  const { data: quests = [], isLoading: isLoadingQuests } = useQuery({
    queryKey: ['dailyQuests'],
    queryFn: api.getDailyQuests,
    staleTime: 15_000,
  });

  const { data: achievements = [], isLoading: isLoadingAch } = useQuery({
    queryKey: ['achievements'],
    queryFn: api.getAchievements,
    staleTime: 30_000,
  });

  // Single Quest Claim Mutation
  const { mutate: claimReward, isPending: isClaimingSingle } = useMutation({
    mutationFn: api.claimQuestReward,
    onSuccess: (result) => {
      const parts = [`+${result.rewardGold}G`];
      if (result.rewardEnergy > 0) parts.push(`+${result.rewardEnergy}⚡`);
      setClaimMsg(`Reward Claimed: ${parts.join(' · ')}`);
      eventBus.emit('play-sound', 'quest');
      queryClient.invalidateQueries({ queryKey: ['dailyQuests'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
    },
  });

  // Batch Claim All Mutation
  const { mutate: claimAll, isPending: isClaimingAll } = useMutation({
    mutationFn: api.claimAllQuests,
    onSuccess: (result) => {
      if (result.claimedCount > 0) {
        const parts = [`+${result.totalGold}G`];
        if (result.totalEnergy > 0) parts.push(`+${result.totalEnergy}⚡`);
        setClaimMsg(`Claimed ${result.claimedCount} Quests: ${parts.join(' · ')}!`);
      } else {
        setClaimMsg('No quests to claim!');
      }
      eventBus.emit('play-sound', 'quest');
      queryClient.invalidateQueries({ queryKey: ['dailyQuests'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
    },
  });

  // Daily quest sorting: claimable first, then incomplete, then claimed
  const sortedQuests = useMemo(() => {
    return [...quests].sort((a, b) => {
      const rank = (q: DailyQuest) => (q.completed && !q.claimed ? 0 : !q.completed ? 1 : 2);
      return rank(a) - rank(b);
    });
  }, [quests]);

  const claimableCount = quests.filter((q) => q.completed && !q.claimed).length;

  // Filtered achievements
  const filteredAchievements = useMemo(() => {
    let list = achievements;
    if (achFilter !== 'all') {
      list = list.filter((a) => a.category === achFilter);
    }
    return [...list].sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return b.pct - a.pct;
    });
  }, [achievements, achFilter]);

  const unlockedAchCount = achievements.filter((a) => a.unlocked).length;
  const achTotalPct = achievements.length > 0 ? Math.round((unlockedAchCount / achievements.length) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-zinc-950/95 border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden mx-auto slide-up"
        style={{
          maxHeight: 'calc(var(--tg-viewport-stable-height, 100vh) - 40px)',
          paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)) + 80px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer drag pill */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Trophy size={20} />
            </div>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Quests & Badges</h2>
              <p className="text-white/40 text-xs">
                {activeTab === 'daily'
                  ? `${quests.filter((q) => q.claimed).length}/${quests.length} claimed today`
                  : `${unlockedAchCount}/${achievements.length} badges unlocked (${achTotalPct}%)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-90"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-1 pb-3 flex-shrink-0">
          <div className="flex p-1 rounded-2xl bg-white/5 border border-white/10">
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                activeTab === 'daily'
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span>📅 Daily Quests</span>
              {claimableCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    activeTab === 'daily'
                      ? 'bg-black text-amber-300'
                      : 'bg-green-500 text-black animate-pulse'
                  }`}
                >
                  {claimableCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('achievements')}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                activeTab === 'achievements'
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span>🏆 Milestones & Badges</span>
              <span
                className={`text-[10px] font-bold ${
                  activeTab === 'achievements' ? 'text-black/70' : 'text-white/40'
                }`}
              >
                {unlockedAchCount}
              </span>
            </button>
          </div>
        </div>

        {/* Claim Toast if active */}
        {claimMsg && <ClaimToast msg={claimMsg} onDone={() => setClaimMsg(null)} />}

        {/* ── TAB 1: DAILY QUESTS ──────────────────────────────────── */}
        {activeTab === 'daily' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Daily summary bar */}
            {!isLoadingQuests && quests.length > 0 && (
              <SummaryBar
                quests={quests}
                onClaimAll={() => claimAll()}
                isClaimingAll={isClaimingAll}
              />
            )}

            {/* List */}
            <div className="px-5 pb-6 flex flex-col gap-3">
              {isLoadingQuests && (
                <div className="flex items-center justify-center gap-2 py-16 text-white/40 text-sm">
                  <Loader2 size={18} className="animate-spin text-amber-400" /> Loading daily quests…
                </div>
              )}

              {!isLoadingQuests && quests.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <Trophy size={42} className="text-white/15" />
                  <p className="text-white/40 text-sm font-semibold">No quests today</p>
                  <p className="text-white/25 text-xs">New daily tasks refresh at midnight UTC!</p>
                </div>
              )}

              {sortedQuests.map((q) => (
                <QuestCard
                  key={q.id}
                  quest={q}
                  onClaim={(id) => claimReward(id)}
                  isClaiming={isClaimingSingle || isClaimingAll}
                />
              ))}

              {/* Legend */}
              {!isLoadingQuests && quests.length > 0 && (
                <div className="mt-2 pt-3 border-t border-white/8">
                  <p className="text-white/30 text-[10px] text-center font-bold tracking-wider mb-2">
                    DAILY OBJECTIVE TYPES
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {([
                      ['harvest_count', 'Harvest'],
                      ['plant_count', 'Plant'],
                      ['steal_count', 'Raid'],
                      ['attack_count', 'Attack'],
                      ['water_count', 'Water'],
                    ] as [QuestType, string][]).map(([type, label]) => {
                      const m = getMeta(type);
                      return (
                        <span
                          key={type}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${m.bg} ${m.color} border ${m.border}`}
                        >
                          {m.emoji} {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: ACHIEVEMENTS & MILESTONES ──────────────────────── */}
        {activeTab === 'achievements' && (
          <div className="flex-1 overflow-y-auto flex flex-col px-5 pb-6">
            {/* Category filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-3 pt-1 scrollbar-none flex-shrink-0">
              {([
                ['all', 'All', '🌟'],
                ['farmer', 'Farmer', '🌾'],
                ['raider', 'Raider', '🥷'],
                ['streak', 'Streak', '🔥'],
                ['social', 'Social', '👥'],
              ] as [AchievementCategory | 'all', string, string][]).map(([key, label, icon]) => (
                <button
                  key={key}
                  onClick={() => setAchFilter(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    achFilter === key
                      ? 'bg-amber-400 text-black shadow-sm shadow-amber-500/30'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Achievement Items */}
            {isLoadingAch ? (
              <div className="flex items-center justify-center gap-2 py-16 text-white/40 text-sm">
                <Loader2 size={18} className="animate-spin text-amber-400" /> Loading milestones…
              </div>
            ) : filteredAchievements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Award size={42} className="text-white/15" />
                <p className="text-white/40 text-sm font-semibold">No badges in this category</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredAchievements.map((ach) => (
                  <AchievementCard key={ach.id} ach={ach} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
