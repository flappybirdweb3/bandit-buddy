import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Settings, Zap, Coins, Bell, X, Gem, Hammer, Maximize2, Minimize2 } from 'lucide-react';
import { WeatherBanner } from '@/components/hud/WeatherBanner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGame } from '@/providers/GameProvider';
import { api } from '@/api/client';
import { useEnergyRegen } from '@/hooks/useEnergyRegen';
import { soundManager } from '@/sounds/SoundManager';
import { eventBus } from '@/game/EventBus';

const SettingsModal         = lazy(() => import('@/components/modals/SettingsModal').then(m => ({ default: m.SettingsModal })));
const NotificationModal     = lazy(() => import('@/components/modals/NotificationModal').then(m => ({ default: m.NotificationModal })));
const AchievementModal      = lazy(() => import('@/components/modals/AchievementModal').then(m => ({ default: m.AchievementModal })));
const FarmMaintenanceModal  = lazy(() => import('@/components/modals/FarmMaintenanceModal').then(m => ({ default: m.FarmMaintenanceModal })));
const WalletDashboardModal  = lazy(() => import('@/components/modals/WalletDashboardModal').then(m => ({ default: m.WalletDashboardModal })));
import { WalletHUD } from '@/components/hud/WalletHUD';


function NotifToast({ title, body, onDismiss }: { title: string; body: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[200] w-[92vw] max-w-sm glass rounded-2xl px-4 py-3 flex items-start gap-3 shadow-xl animate-fade-in-down pointer-events-auto cursor-pointer"
      style={{ top: 'calc(max(8px, var(--tg-safe-area-inset-top, env(safe-area-inset-top, 8px))) + 58px)' }}
      onClick={onDismiss}
    >
      <Bell size={16} className="text-violet-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-bold leading-tight">{title}</p>
        <p className="text-white/50 text-xs mt-0.5 leading-snug">{body}</p>
      </div>
    </div>
  );
}

// ── Energy detail popup ──────────────────────────────────────────
function EnergyPopup({
  energy, maxEnergy, lastEnergyUpdate, onClose, onRefresh,
}: {
  energy: number;
  maxEnergy: number;
  lastEnergyUpdate: string | null | undefined;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const regen = useEnergyRegen(energy, lastEnergyUpdate, maxEnergy);
  const pct   = Math.min(100, Math.round((energy / Math.max(1, maxEnergy)) * 100));
  const isFull = energy >= maxEnergy;

  const barColor =
    pct > 60 ? 'bg-green-400' : pct > 30 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div
      className="fixed z-[199] pointer-events-auto w-72"
      style={{
        top: 'calc(max(8px, var(--tg-safe-area-inset-top, env(safe-area-inset-top, 8px))) + 62px)',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="glass rounded-2xl p-4 shadow-2xl border border-white/10 animate-fade-in-down">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isFull ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
              <Zap size={14} className={isFull ? 'text-green-400' : 'text-amber-400'} />
            </div>
            <span className="text-white font-black text-sm">Energy Reservoir</span>
          </div>
          <button
            onClick={() => {
              soundManager.play('click');
              onClose();
            }}
            className="w-6 h-6 rounded-full glass flex items-center justify-center text-white/40 hover:text-white active:scale-90 transition-all"
          >
            <X size={13} />
          </button>
        </div>

        {/* Big number + bar */}
        <div className="mb-3">
          <div className="flex items-end justify-between mb-1.5">
            <span className={`font-black text-2xl leading-none ${isFull ? 'text-green-400' : 'text-white'}`}>
              {energy}
            </span>
            <span className="text-white/40 text-xs font-semibold">/ {maxEnergy}⚡</span>
          </div>
          <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor} ${isFull ? 'animate-pulse' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Regen info */}
        {isFull ? (
          <div className="flex items-center gap-2 bg-green-500/15 border border-green-400/30 rounded-xl px-3 py-2">
            <span className="text-base">⚡</span>
            <p className="text-green-300 text-xs font-bold">Energy fully charged!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-xl px-3 py-2 text-center border border-white/5">
              <p className="text-white font-black text-sm">{regen.nextTickLabel}</p>
              <p className="text-white/40 text-[10px] mt-0.5 font-medium">Next +1⚡</p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2 text-center border border-white/5">
              <p className="text-amber-300 font-black text-sm">{regen.fullLabel}</p>
              <p className="text-white/40 text-[10px] mt-0.5 font-medium">Full in</p>
            </div>
          </div>
        )}

        {/* Regen rate note */}
        <p className="text-white/30 text-[10px] text-center mt-2.5">
          +1 energy every 4 min (15/hr) • Max {maxEnergy}⚡
        </p>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => {
              soundManager.play('click');
              try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
              onRefresh();
            }}
            className="flex-1 glass rounded-xl py-2 text-white/60 hover:text-white text-xs font-semibold active:scale-95 transition-all"
          >
            Refresh
          </button>
          <button
            onClick={() => {
              soundManager.play('click');
              try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light'); } catch {}
              eventBus.emit('show-shop', { tab: 'energy' });
              onClose();
            }}
            className="flex-1 glass-gold rounded-xl py-2 text-amber-300 text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1 shadow-md"
          >
            <Zap size={12} className="text-amber-400" />
            Get in Shop
          </button>
        </div>
      </div>
    </div>
  );
}

export function HUD({ isDesktop, desktopFullscreen, onToggleDesktopFullscreen }: { isDesktop?: boolean; desktopFullscreen?: boolean; onToggleDesktopFullscreen?: () => void }) {
  const { profile } = useGame();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings]           = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAchievements, setShowAchievements]   = useState(false);
  const [showEnergyPopup, setShowEnergyPopup]     = useState(false);
  const [showMaintenance, setShowMaintenance]     = useState(false);
  const [showWallet, setShowWallet]               = useState(false);
  const [walletInitialTab, setWalletInitialTab]   = useState<'tokens' | 'nfts' | 'defi'>('tokens');
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const prevUnread  = useRef<number>(0);
  const prevEnergy  = useRef<number | null>(null);

  // Block Phaser input whenever a HUD modal or popup is open
  useEffect(() => {
    const open = showSettings || showNotifications || showAchievements || showEnergyPopup || showMaintenance || showWallet;
    eventBus.setOverlay('HUD', open);
  }, [showSettings, showNotifications, showAchievements, showEnergyPopup, showMaintenance, showWallet]);

  // Listen to show-wallet event
  useEffect(() => {
    const unsub = eventBus.on('show-wallet', (data) => {
      if (data && typeof data === 'object' && data.tab) {
        setWalletInitialTab(data.tab);
      } else {
        setWalletInitialTab('tokens');
      }
      setShowWallet(true);
    });
    return unsub;
  }, []);

  const { data: inbox } = useQuery({
    queryKey: ['inbox'],
    queryFn: api.getInbox,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const unreadCount = inbox?.unreadCount ?? 0;

  const { data: buildingStatus } = useQuery({
    queryKey: ['buildings'],
    queryFn: api.getBuildingStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const fenceDurability = buildingStatus?.fenceDurability ?? 100;
  const repairNeeded = !!buildingStatus && (buildingStatus.alertNeeded || fenceDurability < 30);

  // Show toast on new notifications
  useEffect(() => {
    if (unreadCount > prevUnread.current && prevUnread.current >= 0 && !showNotifications) {
      const newest = inbox?.items?.[0];
      if (newest && !newest.isRead) {
        setToast({ title: newest.title, body: newest.body });
      }
    }
    prevUnread.current = unreadCount;
  }, [unreadCount]);

  // Show toast when energy hits max
  useEffect(() => {
    const curr = profile?.energy ?? null;
    const max  = profile?.maxEnergy ?? 100;
    if (
      prevEnergy.current !== null &&
      prevEnergy.current < max &&
      curr !== null && curr >= max
    ) {
      soundManager.play('coin');
      setToast({ title: '⚡ Energy full!', body: 'Ready to plant and raid!' });
    }
    prevEnergy.current = curr;
  }, [profile?.energy]);

  // Level-up toast
  useEffect(() => {
    const unsub = eventBus.on('level-up', ({ newLevel }) => {
      soundManager.play('level_up');
      setToast({ title: `⭐ Level Up! Now Level ${newLevel}`, body: newLevel >= 6 ? `New seeds unlocked at level ${newLevel}!` : 'Keep farming to unlock higher-tier crops!' });
    });
    return unsub;
  }, []);

  if (!profile) return null;

  const maxEnergy  = profile.maxEnergy ?? 100;
  const energyPct  = Math.min(100, (profile.energy / maxEnergy) * 100);
  const isFull     = profile.energy >= maxEnergy;
  const energyColor =
    energyPct > 60 ? 'bg-green-400' : energyPct > 30 ? 'bg-amber-400' : 'bg-red-400';
  const energyIconColor =
    energyPct > 60 ? 'text-green-400' : energyPct > 30 ? 'text-amber-400' : 'text-red-400';

  const level  = Math.max(1, Math.floor(profile.trustScore / 10));
  const xpPct  = (profile.trustScore % 10) * 10;

  return (
    <>
    <div
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none px-3 pb-1"
      style={{ paddingTop: 'max(8px, var(--tg-safe-area-inset-top, env(safe-area-inset-top, 8px)))' }}
    >
      <div className="glass rounded-2xl flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2">

        {/* Avatar + Level — tap to open achievements */}
        <button
          className="relative flex-shrink-0 pointer-events-auto active:scale-90 transition-all group"
          onClick={() => {
            soundManager.play('click');
            try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
            setShowAchievements(true);
          }}
          title={`Level ${level} (${profile.trustScore % 10}/10 XP) • Tap for Achievements`}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white font-black text-sm border-2 border-white/20 shadow-md">
            {(profile.username ?? 'B')[0].toUpperCase()}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-400 text-black text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none shadow-sm ring-1 ring-black/30">
            {level}
          </div>
        </button>

        {/* XP + Energy bars */}
        <div className="flex flex-col gap-1 flex-shrink-0 w-16 sm:w-20">
          {/* XP bar — tap for Achievements */}
          <button
            className="h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden pointer-events-auto active:scale-95 transition-all text-left"
            onClick={() => {
              soundManager.play('click');
              try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
              setShowAchievements(true);
            }}
            title={`Level ${level} (${profile.trustScore % 10}/10 XP)`}
          >
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all duration-300"
              style={{ width: `${xpPct}%` }}
            />
          </button>

          {/* Energy bar — tappable */}
          <button
            className="flex items-center gap-1 pointer-events-auto group active:scale-95 transition-all"
            onClick={() => {
              soundManager.play('click');
              try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
              setShowEnergyPopup((v) => !v);
            }}
            title={`Energy: ${profile.energy}/${maxEnergy}⚡`}
          >
            <Zap size={9} className={`${energyIconColor} flex-shrink-0 ${isFull ? 'animate-pulse' : ''}`} />
            <div className="flex-1 h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${energyColor} rounded-full transition-all duration-500 ${isFull ? 'animate-pulse' : ''}`}
                style={{ width: `${energyPct}%` }}
              />
            </div>
            <span className={`text-[9px] font-bold leading-none ${isFull ? 'text-green-400' : 'text-white/70'}`}>
              {profile.energy}
            </span>
          </button>
        </div>

        {/* GOLD + $FARM claim + Wallet icon */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <button
            onClick={() => {
              soundManager.play('coin');
              try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light'); } catch {}
              setToast({
                title: '💰 Gold Balance',
                body: `Current balance: ${Math.floor(profile.goldBalance).toLocaleString()} GOLD`,
              });
            }}
            className="glass-gold rounded-xl flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 pointer-events-auto active:scale-95 transition-all cursor-pointer"
            title={`Balance: ${profile.goldBalance.toLocaleString()} GOLD`}
          >
            <Coins size={12} className="text-amber-400 flex-shrink-0" />
            <span className="text-amber-300 font-black text-xs sm:text-sm leading-none">
              {profile.goldBalance >= 1000
                ? `${(profile.goldBalance / 1000).toFixed(1)}k`
                : profile.goldBalance.toFixed(0)}
            </span>
          </button>
          {profile.goldBalance >= 100 && (
            <button
              className="glass-purple rounded-xl flex items-center gap-1 px-1.5 sm:px-2 py-1.5 animate-pulse pointer-events-auto active:scale-95 transition-all"
              onClick={() => {
                soundManager.play('coin');
                try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('medium'); } catch {}
                eventBus.emit('show-claim');
              }}
              title="Claim & Convert to $FARM"
            >
              <Gem size={11} className="text-violet-300 flex-shrink-0" />
              <span className="text-violet-300 text-[10px] font-bold leading-none">Claim</span>
            </button>
          )}
          <WalletHUD onOpenDashboard={() => { setWalletInitialTab('tokens'); setShowWallet(true); }} />
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Weather (compact emoji) */}
        <WeatherBanner />

        
        {isDesktop && onToggleDesktopFullscreen && (
          <button
            onClick={onToggleDesktopFullscreen}
            className="pointer-events-auto glass rounded-xl p-1.5 text-white/60 hover:text-white active:scale-95 transition-all"
          >
            {desktopFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}
        {/* Bell */}
        <button
          onClick={() => {
            try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
            soundManager.play('click');
            setShowNotifications(true);
          }}
          className="pointer-events-auto relative glass rounded-xl p-1.5 text-white/60 hover:text-white active:scale-95 transition-all"
          title="Activity & Notifications"
        >
          <Bell size={14} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-violet-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Farm Maintenance / Repair */}
        <button
          onClick={() => {
            try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
            soundManager.play('click');
            setShowMaintenance(true);
          }}
          className={`pointer-events-auto relative glass rounded-xl p-1.5 transition-all active:scale-95 ${
            repairNeeded ? 'text-amber-300 border border-amber-400/50 bg-amber-500/15 shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'text-white/60 hover:text-white'
          }`}
          title={repairNeeded ? `Defense Alert: Fence at ${fenceDurability}%! Tap to repair` : 'Farm Maintenance'}
        >
          <Hammer size={14} className={repairNeeded ? 'text-amber-400 animate-pulse' : undefined} />
          {repairNeeded && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-ping" />
          )}
          {repairNeeded && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => {
            try { (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch {}
            soundManager.play('click');
            setShowSettings(true);
          }}
          className="pointer-events-auto glass rounded-xl p-1.5 text-white/60 hover:text-white active:scale-95 transition-all"
          title="Settings & Profile"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>

    {/* Energy popup backdrop & modal */}
    {showEnergyPopup && (
      <>
        <div
          className="fixed inset-0 z-[198] bg-black/40 backdrop-blur-[2px] pointer-events-auto animate-fade-in"
          onClick={() => {
            soundManager.play('click');
            setShowEnergyPopup(false);
          }}
        />
        <EnergyPopup
          energy={profile.energy}
          maxEnergy={maxEnergy}
          lastEnergyUpdate={profile.lastEnergyUpdate}
          onClose={() => {
            soundManager.play('click');
            setShowEnergyPopup(false);
          }}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['profile'] })}
        />
      </>
    )}

    {toast && (
      <NotifToast
        title={toast.title}
        body={toast.body}
        onDismiss={() => setToast(null)}
      />
    )}
    <Suspense fallback={null}>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showNotifications && <NotificationModal onClose={() => setShowNotifications(false)} />}
      {showAchievements && <AchievementModal onClose={() => setShowAchievements(false)} />}
      {showMaintenance && <FarmMaintenanceModal onClose={() => setShowMaintenance(false)} />}
      {showWallet && <WalletDashboardModal onClose={() => setShowWallet(false)} initialTab={walletInitialTab} />}
    </Suspense>
    </>
  );
}
