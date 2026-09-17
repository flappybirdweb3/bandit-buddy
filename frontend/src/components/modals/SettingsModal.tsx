import { useState, useEffect } from 'react';
import {
  X, Wallet, Shield, Copy, Check, Volume2, VolumeX, Music, Music2,
  Smartphone, Bell, BellOff,
  Coins, Flame, LayoutGrid, Swords, Gift, ExternalLink,
  ChevronDown, ChevronUp, Info, Trophy, ChevronRight, Maximize2, RefreshCw, Wheat, Sprout,
  BookOpen, Send, MessageCircle, FileText, Sparkles,
} from 'lucide-react';
import { AchievementModal } from '@/components/modals/AchievementModal';
import { useFullscreen } from '@/hooks/useFullscreen';
import { privateKeyToAccount } from 'viem/accounts';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useGame } from '@/providers/GameProvider';
import { api } from '@/api/client';
import { eventBus } from '@/game/EventBus';
import { useCashoutQuota } from '@/hooks/useCashoutQuota';
import { getStoredWalletPk } from '@/hooks/useAutoWallet';
import { bgmManager, soundManager } from '@/sounds/SoundManager';
import WebApp from '@twa-dev/sdk';
import type { NftBreed, CashoutQuota, UserProfile } from '@/types/game.types';

interface Props { onClose: () => void }

const FARM_TOKEN_ADDRESS = import.meta.env.VITE_FARM_TOKEN_ADDRESS || '0xB10067A034078E3FC8335Fb003eEF7334C44952f';
const NFT_CONTRACT_ADDRESS = '0x67dd94bAb17F6584d409816fee1EDD5612e7caEa';

const STORAGE_KEY = 'bb_settings';
function loadSettings() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; } }
function saveSettings(patch: Record<string, unknown>) { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSettings(), ...patch })); }

// ── Small helpers ────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-2 mb-3">
      <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest px-1 mb-1.5">{title}</p>
      <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Row({ icon, label, sublabel, right }: { icon: React.ReactNode; label: string; sublabel?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-white/70 text-sm leading-tight">{label}</p>
        {sublabel && <p className="text-white/30 text-[10px] mt-0.5 leading-snug">{sublabel}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const handle = () => {
    try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
    onChange(!value);
  };
  return (
    <button
      type="button"
      onClick={handle}
      className={`w-11 h-6 rounded-full transition-all relative active:scale-95 ${value ? 'bg-green-500' : 'bg-white/15'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function CopyButton({ text, short }: { text: string; short?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={handle} className="flex items-center gap-1.5 glass rounded-xl px-2.5 py-1.5 text-white/60 text-xs active:scale-95 transition-all">
      <span className="font-mono">{short ?? text}</span>
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
    </button>
  );
}

// ── Trust score card with explanation ────────────────────────────
const MAX_TRUST = 200;

function TrustScoreCard({ score }: { score: number }) {
  const [expanded, setExpanded] = useState(false);
  const level   = Math.max(1, Math.floor(score / 10));
  const pct     = Math.min(100, Math.round((score / MAX_TRUST) * 100));
  const color   = score >= 100 ? 'bg-green-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';
  const label   = score >= 100 ? 'Good standing' : score >= 50 ? 'Moderate' : 'Low — claim locked';

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <Shield size={15} className={score >= 100 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'} />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/70 text-sm">Trust Score</span>
            <span className="text-white/60 text-xs font-bold">
              Lv {level} · {score}/{MAX_TRUST} · {label}
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-white/30 active:scale-90">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {expanded && (
        <div className="glass rounded-xl p-3 text-[11px] text-white/40 leading-relaxed space-y-1.5 animate-fade-in-up">
          <p><span className="text-green-400">↑ Increases:</span> Daily login (+2), harvests (+1), invite friends (+5)</p>
          <p><span className="text-red-400">↓ Decreases:</span> Failed steal attempts (−1), suspicious rapid actions (−5)</p>
          <p><span className="text-violet-400">🔒 Claim requires:</span> Trust score ≥ 30 to claim $FARM tokens</p>
          <p><span className="text-amber-400">⭐ Level = score ÷ 10</span> — max level 20 at score 200</p>
        </div>
      )}
    </div>
  );
}

// ── Farmer Tier & Daily Cashout Quota Section ────────────────────
function FarmerTierCashoutSection({
  quota,
  loading,
  profile,
}: {
  quota?: CashoutQuota;
  loading: boolean;
  profile?: UserProfile;
}) {
  const [showTiersDetail, setShowTiersDetail] = useState(false);

  if (loading || !quota) {
    return (
      <div className="mx-4 mb-4 glass rounded-2xl p-4 animate-pulse bg-white/5 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-white/10 rounded w-1/3"></div>
          <div className="h-4 bg-white/10 rounded w-1/4"></div>
        </div>
        <div className="h-8 bg-white/5 rounded-xl w-full"></div>
      </div>
    );
  }

  const currentTier = quota.tier;
  const userDailyLimit = quota.userDailyLimit || 0;
  const userSpent = quota.userSpentToday || 0;
  const userRemaining = quota.userRemaining || 0;
  const usedPct = userDailyLimit > 0 ? Math.min(100, Math.max(0, Math.round((userSpent / userDailyLimit) * 100))) : 0;

  // Theme per Tier
  const tierConfig = ({
    3: {
      emoji: '👑',
      badge: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black',
      border: 'border-amber-400/40',
      gradient: 'from-amber-500/20 via-yellow-500/10 to-amber-950/30',
      accent: 'text-amber-300',
      barColor: 'from-amber-400 to-yellow-500',
      tag: 'VIP / Whale',
    },
    2: {
      emoji: '⭐',
      badge: 'bg-gradient-to-r from-purple-400 to-violet-500 text-white',
      border: 'border-purple-400/40',
      gradient: 'from-purple-500/20 via-violet-500/10 to-indigo-950/30',
      accent: 'text-purple-300',
      barColor: 'from-purple-400 to-violet-500',
      tag: 'Dedicated Farmer',
    },
    1: {
      emoji: '🌱',
      badge: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-black',
      border: 'border-emerald-400/40',
      gradient: 'from-emerald-500/20 via-teal-500/10 to-emerald-950/30',
      accent: 'text-emerald-300',
      barColor: 'from-emerald-400 to-teal-500',
      tag: 'Novice Farmer',
    },
    0: {
      emoji: '⚠️',
      badge: 'bg-zinc-600 text-zinc-200',
      border: 'border-zinc-600/40',
      gradient: 'from-zinc-700/20 to-zinc-900/40',
      accent: 'text-zinc-400',
      barColor: 'from-zinc-500 to-zinc-600',
      tag: 'Unverified / Guest',
    },
  } as const)[currentTier as 0 | 1 | 2 | 3] ?? {
    emoji: '🌱',
    badge: 'bg-emerald-500 text-black',
    border: 'border-emerald-500/40',
    gradient: 'from-emerald-500/20 to-teal-950/30',
    accent: 'text-emerald-300',
    barColor: 'from-emerald-400 to-teal-500',
    tag: 'Farmer',
  };

  const tierRoadmap = [
    {
      tier: 0,
      name: 'Tier 0: Guest / Bot Suspect',
      percent: '0.00%',
      limitDesc: '0 $FARM / day',
      req: 'Unlinked BSC wallet or Trust Score < 30',
      color: 'border-zinc-600/30 bg-zinc-800/30',
    },
    {
      tier: 1,
      name: 'Tier 1: Novice Farmer',
      percent: '0.05%',
      limitDesc: `${(quota.globalDailyPool * 0.0005).toFixed(0)} $FARM / day`,
      req: 'Linked BSC wallet + Trust Score ≥ 30',
      color: 'border-emerald-500/30 bg-emerald-950/20',
    },
    {
      tier: 2,
      name: 'Tier 2: Dedicated Farmer',
      percent: '0.20%',
      limitDesc: `${(quota.globalDailyPool * 0.0020).toFixed(0)} $FARM / day`,
      req: 'Level ≥ 5 OR Trust Score ≥ 60',
      color: 'border-purple-500/30 bg-purple-950/20',
    },
    {
      tier: 3,
      name: 'Tier 3: Elite Whale / VIP',
      percent: '2.00%',
      limitDesc: `${(quota.globalDailyPool * 0.0200).toFixed(0)} $FARM / day`,
      req: 'Level ≥ 10 OR Trust Score ≥ 80',
      color: 'border-amber-500/30 bg-amber-950/20',
    },
  ];

  return (
    <div className="mx-2 mb-3">
      <div className="flex items-center justify-between px-1 mb-1.5">
        <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">
          Farmer Level Tier &amp; Cashout Quota
        </p>
        <button
          onClick={() => setShowTiersDetail(!showTiersDetail)}
          className="text-amber-400 hover:text-amber-300 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95"
        >
          <span>{showTiersDetail ? 'Hide Rules' : 'Tier Benefits'}</span>
          {showTiersDetail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      <div className={`glass rounded-2xl p-4 border bg-gradient-to-br ${tierConfig.gradient} ${tierConfig.border} shadow-xl relative overflow-hidden`}>
        {/* Glow orb */}
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        {/* Header with Player Tier & Allowance */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-xl shadow-inner flex-shrink-0">
              {tierConfig.emoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${tierConfig.badge}`}>
                  Tier {quota.tier}
                </span>
                <span className="text-white font-black text-sm">{quota.tierName}</span>
              </div>
              <p className="text-white/50 text-[10px] mt-0.5">
                Daily allowance: <span className="text-white font-mono font-bold">{(quota.tierPercentage * 100).toFixed(2)}%</span> of Global Pool
              </p>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-xs font-mono font-black text-white">
              {userRemaining.toFixed(1)} <span className="text-white/40 text-[10px] font-normal">FARM left</span>
            </div>
            <p className="text-[9px] text-white/40 font-mono">Max {userDailyLimit.toFixed(0)}/day</p>
          </div>
        </div>

        {/* Progress Bar with Real-time Counters */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/60 font-medium">Daily Limit Spent:</span>
            <span className="font-mono text-white text-xs">
              <span className={userSpent > 0 ? 'text-amber-300 font-bold' : 'text-white/50'}>
                {userSpent.toFixed(2)}
              </span>
              <span className="text-white/30"> / </span>
              <span className="text-white font-bold">{userDailyLimit.toFixed(2)} $FARM</span>
              <span className="text-white/40 text-[10px] ml-1.5">({usedPct}%)</span>
            </span>
          </div>

          <div className="w-full bg-black/50 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10 shadow-inner">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${tierConfig.barColor} transition-all duration-500`}
              style={{ width: `${Math.max(usedPct > 0 ? 5 : 0, usedPct)}%` }}
            />
          </div>
        </div>

        {/* Server Global Drip-Feed Pool Status */}
        <div className="glass rounded-xl px-3 py-2 border border-white/5 flex items-center justify-between text-[10px] mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-white/40">Global Pool Today:</span>
            <span className="text-white font-mono font-bold">
              {quota.globalRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {quota.globalDailyPool.toLocaleString(undefined, { maximumFractionDigits: 0 })} $FARM
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-emerald-400">R = {(quota.releaseRate * 100).toFixed(1)}%</span>
            <span className="text-white/30">|</span>
            <span className="text-white/50">Reset 00:00 UTC</span>
          </div>
        </div>

        {/* Next Tier Upgrade Hint */}
        {quota.tier < 3 && (
          <div className="mt-2 text-[10px] text-white/50 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>🚀 Next:</span>
              <span className="text-white/80 font-semibold">Tier {quota.tier + 1}</span>
              <span className="text-white/40">
                ({quota.tier === 0 ? 'Connect wallet & Trust 30+' : quota.tier === 1 ? 'Reach Level 5 or Trust 60+' : 'Reach Level 10 or Trust 80+'})
              </span>
            </span>
            <span className="text-amber-400 font-mono font-bold">
              +{quota.tier === 0 ? '50' : quota.tier === 1 ? '150' : '1,800'} FARM/d
            </span>
          </div>
        )}

        {/* Expandable Tier Benefits Table */}
        {showTiersDetail && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-2 animate-fade-in-up">
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1.5">
              Dual-Layer Protection &amp; Tier Rules
            </p>
            {tierRoadmap.map((t) => {
              const isCurrent = t.tier === quota.tier;
              return (
                <div
                  key={t.tier}
                  className={`rounded-xl p-2.5 border transition-all ${t.color} ${
                    isCurrent ? 'ring-2 ring-white/30 shadow-md' : 'opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{t.name}</span>
                      {isCurrent && (
                        <span className="bg-white/20 text-white font-bold text-[8px] px-1.5 py-0.2 rounded-full uppercase">
                          Current Tier
                        </span>
                      )}
                    </div>
                    <span className="text-white font-mono font-bold text-xs">{t.limitDesc}</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-white/50">
                    <span>{t.req}</span>
                    <span className="font-mono text-white/40">{t.percent} pool share</span>
                  </div>
                </div>
              );
            })}
            <p className="text-[9px] text-white/30 italic pt-1 leading-relaxed">
              💡 Limits auto-reset daily at 00:00 UTC using zero-overhead Redis counters. Quota automatically expands as the global GOLD supply and $FARM token price grow.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────
export function SettingsModal({ onClose }: Props) {
  const { profile } = useGame();
  const queryClient = useQueryClient();
  const { data: quota, isLoading: quotaLoading } = useCashoutQuota(15_000);

  const saved = loadSettings();
  const [sound,         setSound]         = useState<boolean>(saved.sound    ?? true);
  const [music,         setMusic]         = useState<boolean>(saved.music    ?? true);
  const [musicVol,      setMusicVol]      = useState<number>(saved.musicVol  ?? 0.4);
  const [haptic,        setHaptic]        = useState<boolean>(saved.haptic   ?? true);
  const [notifications, setNotifications] = useState<boolean>(profile?.notificationsEnabled ?? true);
  const [showAchievements,  setShowAchievements]  = useState(false);

  const { isFullscreen, supported: fsSupported, toggle: toggleFullscreen, requestFullscreen } = useFullscreen();
  const storedPk     = getStoredWalletPk();
  const walletAddress = profile?.walletAddress ?? (storedPk ? privateKeyToAccount(storedPk).address : null);

  const { data: referral } = useQuery({
    queryKey: ['referral'],
    queryFn: api.getReferral,
    staleTime: 60_000,
  });

  const { data: nftStatus, refetch: refetchNft } = useQuery({
    queryKey: ['nftStatus'],
    queryFn: api.getNftStatus,
    enabled: !!profile?.walletAddress,
    staleTime: 5 * 60_000,
  });

  const syncMutation = useMutation({
    mutationFn: api.syncNft,
    onSuccess: () => { refetchNft(); },
  });

  useEffect(() => { saveSettings({ sound }); },  [sound]);
  useEffect(() => { saveSettings({ haptic }); }, [haptic]);
  useEffect(() => { saveSettings({ music }); },  [music]);
  useEffect(() => { saveSettings({ musicVol }); }, [musicVol]);

  const handleNotifications = async (val: boolean) => {
    setNotifications(val);
    await api.setNotifications(val).catch(() => setNotifications(!val));
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  const handleMusicToggle = (val: boolean) => {
    setMusic(val);
    if (val) {
      const ctx = soundManager.getCtx();
      if (ctx) bgmManager.tryStart(ctx);
    } else {
      bgmManager.stop();
    }
  };

  const handleMusicVol = (val: number) => {
    setMusicVol(val);
    bgmManager.setVolume(val);
    // Auto-start if toggled on via volume
    if (!bgmManager.isPlaying() && music) {
      const ctx = soundManager.getCtx();
      if (ctx) bgmManager.tryStart(ctx);
    }
  };

  const shareInvite = () => {
    if (!referral) return;
    const url = `tg://msg_url?url=${encodeURIComponent(referral.inviteLink)}&text=${encodeURIComponent(referral.shareText)}`;
    WebApp.openTelegramLink(url);
  };

  const level  = Math.max(1, Math.floor((profile?.trustScore ?? 0) / 10));
  const gold   = Math.floor(profile?.goldBalance ?? 0);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-zinc-950/95 border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden mx-auto slide-up p-4 pb-6"
        style={{
          maxHeight: 'calc(var(--tg-viewport-stable-height, 100vh) - 30px)',
          paddingBottom: 'calc(var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 16px)) + 40px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-3 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-2 pt-1 pb-3 flex-shrink-0">
          <h2 className="text-white font-black text-lg">Profile &amp; Settings</h2>
          <button
            onClick={onClose}
            className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-1 pr-2 pb-4 space-y-3">
          {/* ── Hero profile card ── */}
          <div className="mx-2 mb-3 glass rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white font-black text-2xl border-2 border-white/20 flex-shrink-0">
                {(profile?.username ?? 'B')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-lg leading-tight truncate">
                  @{profile?.username ?? 'Unknown'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-green-400/80 bg-green-400/10 rounded-full px-2 py-0.5 border border-green-400/15">
                    🦝 Level {level} Farmer
                  </span>
                  {quota && (
                    <span className={`text-[10px] rounded-full px-2 py-0.5 border font-bold ${
                      quota.tier === 3
                        ? 'text-amber-300 bg-amber-400/15 border-amber-400/30'
                        : quota.tier === 2
                        ? 'text-purple-300 bg-purple-400/15 border-purple-400/30'
                        : quota.tier === 1
                        ? 'text-emerald-300 bg-emerald-400/15 border-emerald-400/30'
                        : 'text-zinc-400 bg-zinc-500/15 border-zinc-500/30'
                    }`}>
                      {quota.tier === 3 ? '👑' : quota.tier === 2 ? '⭐' : quota.tier === 1 ? '🌱' : '⚠️'} Tier {quota.tier}
                    </span>
                  )}
                  <span className="text-[10px] text-amber-400/70 bg-amber-400/10 rounded-full px-2 py-0.5 border border-amber-400/15">
                    🔥 {profile?.dailyStreak ?? 0}d streak
                  </span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={<Coins size={13} className="text-amber-400" />} value={gold >= 1000 ? `${(gold/1000).toFixed(1)}k` : String(gold)} label="GOLD" color="text-amber-300" />
              <StatCard icon={<LayoutGrid size={13} className="text-green-400" />} value={String(profile?.plotCount ?? 0)} label="Plots" color="text-green-300" />
              <StatCard icon={<Swords size={13} className="text-red-400" />} value={profile?.goldStolen != null ? (profile.goldStolen >= 1000 ? `${(profile.goldStolen/1000).toFixed(1)}k` : String(Math.floor(profile.goldStolen))) : '0'} label="Gold Stolen" color="text-red-300" />
              <StatCard icon={<Wheat size={13} className="text-yellow-400" />} value={String(profile?.totalHarvests ?? 0)} label="Harvests" color="text-yellow-300" />
              <StatCard icon={<Sprout size={13} className="text-lime-400" />} value={String(profile?.totalPlants ?? 0)} label="Planted" color="text-lime-300" />
              <StatCard icon={<Flame size={13} className="text-orange-400" />} value={`${profile?.dailyStreak ?? 0}d`} label="Streak" color="text-orange-300" />
            </div>
          </div>

          {/* ── Farmer Tier & Daily Cashout Quota ── */}
          <FarmerTierCashoutSection quota={quota} loading={quotaLoading} profile={profile} />

          {/* ── Referral / Invite ── */}
          {referral && (
            <Section title="Invite Friends">
              <Row
                icon={<Gift size={15} className="text-violet-400" />}
                label={`${referral.referralCount} friend${referral.referralCount !== 1 ? 's' : ''} joined`}
                sublabel={`+${referral.bonusEarned}G earned · +${referral.bonusPerReferral}G per invite`}
                right={
                  <button
                    onClick={shareInvite}
                    className="flex items-center gap-1.5 glass-purple rounded-xl px-2.5 py-1.5 text-violet-300 text-xs font-bold active:scale-95 transition-all"
                  >
                    Share 🦝
                  </button>
                }
              />
              <Row
                icon={<Copy size={15} className="text-white/40" />}
                label="Invite link"
                right={<CopyButton text={referral.inviteLink} short={`…ref_${profile?.telegramId}`} />}
              />
            </Section>
          )}

          {/* ── Wallet ── */}
          <Section title="BSC Wallet">
            {walletAddress ? (
              <>
                <Row
                  icon={<Wallet size={15} className="text-green-400" />}
                  label="Address"
                  sublabel="Auto-generated non-custodial wallet"
                  right={
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://testnet.bscscan.com/address/${walletAddress}`}
                        target="_blank" rel="noreferrer"
                        className="glass rounded-xl p-1.5 text-white/40 active:scale-90"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={11} />
                      </a>
                      <CopyButton text={walletAddress} short={`${walletAddress.slice(0,6)}…${walletAddress.slice(-4)}`} />
                    </div>
                  }
                />
                <button
                  onClick={() => {
                    soundManager.play('click');
                    onClose();
                    eventBus.emit('show-wallet');
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 border-t border-white/5 hover:bg-white/5 active:bg-white/10 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center">
                      <Wallet size={14} />
                    </div>
                    <div>
                      <p className="text-white text-xs font-bold">Open Web3 Keyless Wallet</p>
                      <p className="text-white/40 text-[10px]">Manage assets, send, receive & cloud backups</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-white/30" />
                </button>
              </>
            ) : (
              <div className="px-4 py-3 text-white/30 text-sm text-center">Wallet loading…</div>
            )}
          </Section>

          {/* ── Smart Contracts & Network ── */}
          <Section title="Contracts & Network">
            <Row
              icon={<Coins size={15} className="text-amber-400" />}
              label="$FARM Token"
              sublabel={`${FARM_TOKEN_ADDRESS.slice(0, 7)}...${FARM_TOKEN_ADDRESS.slice(-4)} · BSC Testnet`}
              right={
                <div className="flex items-center gap-1.5">
                  <a
                    href={`https://testnet.bscscan.com/token/${FARM_TOKEN_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="glass rounded-xl p-1.5 text-white/40 hover:text-white active:scale-90"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={11} />
                  </a>
                  <CopyButton text={FARM_TOKEN_ADDRESS} short={`${FARM_TOKEN_ADDRESS.slice(0, 6)}…${FARM_TOKEN_ADDRESS.slice(-4)}`} />
                </div>
              }
            />
            <Row
              icon={<Shield size={15} className="text-violet-400" />}
              label="Guard Dog NFT"
              sublabel="0x67dd9...caEa · ERC-1155"
              right={
                <div className="flex items-center gap-1.5">
                  <a
                    href="https://testnet.bscscan.com/address/0x67dd94bAb17F6584d409816fee1EDD5612e7caEa"
                    target="_blank"
                    rel="noreferrer"
                    className="glass rounded-xl p-1.5 text-white/40 hover:text-white active:scale-90"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={11} />
                  </a>
                  <CopyButton text={NFT_CONTRACT_ADDRESS} short="0x67dd…caEa" />
                </div>
              }
            />
            <Row
              icon={<Info size={15} className="text-blue-400" />}
              label="Network"
              sublabel="Binance Smart Chain Testnet (Chain ID 97)"
            />
          </Section>

          {/* ── NFT Guard Dogs ── */}
          {profile?.walletAddress && (
            <Section title="NFT Guard Dogs">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white/70 text-sm">On-chain guard pets</p>
                    <p className="text-white/30 text-[10px]">BSC Testnet · ERC-1155</p>
                  </div>
                  <button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="flex items-center gap-1.5 glass rounded-xl px-2.5 py-1.5 text-blue-300 text-xs font-bold active:scale-95 transition-all disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={syncMutation.isPending ? 'animate-spin' : ''} />
                    {syncMutation.isPending ? 'Syncing…' : 'Sync'}
                  </button>
                </div>

                {nftStatus && nftStatus.breedCount > 0 ? (
                  <div className="space-y-2">
                    {nftStatus.ownedBreeds.map((breed) => (
                      <NftDogRow key={breed.tokenId} breed={breed} />
                    ))}
                    <div className="glass rounded-xl px-3 py-2 flex items-center justify-between mt-2">
                      <span className="text-white/40 text-[11px]">Total NFT defense</span>
                      <span className="text-amber-300 font-bold text-sm">{nftStatus.totalNftDefense}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-xl px-3 py-3 text-center">
                    <p className="text-white/30 text-xs">No NFT guard dogs found</p>
                    <p className="text-white/20 text-[10px] mt-0.5">Own GuardDogNFT tokens on BSC Testnet to activate</p>
                  </div>
                )}

                {syncMutation.data && (
                  <p className="text-green-400 text-[10px] text-center mt-2">
                    ✓ {syncMutation.data.message}
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* ── Progress & Game Guide ── */}
          <Section title="Progress & Game Guide">
            <button
              onClick={() => setShowAchievements(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-400/15 flex items-center justify-center flex-shrink-0">
                <Trophy size={15} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">Achievements</p>
                <p className="text-white/35 text-[11px]">Badges &amp; milestones</p>
              </div>
              <ChevronRight size={14} className="text-white/30" />
            </button>
            <button
              onClick={() => {
                onClose();
                setTimeout(() => eventBus.emit('show-tutorial'), 150);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-green-400/15 flex items-center justify-center flex-shrink-0">
                <BookOpen size={15} className="text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">Replay Tutorial</p>
                <p className="text-white/35 text-[11px]">Onboarding guide, tips &amp; farm mechanics</p>
              </div>
              <ChevronRight size={14} className="text-white/30" />
            </button>
            <button
              onClick={() => {
                queryClient.invalidateQueries();
                eventBus.emit('show-toast', { message: '🔄 Game data & cache refreshed!', type: 'success' });
                try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success'); } catch {}
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-400/15 flex items-center justify-center flex-shrink-0">
                <RefreshCw size={15} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">Sync &amp; Refresh Data</p>
                <p className="text-white/35 text-[11px]">Reload balances, farm plots, and profile</p>
              </div>
              <ChevronRight size={14} className="text-white/30" />
            </button>
          </Section>

          {/* ── Notifications ── */}
          <Section title="Notifications">
            <Row
              icon={notifications ? <Bell size={15} className="text-green-400" /> : <BellOff size={15} className="text-white/30" />}
              label="Telegram notifications"
              sublabel="Ripe crops, steals, daily rewards"
              right={<Toggle value={notifications} onChange={handleNotifications} />}
            />
          </Section>

          {/* ── Preferences ── */}
          <Section title="Preferences">
            {/* Background music */}
            <Row
              icon={music ? <Music size={15} className="text-violet-400" /> : <Music2 size={15} className="text-white/30" />}
              label="Background music"
              sublabel="Ambient farm melody"
              right={<Toggle value={music} onChange={handleMusicToggle} />}
            />
            {music && (
              <div className="px-4 pb-3 -mt-1">
                <div className="flex items-center gap-3">
                  <VolumeX size={12} className="text-white/25 flex-shrink-0" />
                  <input
                    type="range"
                    min={0} max={1} step={0.05}
                    value={musicVol}
                    onChange={(e) => handleMusicVol(Number(e.target.value))}
                    className="flex-1 h-1.5 accent-violet-400 cursor-pointer"
                  />
                  <Volume2 size={12} className="text-white/40 flex-shrink-0" />
                  <span className="text-white/30 text-[10px] w-7 text-right flex-shrink-0">
                    {Math.round(musicVol * 100)}%
                  </span>
                </div>
              </div>
            )}
            <Row
              icon={sound ? <Volume2 size={15} className="text-amber-400" /> : <VolumeX size={15} className="text-white/30" />}
              label="Sound effects"
              right={<Toggle value={sound} onChange={setSound} />}
            />
            <Row
              icon={<Smartphone size={15} className={haptic ? 'text-amber-400' : 'text-white/30'} />}
              label="Haptic feedback"
              right={<Toggle value={haptic} onChange={(v) => { setHaptic(v); if (v) WebApp.HapticFeedback?.impactOccurred('light'); }} />}
            />
            <Row
              icon={<Maximize2 size={15} className={isFullscreen ? 'text-blue-400' : 'text-white/30'} />}
              label="Fullscreen mode"
              sublabel={
                fsSupported
                  ? isFullscreen ? 'Active — using entire screen' : 'Uses more screen space for gameplay'
                  : 'Tap to expand game to full screen'
              }
              right={
                fsSupported
                  ? <Toggle value={isFullscreen} onChange={toggleFullscreen} />
                  : <button
                      onClick={() => { WebApp.expand(); }}
                      className="glass rounded-xl px-3 py-1.5 text-blue-300 text-xs font-bold active:scale-95 transition-all"
                    >
                      Expand
                    </button>
              }
            />
          </Section>

          {/* ── Official Community & Support ── */}
          <Section title="Community & Support">
            <Row
              icon={<Send size={15} className="text-sky-400" />}
              label="Telegram Announcements"
              sublabel="Official updates, events & patch notes"
              right={
                <button
                  type="button"
                  onClick={() => WebApp.openTelegramLink('https://t.me/banditbuddy_official')}
                  className="flex items-center gap-1 glass rounded-xl px-2.5 py-1.5 text-sky-300 text-xs font-bold active:scale-95 transition-all"
                >
                  Join <ExternalLink size={10} />
                </button>
              }
            />
            <Row
              icon={<MessageCircle size={15} className="text-emerald-400" />}
              label="Global Community Chat"
              sublabel="Chat with fellow farmers & share strategies"
              right={
                <button
                  type="button"
                  onClick={() => WebApp.openTelegramLink('https://t.me/banditbuddy_community')}
                  className="flex items-center gap-1 glass rounded-xl px-2.5 py-1.5 text-emerald-300 text-xs font-bold active:scale-95 transition-all"
                >
                  Chat <ExternalLink size={10} />
                </button>
              }
            />
          </Section>

          {/* ── Trust score ── */}
          <div className="mx-2 mb-3 glass rounded-2xl overflow-hidden divide-y divide-white/5">
            <div className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-4 pt-3 pb-0">Security</div>
            <TrustScoreCard score={profile?.trustScore ?? 0} />
            <Row
              icon={<Info size={15} className="text-blue-400" />}
              label="Telegram ID"
              right={<CopyButton text={String(profile?.telegramId ?? '')} />}
            />
          </div>

          <p className="text-center text-white/15 text-[10px] py-2">
            Bandit Buddy v1.0 · BSC Testnet · 🦝
          </p>
        </div>
      </div>

      {showAchievements && (
        <AchievementModal onClose={() => setShowAchievements(false)} />
      )}
    </div>
  );
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) {
  return (
    <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className={`font-black text-sm ${color}`}>{value}</p>
      <p className="text-white/25 text-[8px] mt-0.5 tracking-wider uppercase">{label}</p>
    </div>
  );
}

const NFT_BREED_INFO: Record<string, { emoji: string; rarity: string; color: string }> = {
  Chihuahua:   { emoji: '🐕', rarity: 'Common',    color: 'text-white/60' },
  Corgi:       { emoji: '🦊', rarity: 'Uncommon',  color: 'text-green-400' },
  Husky:       { emoji: '🐺', rarity: 'Rare',      color: 'text-blue-400' },
  Rottweiler:  { emoji: '🦮', rarity: 'Epic',      color: 'text-violet-400' },
  Doberman:    { emoji: '🐾', rarity: 'Legendary', color: 'text-amber-400' },
  Pitbull:     { emoji: '💀', rarity: 'Mythic',    color: 'text-red-400' },
};

function NftDogRow({ breed }: { breed: NftBreed }) {
  const info = NFT_BREED_INFO[breed.dogType] ?? { emoji: '🐕', rarity: 'Unknown', color: 'text-white/60' };
  return (
    <div className="glass rounded-xl px-3 py-2 flex items-center gap-3">
      <span className="text-xl flex-shrink-0">{info.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-sm font-semibold leading-tight">{breed.dogType}</p>
        <p className={`text-[10px] ${info.color}`}>{info.rarity}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-amber-300 font-bold text-sm">{breed.defensePower}%</p>
        <p className="text-white/30 text-[9px]">defense</p>
      </div>
    </div>
  );
}
