import { useState } from 'react';
import {
  Users, Copy, Share2, Search, Key, Sparkles, Trophy,
  CheckCircle2, Flame, Gift, Check, TreePine, ShieldAlert,
} from 'lucide-react';
import WebApp from '@twa-dev/sdk';
import type { ReferralInfo, ReferralCrewMember } from '@/types/game.types';

interface ReferralScreenProps {
  referral?: ReferralInfo;
  isLoading?: boolean;
  onCopy?: () => void;
  onShare?: () => void;
  copied?: boolean;
}

// Fallback mock data when backend query is loading or used in preview mode
const MOCK_CREW: ReferralCrewMember[] = [
  { id: 'm-1', username: 'CryptoFarmer_99', level: 4, isLevel3: true, status: 'Level 3 Reached' },
  { id: 'm-2', username: 'DegenHarvester', level: 3, isLevel3: true, status: 'Level 3 Reached' },
  { id: 'm-3', username: 'BarnRookie_07', level: 2, isLevel3: false, status: 'Grinding' },
];

export function ReferralScreen({
  referral,
  isLoading = false,
  onCopy,
  onShare,
  copied = false,
}: ReferralScreenProps) {
  const [internalCopied, setInternalCopied] = useState(false);

  // Derive active values or fallback to mock
  const isLaunchEvent = referral?.isLaunchEventActive ?? true;
  const magnifierMultiplier = referral?.magnifierMultiplier ?? (isLaunchEvent ? 2 : 1);
  const guildBoost = referral?.guildWaterBoost ?? (isLaunchEvent ? 10 : 5);
  const referralCount = referral?.referralCount ?? 0;
  const bonusEarned = referral?.bonusEarned ?? (referralCount * 120);
  const bonusPerReferral = referral?.bonusPerReferral ?? 120;
  const magnifiersEarned = referral?.magnifiersEarned ?? (referralCount * magnifierMultiplier);
  const masterKeysEarned = referral?.masterKeysEarned ?? 0;

  const crew = referral?.crew ?? (referralCount === 0 ? [] : MOCK_CREW);
  const level3Count = referral?.level3FriendsCount ?? crew.filter(c => c.isLevel3).length;
  const masterKeyProgress = referral?.masterKeyProgress ?? (level3Count % 3);

  const inviteLink = referral?.inviteLink ?? 'https://t.me/BanditBuddyBot?startapp=ref_preview';
  const shareText = referral?.shareText ?? '🥷 Join me in Bandit Buddy! Plant crops, steal from friends & earn $FARM. Use my link:';

  const handleCopyLink = () => {
    if (onCopy) {
      onCopy();
      return;
    }
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInternalCopied(true);
      setTimeout(() => setInternalCopied(false), 2000);
    });
  };

  const handleShareInvite = () => {
    if (onShare) {
      onShare();
      return;
    }
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`;
    try {
      WebApp.openTelegramLink(shareUrl);
    } catch {
      navigator.clipboard.writeText(`${shareText}\n${inviteLink}`);
      setInternalCopied(true);
      setTimeout(() => setInternalCopied(false), 2000);
    }
  };

  const isCopied = copied || internalCopied;

  return (
    <div className="flex flex-col gap-3.5 pb-2 text-white">
      {/* ── 1. Hero Header & Launch Event Ribbon ──────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl p-4 border border-emerald-500/30 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(6, 78, 59, 0.35) 50%, rgba(15, 23, 42, 0.6) 100%)',
        }}
      >
        {isLaunchEvent && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-sm">
            <Flame size={12} className="text-amber-400 fill-amber-400" />
            <span>2X LAUNCH EVENT</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 text-2xl flex-shrink-0 shadow-inner">
            🥷
          </div>
          <div>
            <h3 className="font-black text-base text-white tracking-wide flex items-center gap-1.5">
              Build Your Farming Cartel
            </h3>
            <p className="text-emerald-300/80 text-xs mt-0.5">
              Recruit friends to unlock stealth gear, master keys & guild boosts!
            </p>
          </div>
        </div>

        {/* Action Share Buttons */}
        <div className="grid grid-cols-5 gap-2 mt-4">
          <button
            onClick={handleShareInvite}
            className="col-span-3 py-3 px-3 rounded-2xl font-black text-xs text-white flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
            }}
          >
            <Share2 size={15} />
            <span>Invite via Telegram</span>
          </button>

          <button
            onClick={handleCopyLink}
            className={`col-span-2 py-3 px-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all border cursor-pointer ${
              isCopied
                ? 'bg-emerald-500/30 border-emerald-400/50 text-emerald-300'
                : 'bg-white/10 hover:bg-white/15 border-white/15 text-white/90'
            }`}
          >
            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{isCopied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Stat Overview ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 text-center backdrop-blur-sm">
          <div className="text-xs text-white/50 flex items-center justify-center gap-1">
            <Users size={12} className="text-emerald-400" /> Recruits
          </div>
          <div className="text-lg font-black text-white mt-0.5">{referralCount}</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 text-center backdrop-blur-sm">
          <div className="text-xs text-white/50 flex items-center justify-center gap-1">
            <Gift size={12} className="text-amber-400" /> Gold Earned
          </div>
          <div className="text-lg font-black text-amber-300 mt-0.5">{bonusEarned}G</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 text-center backdrop-blur-sm">
          <div className="text-xs text-white/50 flex items-center justify-center gap-1">
            <Key size={12} className="text-violet-400" /> Keys Earned
          </div>
          <div className="text-lg font-black text-violet-300 mt-0.5">{masterKeysEarned}</div>
        </div>
      </div>

      {/* ── 3. Reward Milestones (The Core Hooks) ────────────────── */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-white/70 tracking-wider uppercase flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-400" /> Milestone Rewards
          </span>
          <span className="text-[11px] text-white/40 font-medium">Automatic claim</span>
        </div>

        {/* Hook 1: Magnifying Glass Referral Hook (PVP-03) */}
        <div
          className="rounded-2xl p-3.5 border transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(30, 58, 138, 0.2) 100%)',
            borderColor: 'rgba(96, 165, 250, 0.25)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 text-lg flex-shrink-0">
              🔍
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-blue-200 flex items-center gap-1.5">
                  Instant Scout Hook
                  {isLaunchEvent && (
                    <span className="bg-amber-500/20 text-amber-300 text-[9px] font-black px-1.5 py-0.2 rounded border border-amber-500/30">
                      2X BOOST
                    </span>
                  )}
                </p>
                <span className="text-[11px] font-bold text-blue-300/80">
                  {referralCount > 0 ? `${referralCount} Friend${referralCount > 1 ? 's' : ''}` : '0/1 Friend'}
                </span>
              </div>
              <p className="text-white/60 text-[11px] mt-0.5">
                Invite 1 friend = get <span className="text-amber-300 font-bold">{magnifierMultiplier} Magnifying Glass{magnifierMultiplier > 1 ? 'es' : ''}</span> 🔍 to unmask raiders & trigger revenge raids!
              </p>

              {/* Visual Progress Bar */}
              <div className="w-full h-1.5 bg-blue-950/60 rounded-full mt-2.5 overflow-hidden border border-blue-500/20">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500 rounded-full"
                  style={{ width: `${referralCount >= 1 ? 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Hook 2: Master Key Level-Up Hook (PVP-04) */}
        <div
          className="rounded-2xl p-3.5 border transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(88, 28, 135, 0.22) 100%)',
            borderColor: 'rgba(192, 132, 252, 0.28)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 text-lg flex-shrink-0">
              🗝️
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-purple-200">
                  Master Key Hook (Level 3)
                </p>
                <span className="text-[11px] font-bold text-purple-300">
                  {masterKeyProgress}/3 Friends
                </span>
              </div>
              <p className="text-white/60 text-[11px] mt-0.5">
                3 friends reach <span className="text-purple-300 font-bold">Level 3</span> = get <span className="text-amber-300 font-bold">1 Master Key</span> to bypass guard dog defenses!
              </p>

              {/* Segmented 3-Bar Progress Indicator */}
              <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                {[0, 1, 2].map((idx) => {
                  const isFilled = masterKeyProgress > idx;
                  return (
                    <div
                      key={idx}
                      className={`h-2 rounded-full transition-all duration-500 border ${
                        isFilled
                          ? 'bg-gradient-to-r from-purple-500 to-fuchsia-400 border-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.5)]'
                          : 'bg-purple-950/40 border-purple-800/30'
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-white/40 text-[10px] mt-1.5 text-right">
                Total Level 3 Friends: <span className="text-white/70 font-semibold">{level3Count}</span>
                {masterKeyProgress === 2 && ' · 1 friend away from next Master Key!'}
              </p>
            </div>
          </div>
        </div>

        {/* Hook 3: World Tree First-Water Booster (GUILD-03) */}
        <div
          className="rounded-2xl p-3 border"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(120, 53, 15, 0.2) 100%)',
            borderColor: 'rgba(251, 191, 36, 0.25)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 text-lg flex-shrink-0">
              🌲
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-amber-200 flex items-center gap-1">
                  Guild World Tree Boost
                </p>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-amber-500/30">
                  +{guildBoost}% GROWTH
                </span>
              </div>
              <p className="text-white/60 text-[11px] mt-0.5">
                When your recruits water any Guild Tree for the first time, they grant <span className="text-amber-300 font-bold">+{guildBoost}%</span> instant growth (normally +1%)!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. "My Crew" List (Invited Friends) ───────────────────── */}
      <div className="flex flex-col gap-2 mt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-white/70 tracking-wider uppercase flex items-center gap-1.5">
            <Users size={13} className="text-emerald-400" /> My Crew ({crew.length})
          </span>
          <span className="text-[11px] text-white/40">
            {level3Count} at Level 3+
          </span>
        </div>

        {crew.length === 0 ? (
          <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-1.5">🤝</div>
            <p className="text-white/60 text-xs font-bold">No crew members yet</p>
            <p className="text-white/30 text-[11px] mt-0.5">
              Share your link above to build your squad and start racking up rewards!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {crew.map((member) => (
              <div
                key={member.id}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-2.5 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                      member.isLevel3
                        ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-sm'
                        : 'bg-white/10 text-white/70'
                    }`}
                  >
                    {(member.username[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-bold truncate">
                      @{member.username}
                    </p>
                    <p className="text-white/40 text-[10px]">
                      Player Level {member.level}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {member.isLevel3 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      <CheckCircle2 size={11} className="text-purple-400" />
                      Lvl 3 Reached
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/15">
                      Grinding (Lv.{member.level}/3)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Passive referral note */}
      <p className="text-white/30 text-[10px] text-center mt-1">
        💡 You receive +{bonusPerReferral} GOLD instantly for every friend who joins. Recruits get +{bonusPerReferral} GOLD starting bonus.
      </p>
    </div>
  );
}
