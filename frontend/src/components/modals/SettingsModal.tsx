import { useState, useEffect } from 'react';
import {
  X, Wallet, Shield, Copy, Check, Volume2, VolumeX, Music, Music2,
  Smartphone, Bell, BellOff, Eye, EyeOff, KeyRound,
  Coins, Flame, LayoutGrid, Swords, Gift, ExternalLink,
  ChevronDown, ChevronUp, Info, Trophy, ChevronRight, Maximize2, RefreshCw, Wheat, Sprout,
} from 'lucide-react';
import { AchievementModal } from '@/components/modals/AchievementModal';
import { useFullscreen } from '@/hooks/useFullscreen';
import { privateKeyToAccount } from 'viem/accounts';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useGame } from '@/providers/GameProvider';
import { api } from '@/api/client';
import { getStoredWalletPk } from '@/hooks/useAutoWallet';
import { bgmManager, soundManager } from '@/sounds/SoundManager';
import WebApp from '@twa-dev/sdk';
import type { NftBreed } from '@/types/game.types';

interface Props { onClose: () => void }

const STORAGE_KEY = 'bb_settings';
function loadSettings() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; } }
function saveSettings(patch: Record<string, unknown>) { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSettings(), ...patch })); }

// ── Small helpers ────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mb-3">
      <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-1 mb-1.5">{title}</p>
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
  return (
    <button
      onClick={() => onChange(!value)}
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

// ── Main modal ────────────────────────────────────────────────────
export function SettingsModal({ onClose }: Props) {
  const { profile } = useGame();
  const queryClient = useQueryClient();

  const saved = loadSettings();
  const [sound,         setSound]         = useState<boolean>(saved.sound    ?? true);
  const [music,         setMusic]         = useState<boolean>(saved.music    ?? true);
  const [musicVol,      setMusicVol]      = useState<number>(saved.musicVol  ?? 0.4);
  const [haptic,        setHaptic]        = useState<boolean>(saved.haptic   ?? true);
  const [notifications, setNotifications] = useState<boolean>(profile?.notificationsEnabled ?? true);
  const [showKey,           setShowKey]           = useState(false);
  const [keyCopied,         setKeyCopied]         = useState(false);
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

  const copyKey = () => {
    if (!storedPk) return;
    navigator.clipboard.writeText(storedPk).then(() => { setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000); });
  };

  const shareInvite = () => {
    if (!referral) return;
    const url = `tg://msg_url?url=${encodeURIComponent(referral.inviteLink)}&text=${encodeURIComponent(referral.shareText)}`;
    WebApp.openTelegramLink(url);
  };

  const level  = Math.max(1, Math.floor((profile?.trustScore ?? 0) / 10));
  const gold   = Math.floor(profile?.goldBalance ?? 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up flex flex-col"
        style={{ maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <h2 className="text-white font-black text-base">Profile & Settings</h2>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pb-8">
          {/* ── Hero profile card ── */}
          <div className="mx-4 mb-4 glass rounded-2xl p-4">
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
              <StatCard icon={<Swords size={13} className="text-red-400" />} value={profile?.goldStolen != null ? (profile.goldStolen >= 1000 ? `${(profile.goldStolen/1000).toFixed(1)}k` : String(Math.floor(profile.goldStolen))) : '0'} label="Stolen G" color="text-red-300" />
              <StatCard icon={<Wheat size={13} className="text-yellow-400" />} value={String(profile?.totalHarvests ?? 0)} label="Harvests" color="text-yellow-300" />
              <StatCard icon={<Sprout size={13} className="text-lime-400" />} value={String(profile?.totalPlants ?? 0)} label="Planted" color="text-lime-300" />
              <StatCard icon={<Flame size={13} className="text-orange-400" />} value={`${profile?.dailyStreak ?? 0}d`} label="Streak" color="text-orange-300" />
            </div>
          </div>

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
                {storedPk && (
                  <>
                    <Row
                      icon={<KeyRound size={15} className="text-amber-400" />}
                      label="Private key"
                      sublabel="Backup this key to recover your wallet"
                      right={
                        <button
                          onClick={() => setShowKey(!showKey)}
                          className="flex items-center gap-1.5 glass rounded-xl px-2.5 py-1.5 text-white/60 text-xs active:scale-95"
                        >
                          {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
                          <span>{showKey ? 'Hide' : 'Reveal'}</span>
                        </button>
                      }
                    />
                    {showKey && (
                      <div className="px-4 pb-3">
                        <div className="glass rounded-xl px-3 py-2.5 flex items-start gap-2">
                          <span className="flex-1 text-white/50 text-[10px] font-mono break-all leading-relaxed">{storedPk}</span>
                          <button onClick={copyKey} className="flex-shrink-0 text-white/40 hover:text-white active:scale-90 transition-all mt-0.5">
                            {keyCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                        <p className="text-amber-400/60 text-[9px] mt-1.5 leading-relaxed">
                          ⚠️ Never share this key. Anyone with it can access your tokens.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="px-4 py-3 text-white/30 text-sm text-center">Wallet loading…</div>
            )}
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

          {/* ── Achievements ── */}
          <Section title="Progress">
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

          {/* ── Trust score ── */}
          <div className="mx-4 mb-3 glass rounded-2xl overflow-hidden divide-y divide-white/5">
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
