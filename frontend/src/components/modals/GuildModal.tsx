import { useState, useEffect } from 'react';
import {
  X, Shield, Users, Crown, Plus, LogIn, LogOut, Loader2, TrendingUp,
  Zap, AlertCircle, Droplets, Gift, Swords, Copy, Check, Info, Sparkles, Share2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { GuildInfo, GuildListEntry } from '@/types/game.types';

interface Props { onClose: () => void }

type Tab = 'my-guild' | 'browse' | 'raid-radar';

function GuildCard({
  guild, onJoin, onRaid, busy, isMyGuild, alreadyInGuild,
}: {
  guild: GuildListEntry;
  onJoin: () => void;
  onRaid?: () => void;
  busy: boolean;
  isMyGuild: boolean;
  alreadyInGuild: boolean;
}) {
  const staked = Number(guild.stakedFarm ?? 0);
  const safeStaked = isNaN(staked) ? 0 : staked;
  const memberCount = Number(guild.memberCount ?? 0);
  const maxMembers = guild.maxMembers ?? (guild.isPremium ? 1000 : 20);

  return (
    <div
      className={`glass rounded-2xl p-4 flex flex-col gap-2.5 transition-all ${
        isMyGuild
          ? 'border border-blue-400/50 bg-blue-500/5'
          : guild.isPremium
          ? 'border border-blue-500/30 bg-blue-500/5'
          : 'border border-white/10'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
            guild.isPremium
              ? 'bg-gradient-to-br from-blue-500/30 to-indigo-600/40 border border-blue-400/40 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
              : 'bg-stone-800/80 border border-stone-600/40'
          }`}
        >
          {guild.isPremium ? '⭐' : '🏰'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-white font-black text-sm leading-tight truncate">{guild.name}</p>
            {guild.isPremium ? (
              <span className="text-[9px] font-black text-blue-300 bg-blue-500/20 border border-blue-400/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                ⭐ BLUE BADGE
              </span>
            ) : (
              <span className="text-[9px] font-bold text-stone-400 bg-stone-500/20 px-1.5 py-0.5 rounded-full">
                FREE TIER
              </span>
            )}
            {isMyGuild && (
              <span className="text-[9px] font-black text-green-400 bg-green-400/15 px-1.5 py-0.5 rounded-full">
                JOINED
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 text-[10px] text-white/50">
            <span>👥 {memberCount}/{maxMembers}</span>
            <span>•</span>
            <span>🌳 Tree Lvl {guild.treeLevel ?? 1} ({Number(guild.treeProgressPercent || 0).toFixed(0)}%)</span>
            <span>•</span>
            <span className="text-amber-300 font-bold">{safeStaked.toFixed(0)} $FARM</span>
          </div>
          <p className="text-white/30 text-[9px] mt-0.5">Owner: @{guild.ownerUsername || 'unknown'}</p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isMyGuild ? (
            <span className="text-blue-400/80 text-xs font-bold px-3 py-1.5 bg-blue-500/10 rounded-xl">
              Current
            </span>
          ) : (
            <button
              disabled={busy || alreadyInGuild || memberCount >= maxMembers}
              onClick={onJoin}
              title={alreadyInGuild ? 'Leave your current guild first' : ''}
              className="glass text-green-400 font-bold text-xs px-3.5 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1 border border-green-500/30 hover:bg-green-500/20"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
              Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ShieldCountdown({
  shieldUntil, onBuyShield, busy, isElite,
}: {
  shieldUntil?: string | Date | null;
  onBuyShield: () => void;
  busy: boolean;
  isElite: boolean;
}) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(false);

  useEffect(() => {
    if (!shieldUntil) {
      setIsActive(false);
      setTimeLeft('');
      return;
    }
    const updateTimer = () => {
      const diff = new Date(shieldUntil).getTime() - Date.now();
      if (diff <= 0) {
        setIsActive(false);
        setTimeLeft('');
      } else {
        setIsActive(true);
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [shieldUntil]);

  return (
    <div className={`rounded-2xl p-3 mb-3 border flex items-center justify-between transition-all ${
      isActive
        ? 'border-cyan-400/40 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
        : 'border-white/10 bg-white/5'
    }`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-stone-800 text-stone-400'}`}>
          <Shield size={16} className={isActive ? 'animate-pulse' : ''} />
        </div>
        <div>
          <p className="text-white text-xs font-black leading-tight">
            {isActive ? 'Energy Shield Active' : 'Shield Inactive (Tree Vulnerable)'}
          </p>
          <p className={`text-[10px] ${isActive ? 'text-cyan-300 font-mono font-bold' : 'text-white/40'}`}>
            {isActive ? `Protected: ${timeLeft}` : 'Enemy guilds can siphon 15% when ripe'}
          </p>
        </div>
      </div>
      {isElite && (
        <button
          disabled={busy}
          onClick={onBuyShield}
          className="glass px-3 py-1.5 rounded-xl border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/20 active:scale-95 text-xs font-bold flex items-center gap-1"
        >
          <Shield size={12} />
          {isActive ? '+12h (500G)' : 'Buy Shield (500G)'}
        </button>
      )}
    </div>
  );
}

function RaidGuildCard({
  guild, onRaid, busy,
}: {
  guild: GuildListEntry;
  onRaid: () => void;
  busy: boolean;
}) {
  const isRipe = guild.status === 'ripe';
  const isShielded = guild.isShielded;
  const siphonFarm = (Number(guild.rewardPoolFarm || 100) * 0.15).toFixed(1);
  const siphonGold = Math.floor(Number(guild.rewardPoolGold || 2000) * 0.15);

  return (
    <div className={`glass rounded-2xl p-4 flex flex-col gap-2.5 transition-all border ${
      isShielded ? 'border-white/10 bg-white/5 opacity-70' : 'border-red-500/30 bg-red-500/5'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
          isShielded ? 'bg-cyan-500/20 border border-cyan-400/30' : 'bg-red-500/20 border border-red-400/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
        }`}>
          {isShielded ? '🛡️' : '🌳'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-white font-black text-sm leading-tight truncate">{guild.name}</p>
            {isShielded ? (
              <span className="text-[9px] font-black text-cyan-300 bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                🛡️ SHIELDED
              </span>
            ) : isRipe ? (
              <span className="text-[9px] font-black text-red-300 bg-red-500/20 border border-red-400/40 px-2 py-0.5 rounded-full animate-pulse">
                ⚔️ VULNERABLE
              </span>
            ) : (
              <span className="text-[9px] font-bold text-stone-400 bg-stone-500/20 px-1.5 py-0.5 rounded-full">
                GROWING ({Number(guild.treeProgressPercent || 0).toFixed(0)}%)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 text-[10px] text-white/50">
            <span>HP: {guild.worldTreeHp ?? 1000}/1000</span>
            <span>•</span>
            <span className="text-amber-300 font-bold">Bounty: ~{siphonFarm} $FARM &amp; {siphonGold}G</span>
          </div>
          <p className="text-white/30 text-[9px] mt-0.5">Owner: @{guild.ownerUsername || 'unknown'}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            disabled={busy || isShielded || !isRipe}
            onClick={onRaid}
            title={isShielded ? 'Protected by Energy Shield' : !isRipe ? 'Tree not ripe yet' : 'Siphon 15% dividend'}
            className={`font-black text-xs px-3.5 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1 ${
              isShielded || !isRipe
                ? 'glass text-white/30 cursor-not-allowed border border-white/10'
                : 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)] border border-red-400/40 hover:brightness-110'
            }`}
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Swords size={12} />}
            {isShielded ? 'Shielded' : !isRipe ? 'Growing' : 'Raid Tree'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MyGuildView({
  guild, onLeave, onStake, onUpgrade, onWater, onBuyShield, onAutoCompound, onClaimTree, onSetTax, busy,
}: {
  guild: GuildInfo;
  onLeave: () => void;
  onStake: (amount: number) => void;
  onUpgrade: () => void;
  onWater: () => void;
  onBuyShield: () => void;
  onAutoCompound: () => void;
  onClaimTree: () => void;
  onSetTax: (taxRate: number) => void;
  busy: boolean;
}) {
  const [selectedTax, setSelectedTax] = useState<number>(guild.taxRate || 0.02);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const staked = Number(guild.stakedFarm ?? 0);
  const safeStaked = isNaN(staked) ? 0 : staked;
  const safeTax = Number(guild.taxRate ?? 0);
  const treeLevel = Number(guild.treeLevel || 1);
  const treeProgress = Math.min(100, Math.max(0, Number(guild.treeProgressPercent || 0)));
  const isRipe = guild.status === 'ripe' || treeProgress >= 100;
  const isShielded = guild.isShielded;
  const maxTreeLvl = guild.isPremium ? 10 : 3;

  const contrib = guild.myContribution;
  const canWater = contrib?.canWater ?? true;
  const cooldownHours = contrib?.cooldownRemainingHours ?? 0;

  const copyWaterCmd = () => {
    navigator.clipboard.writeText('/water');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── 1. Guild Banner & Badge ── */}
      <div
        className={`rounded-2xl p-4 transition-all ${
          guild.isPremium
            ? 'bg-gradient-to-r from-blue-950/80 via-blue-900/60 to-indigo-950/80 border border-blue-400/40 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
            : 'glass border border-stone-600/40'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
                guild.isPremium
                  ? 'bg-blue-500/25 border border-blue-400/40 text-blue-300'
                  : 'bg-white/10 border border-white/10'
              }`}
            >
              {guild.isPremium ? '⭐' : '🏰'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-white font-black text-base leading-tight">{guild.name}</h3>
                {guild.isPremium ? (
                  <span className="text-[9px] font-black text-blue-300 bg-blue-500/20 border border-blue-400/40 px-2 py-0.5 rounded-full">
                    BLUE BADGE ELITE
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-stone-400 bg-stone-500/20 px-2 py-0.5 rounded-full">
                    FREE GUILD
                  </span>
                )}
              </div>
              <p className="text-white/40 text-[10px] mt-0.5">
                Owner: @{guild.members?.find((m) => m.role === 'owner')?.username || 'unknown'} • ID: {guild.id.slice(0, 8)}…
              </p>
            </div>
          </div>
          <button
            disabled={busy}
            onClick={onLeave}
            title="Leave Guild"
            className="text-white/40 hover:text-red-400 p-1.5 glass rounded-xl transition-all active:scale-90"
          >
            <LogOut size={14} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-center">
          <div>
            <p className="text-white/40 text-[9px] font-bold uppercase tracking-wider">Members</p>
            <p className="text-white font-black text-sm mt-0.5">
              {guild.memberCount}/{guild.maxMembers}
            </p>
          </div>
          <div>
            <p className="text-white/40 text-[9px] font-bold uppercase tracking-wider">Staked $FARM</p>
            <p className="text-amber-300 font-black text-sm mt-0.5">{safeStaked.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-white/40 text-[9px] font-bold uppercase tracking-wider">Harvest Tax</p>
            <p className="text-blue-300 font-black text-sm mt-0.5">
              {guild.isPremium ? `${(safeTax * 100).toFixed(0)}%` : '0% (Free)'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. World Tree Card ── */}
      <div className="glass rounded-2xl p-4 border border-emerald-500/30 bg-emerald-950/20 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌳</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-black text-sm">World Tree</span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                  Level {treeLevel}/{maxTreeLvl}
                </span>
                {isShielded && (
                  <span className="text-[9px] font-black text-cyan-300 bg-cyan-500/20 border border-cyan-400/40 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Shield size={9} /> SHIELDED
                  </span>
                )}
              </div>
              <p className="text-white/50 text-[10px]">
                HP: {guild.worldTreeHp ?? 1000} / {1000 * treeLevel}
              </p>
            </div>
          </div>
          <span className="text-xs font-black text-emerald-300">
            {treeProgress.toFixed(0)}%
          </span>
        </div>

        {/* Growth Progress Bar */}
        <div className="mb-3.5 relative z-10">
          <div className="flex justify-between text-[10px] text-white/50 mb-1 font-semibold">
            <span>Growth Progress</span>
            <span className={isRipe ? 'text-green-400 font-bold animate-pulse' : 'text-emerald-400 font-bold'}>
              {isRipe ? '🎉 RIPE FOR HARVEST!' : `${treeProgress.toFixed(1)}%`}
            </span>
          </div>
          <div className="h-3.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/15">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isRipe
                  ? 'bg-gradient-to-r from-green-400 to-emerald-300 shadow-[0_0_12px_rgba(74,222,128,0.7)] animate-pulse'
                  : 'bg-gradient-to-r from-emerald-500 to-green-400'
              }`}
              style={{ width: `${treeProgress}%` }}
            />
          </div>
        </div>

        {/* Treasury & Auto-Compound section */}
        <div className="glass rounded-xl p-3 mb-3.5 relative z-10 border border-amber-500/25 bg-amber-500/5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-white/80 font-bold flex items-center gap-1.5">
              <span>🏛️ Guild Treasury:</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-amber-300 font-black">{guild.rewardPoolFarm ?? 100} $FARM</span>
              <span className="text-white/30">•</span>
              <span className="text-yellow-400 font-bold">{(guild.rewardPoolGold ?? 2000).toLocaleString()} Gold</span>
            </div>
          </div>
          <p className="text-[10px] text-white/60 mb-2.5 leading-tight">
            Harvest taxes accumulate in Treasury. Reinvest 50% into Tree Growth, HP healing &amp; $FARM Staking!
          </p>
          <button
            disabled={busy || (guild.rewardPoolGold ?? 0) < 100}
            onClick={onAutoCompound}
            className="w-full py-2.5 rounded-xl font-black text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)] disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            ⚡ Auto-Compound Treasury (50% Reinvest)
          </button>
        </div>

        {/* 12-Hour Energy Shield Countdown & Extension */}
        <ShieldCountdown
          shieldUntil={guild.shieldUntil}
          onBuyShield={onBuyShield}
          busy={busy}
          isElite={guild.isPremium}
        />

        {/* Action Buttons Row */}
        <div className="flex flex-col gap-2 relative z-10">
          {contrib?.isViralBoostEligible && canWater && !isRipe && (
            <div className="rounded-xl px-3 py-1.5 text-center text-[10px] font-black text-amber-300 border border-amber-400/40 bg-amber-500/10 animate-pulse">
              ✨ RECRUIT BONUS: Your first water grants +5% tree growth &amp; +5 dividend points!
            </div>
          )}

          <div className="flex gap-2">
            {/* Water button */}
            <button
              disabled={busy || !canWater || isRipe}
              onClick={onWater}
              className={`flex-1 py-3 rounded-2xl font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 ${
                canWater && !isRipe
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] border border-green-400/40'
                  : 'glass text-white/40 cursor-not-allowed border border-white/10'
              }`}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Droplets size={14} />}
              {canWater && !isRipe
                ? contrib?.isViralBoostEligible
                  ? '💧 Water Tree (✨ +5% Surge!)'
                  : '💧 Water Tree (+1%)'
                : isRipe
                ? 'Tree is Ripe (100%)'
                : `Watered today (${cooldownHours}h)`}
            </button>
          </div>

          {/* Claim Tree Reward (when ripe) */}
          {isRipe && (
            <button
              disabled={busy || contrib?.claimed}
              onClick={onClaimTree}
              className={`w-full py-3 rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2 ${
                contrib?.claimed
                  ? 'glass text-white/40 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse'
              }`}
            >
              <Gift size={16} />
              {contrib?.claimed ? 'Rewards Claimed for this Cycle' : '🎁 CLAIM RIPE TREE REWARDS ($FARM & GOLD)'}
            </button>
          )}

          {/* Viral Growth Hack Tip */}
          <div className="flex items-center justify-between glass rounded-xl px-3 py-2 text-[10px] text-white/60">
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-yellow-400 flex-shrink-0" />
              <span>Invite friends to game: their first water boosts Tree by <b>+5%</b>!</span>
            </div>
            <button
              onClick={copyWaterCmd}
              className="glass px-2 py-1 rounded-lg text-white/80 font-bold text-[9px] hover:bg-white/10 active:scale-95 flex items-center gap-1 ml-2"
            >
              {copiedCmd ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
              {copiedCmd ? 'Copied' : 'Copy /water'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. PROOF OF CONTRIBUTION ── */}
      <div className="glass rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Crown size={14} className="text-amber-400" />
            <span className="text-white font-bold text-sm">Your Contribution (Proof of Work)</span>
          </div>
          <span className="text-amber-300 font-black text-xs">
            ⭐ {contrib?.calculatedPoints ?? 0} Pts
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="glass rounded-xl p-2 border border-white/5">
            <p className="text-white/40 text-[9px]">Water Count (x1)</p>
            <p className="text-green-300 font-black text-sm mt-0.5">{contrib?.waterCount ?? 0}</p>
          </div>
          <div className="glass rounded-xl p-2 border border-white/5">
            <p className="text-white/40 text-[9px]">Invited F1 (x5)</p>
            <p className="text-blue-300 font-black text-sm mt-0.5">{contrib?.invitedCount ?? 0}</p>
          </div>
          <div className="glass rounded-xl p-2 border border-white/5">
            <p className="text-white/40 text-[9px]">Est. Share</p>
            <p className="text-amber-300 font-black text-sm mt-0.5">~{contrib?.sharePercent ?? 0}%</p>
          </div>
        </div>

        {/* Top 5 Contributors Leaderboard in Guild */}
        {guild.topContributors && guild.topContributors.length > 0 && (
          <div>
            <p className="text-white/40 text-[10px] font-bold mb-2">Guild Hall of Fame</p>
            <div className="flex flex-col gap-1.5">
              {guild.topContributors.map((c, idx) => (
                <div key={c.userId} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white/40 w-4">#{idx + 1}</span>
                    <span className="text-white/80 font-semibold truncate max-w-[120px]">@{c.username}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-white/40">💧 {c.waterCount}</span>
                    <span className="text-blue-300">👥 {c.invitedCount}</span>
                    <span className="text-amber-300 font-bold">⭐ {c.points} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 4. GUILD MEMBERS ── */}
      <div className="glass rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-white/50" />
            <span className="text-white font-bold text-sm">
              Members ({guild.memberCount}/{guild.maxMembers ?? 20})
            </span>
          </div>
          <span className="text-white/40 text-[10px]">
            Role: <b className="text-white capitalize">{guild.myRole}</b>
          </span>
        </div>
        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
          {(guild.members ?? []).map((m) => (
            <div key={m.userId} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-xl bg-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{m.role === 'owner' ? '👑' : m.role === 'officer' ? '⭐' : '👤'}</span>
                <p className="text-white/80 font-bold truncate">@{m.username}</p>
              </div>
              <span className="text-white/40 text-[10px] capitalize">{m.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. GUILD MASTER CONTROLS ── */}
      {guild.myRole === 'owner' && (
        <div className="glass rounded-2xl p-4 border border-amber-500/25 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Crown size={15} className="text-amber-400" />
            <span className="text-white font-bold text-sm">Guild Master Controls</span>
          </div>

          {/* Tax setting (Elite only) */}
          {guild.isPremium ? (
            <div className="glass rounded-xl p-3 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/70 text-xs font-semibold">Harvest Crop Tax (1% - 5%)</span>
                <span className="text-amber-300 font-black text-xs">{(selectedTax * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-2">
                {[0.01, 0.02, 0.03, 0.04, 0.05].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setSelectedTax(rate)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedTax === rate
                        ? 'bg-amber-500 text-black font-black'
                        : 'glass text-white/50 hover:text-white'
                    }`}
                  >
                    {(rate * 100).toFixed(0)}%
                  </button>
                ))}
              </div>
              {selectedTax !== guild.taxRate && (
                <button
                  disabled={busy}
                  onClick={() => onSetTax(selectedTax)}
                  className="w-full mt-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs active:scale-95 transition-all"
                >
                  Save {(selectedTax * 100).toFixed(0)}% Tax Rate
                </button>
              )}
            </div>
          ) : (
            safeStaked >= 1000 && (
              <button
                disabled={busy}
                onClick={onUpgrade}
                className="w-full py-2.5 rounded-xl font-black text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]"
              >
                <Zap size={14} /> Activate Elite Blue Badge ⭐ (1,000 $FARM reached)
              </button>
            )
          )}

          {/* Stake control */}
          <StakeControl
            stakedFarm={safeStaked}
            isElite={guild.isPremium}
            onStake={onStake}
            onUpgrade={onUpgrade}
            busy={busy}
          />
        </div>
      )}

      {/* Leave Guild (Members only) */}
      {guild.myRole !== 'owner' && (
        <button
          disabled={busy}
          onClick={onLeave}
          className="w-full py-3 rounded-2xl glass text-red-400/80 font-bold text-xs active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 border border-red-500/20 hover:bg-red-500/10"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
          Leave Guild
        </button>
      )}
    </div>
  );
}

function StakeControl({
  stakedFarm, isElite, onStake, onUpgrade, busy,
}: {
  stakedFarm: number;
  isElite: boolean;
  onStake: (amount: number) => void;
  onUpgrade: () => void;
  busy: boolean;
}) {
  const [stakeAmount, setStakeAmount] = useState('');
  const safeStaked = Number(stakedFarm || 0);
  const canUpgrade = safeStaked >= 1000 && !isElite;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={stakeAmount}
          onChange={(e) => setStakeAmount(e.target.value)}
          placeholder="Amount of Gold to contribute"
          className="flex-1 glass rounded-xl px-3 py-2 text-white text-xs outline-none placeholder:text-white/30 bg-transparent border border-white/10"
        />
        <button
          disabled={busy || !stakeAmount || Number(stakeAmount) <= 0}
          onClick={() => { onStake(Number(stakeAmount)); setStakeAmount(''); }}
          className="px-4 py-2 rounded-xl font-bold text-xs active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12} />}
          Stake
        </button>
      </div>

      {canUpgrade && (
        <button
          disabled={busy}
          onClick={onUpgrade}
          className="w-full py-2.5 rounded-xl font-black text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
        >
          <Zap size={13} /> Upgrade to Elite (Blue Badge ⭐)
        </button>
      )}
    </div>
  );
}

export function GuildModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('my-guild');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: myGuild,
    isLoading: myGuildLoading,
    isError: myGuildError,
    refetch: refetchMyGuild,
  } = useQuery({
    queryKey: ['my-guild'],
    queryFn: api.getMyGuild,
    staleTime: 30_000,
  });

  const {
    data: guildList = [],
    isLoading: listLoading,
    isError: listError,
    refetch: refetchGuildList,
  } = useQuery({
    queryKey: ['guild-list'],
    queryFn: () => api.listGuilds(),
    staleTime: 60_000,
    enabled: tab === 'browse',
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createGuild(name),
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      setCreating(false);
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const joinMutation = useMutation({
    mutationFn: (guildId: string) => api.joinGuild(guildId),
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
      queryClient.invalidateQueries({ queryKey: ['guild-list'] });
      setTab('my-guild');
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const leaveMutation = useMutation({
    mutationFn: api.leaveGuild,
    onSuccess: () => {
      setResult('✅ Left guild successfully');
      queryClient.setQueryData(['my-guild'], null);
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
      queryClient.invalidateQueries({ queryKey: ['guild-list'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const waterMutation = useMutation({
    mutationFn: (guildId?: string) => api.waterGuildTree(guildId),
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const buyShieldMutation = useMutation({
    mutationFn: api.buyGuildShield,
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const claimTreeMutation = useMutation({
    mutationFn: api.claimTreeReward,
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const raidMutation = useMutation({
    mutationFn: (targetGuildId: string) => api.raidGuildTree(targetGuildId),
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['guild-list'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const setTaxMutation = useMutation({
    mutationFn: (rate: number) => api.setGuildTaxRate(rate),
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const stakeMutation = useMutation({
    mutationFn: (amount: number) => api.stakeToGuild(amount),
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const upgradeMutation = useMutation({
    mutationFn: api.upgradeToElite,
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const autoCompoundMutation = useMutation({
    mutationFn: api.autoCompoundGuild,
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const busy =
    createMutation.isPending || joinMutation.isPending || leaveMutation.isPending ||
    waterMutation.isPending || buyShieldMutation.isPending || autoCompoundMutation.isPending ||
    claimTreeMutation.isPending || raidMutation.isPending || setTaxMutation.isPending ||
    stakeMutation.isPending || upgradeMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end px-7 py-2"
      style={{ paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 32px)) + 100px)' }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl glass mx-auto rounded-3xl overflow-hidden slide-up flex flex-col border border-white/15"
        style={{ maxHeight: 'calc(var(--tg-viewport-stable-height, 100vh) - 110px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Shield size={18} />
            </div>
            <div>
              <h2 className="text-white font-black text-base leading-none">Social-Fi Guilds</h2>
              <p className="text-white/40 text-[11px] mt-0.5">World Tree • Stake $FARM • GvG PvP</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 px-5 mb-3">
          <div className="glass rounded-2xl flex p-1 gap-1 border border-white/10">
            {(['my-guild', 'browse', 'raid-radar'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  tab === t ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {t === 'my-guild' ? <><Crown size={12} /> My Guild</> : t === 'browse' ? <><Users size={12} /> Leaderboard</> : <><Swords size={12} /> GvG Raids</>}
              </button>
            ))}
          </div>
        </div>

        {result && (
          <div className="mx-5 mb-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/80 flex items-center justify-between">
            <span>{result}</span>
            <button onClick={() => setResult(null)} className="text-white/40 hover:text-white ml-2">✕</button>
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {tab === 'my-guild' && (
            <>
              {myGuildLoading && <div className="text-center py-10 text-white/40 text-sm">Loading guild info...</div>}

              {myGuildError && (
                <div className="flex flex-col items-center py-10 gap-3 text-center">
                  <AlertCircle size={32} className="text-red-400/80" />
                  <p className="text-red-400/90 text-sm font-semibold">Failed to load guild info</p>
                  <button
                    onClick={() => refetchMyGuild()}
                    className="glass px-4 py-2 rounded-xl text-xs text-white/80 active:scale-95 transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {!myGuildLoading && !myGuildError && !myGuild && !creating && (
                <div className="flex flex-col items-center py-12 gap-4 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-3xl">
                    🏰
                  </div>
                  <div>
                    <p className="text-white font-black text-base">You haven't joined a Guild yet</p>
                    <p className="text-white/40 text-xs mt-1 max-w-xs">
                      Create a Free Guild or join one to care for the World Tree and earn $FARM!
                    </p>
                  </div>
                  <div className="flex gap-2 w-full max-w-xs">
                    <button
                      onClick={() => { setCreating(true); setResult(null); }}
                      className="flex-1 py-3 rounded-2xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                    >
                      <Plus size={14} /> Create Guild (Free)
                    </button>
                    <button
                      onClick={() => setTab('browse')}
                      className="flex-1 py-3 rounded-2xl glass text-white/80 text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-white/10"
                    >
                      <LogIn size={14} /> Browse Guilds
                    </button>
                  </div>
                </div>
              )}

              {creating && (
                <div className="flex flex-col gap-3 mt-2 glass p-5 rounded-2xl border border-blue-500/20">
                  <div>
                    <p className="text-white font-black text-sm">Create New Guild (Free)</p>
                    <p className="text-white/40 text-xs mt-0.5">Free Guild has 0 fee to create. Upgrade to Elite once 1,000 $FARM is staked.</p>
                  </div>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter guild name (max 100 characters)"
                    maxLength={100}
                    className="glass rounded-2xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/30 bg-transparent border border-white/10"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={busy || newName.trim().length < 2}
                      onClick={() => { setResult(null); createMutation.mutate(newName.trim()); }}
                      className="flex-1 py-3 rounded-2xl text-xs font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      Create Guild — Free
                    </button>
                    <button onClick={() => setCreating(false)} className="glass px-4 py-3 rounded-2xl text-white/50 text-xs font-bold">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!myGuildLoading && !myGuildError && myGuild && (
                <MyGuildView
                  guild={myGuild}
                  onLeave={() => leaveMutation.mutate()}
                  onStake={(amount) => { setResult(null); stakeMutation.mutate(amount); }}
                  onUpgrade={() => { setResult(null); upgradeMutation.mutate(); }}
                  onWater={() => { setResult(null); waterMutation.mutate(); }}
                  onBuyShield={() => { setResult(null); buyShieldMutation.mutate(); }}
                  onAutoCompound={() => { setResult(null); autoCompoundMutation.mutate(); }}
                  onClaimTree={() => { setResult(null); claimTreeMutation.mutate(); }}
                  onSetTax={(rate) => { setResult(null); setTaxMutation.mutate(rate); }}
                  busy={busy}
                />
              )}
            </>
          )}

          {tab === 'browse' && (
            <div className="flex flex-col gap-2.5">
              {listLoading && <div className="text-center py-10 text-white/40 text-sm">Loading guilds...</div>}

              {listError && (
                <div className="flex flex-col items-center py-10 gap-3 text-center">
                  <AlertCircle size={32} className="text-red-400/80" />
                  <p className="text-red-400/90 text-sm font-semibold">Failed to load guilds</p>
                  <button
                    onClick={() => refetchGuildList()}
                    className="glass px-4 py-2 rounded-xl text-xs text-white/80 active:scale-95 transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {!listLoading && !listError && guildList.length === 0 && (
                <div className="flex flex-col items-center py-14 gap-3 text-center">
                  <Shield size={36} className="text-white/20" />
                  <p className="text-white/40 text-sm">No guilds found yet. Be the first to create one!</p>
                </div>
              )}

              {!listLoading && !listError && guildList.map((g) => (
                <GuildCard
                  key={g.id}
                  guild={g}
                  busy={busy}
                  isMyGuild={!!myGuild && myGuild.id === g.id}
                  alreadyInGuild={!!myGuild}
                  onJoin={() => { setResult(null); joinMutation.mutate(g.id); }}
                  onRaid={() => { setResult(null); raidMutation.mutate(g.id); }}
                />
              ))}
            </div>
          )}

          {tab === 'raid-radar' && (
            <div className="flex flex-col gap-2.5">
              <div className="glass rounded-xl p-3 mb-1 border border-red-500/25 bg-red-500/5">
                <p className="text-white text-xs font-black flex items-center gap-1.5">
                  <Swords size={14} className="text-red-400" />
                  GvG Raid Radar — Siphon Enemy World Trees
                </p>
                <p className="text-white/50 text-[10px] mt-0.5 leading-tight">
                  Raid ripe World Trees from rival guilds to siphon 15% of their accumulated $FARM &amp; GOLD dividends! Shielded guilds repel all raids.
                </p>
              </div>

              {listLoading && <div className="text-center py-10 text-white/40 text-sm">Scanning rival trees...</div>}

              {!listLoading && !listError && (() => {
                const raidTargets = guildList.filter((g) => g.id !== myGuild?.id);
                if (raidTargets.length === 0) {
                  return (
                    <div className="flex flex-col items-center py-12 gap-3 text-center">
                      <Swords size={32} className="text-white/20" />
                      <p className="text-white/40 text-xs">No rival guilds found on radar</p>
                    </div>
                  );
                }
                return raidTargets.map((g) => (
                  <RaidGuildCard
                    key={g.id}
                    guild={g}
                    onRaid={() => { setResult(null); raidMutation.mutate(g.id); }}
                    busy={busy}
                  />
                ));
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
