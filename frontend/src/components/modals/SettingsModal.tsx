import { useState, useEffect } from 'react';
import { X, Wallet, Shield, Users, Copy, Check, LogOut, Volume2, VolumeX, Smartphone, Info } from 'lucide-react';
import { useAccount, useDisconnect } from 'wagmi';
import { useGame } from '@/providers/GameProvider';
import WebApp from '@twa-dev/sdk';

interface Props { onClose: () => void }

const STORAGE_KEY = 'bb_settings';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch { return {}; }
}

function saveSettings(patch: Record<string, unknown>) {
  const cur = loadSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...patch }));
}

export function SettingsModal({ onClose }: Props) {
  const { profile } = useGame();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const saved = loadSettings();
  const [sound, setSound] = useState<boolean>(saved.sound ?? true);
  const [haptic, setHaptic] = useState<boolean>(saved.haptic ?? true);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => { saveSettings({ sound }); }, [sound]);
  useEffect(() => { saveSettings({ haptic }); }, [haptic]);

  const copy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const level = Math.max(1, Math.floor((profile?.trustScore ?? 0) / 10));

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up pb-10 overflow-y-auto"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-4">
          <h2 className="text-white font-black text-base">Settings</h2>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Profile card */}
        <div className="mx-4 mb-3 glass rounded-2xl p-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white font-black text-xl border-2 border-white/20 flex-shrink-0">
            {(profile?.username ?? 'B')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-black text-base truncate">
              @{profile?.username ?? 'Unknown'}
            </div>
            <div className="text-white/40 text-xs mt-0.5">Level {level} Farmer</div>
            <div className="flex items-center gap-3 mt-1.5">
              <Pill label={`⚡ ${profile?.energy ?? 0}`} />
              <Pill label={`🛡 Trust ${profile?.trustScore ?? 0}`} />
              <Pill label={`🌾 ${profile?.plotCount ?? 0} plots`} />
            </div>
          </div>
        </div>

        {/* Telegram ID */}
        <Section title="Account">
          <Row
            icon={<Info size={15} className="text-blue-400" />}
            label="Telegram ID"
            right={
              <button
                onClick={() => copy(String(profile?.telegramId ?? ''), setCopiedId)}
                className="flex items-center gap-1.5 glass rounded-xl px-2.5 py-1.5 text-white/60 text-xs active:scale-95"
              >
                <span className="font-mono">{profile?.telegramId}</span>
                {copiedId ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              </button>
            }
          />
          <Row
            icon={<Users size={15} className="text-violet-400" />}
            label="Referral streak"
            right={<span className="text-white/60 text-xs">{profile?.dailyStreak ?? 0}-day streak</span>}
          />
        </Section>

        {/* Wallet */}
        <Section title="Wallet (BSC)">
          {isConnected && address ? (
            <>
              <Row
                icon={<Wallet size={15} className="text-green-400" />}
                label="Address"
                right={
                  <button
                    onClick={() => copy(address, setCopiedAddr)}
                    className="flex items-center gap-1.5 glass rounded-xl px-2.5 py-1.5 text-white/60 text-xs active:scale-95"
                  >
                    <span className="font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span>
                    {copiedAddr ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                  </button>
                }
              />
              <Row
                icon={<LogOut size={15} className="text-red-400" />}
                label="Disconnect wallet"
                right={
                  <button
                    onClick={() => { disconnect(); onClose(); }}
                    className="glass-red text-red-400 text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all"
                  >
                    Disconnect
                  </button>
                }
              />
            </>
          ) : (
            <div className="px-4 py-3 text-white/30 text-sm text-center">
              No wallet connected. Use the Connect button in the top bar.
            </div>
          )}
        </Section>

        {/* Sound & Haptics */}
        <Section title="Preferences">
          <Row
            icon={sound ? <Volume2 size={15} className="text-amber-400" /> : <VolumeX size={15} className="text-white/30" />}
            label="Sound effects"
            right={<Toggle value={sound} onChange={setSound} />}
          />
          <Row
            icon={<Smartphone size={15} className={haptic ? 'text-amber-400' : 'text-white/30'} />}
            label="Haptic feedback"
            right={<Toggle value={haptic} onChange={(v) => {
              setHaptic(v);
              if (v) WebApp.HapticFeedback?.impactOccurred('light');
            }} />}
          />
        </Section>

        {/* Security */}
        <Section title="Security">
          <Row
            icon={<Shield size={15} className="text-blue-400" />}
            label="Trust score"
            right={
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                    style={{ width: `${Math.min(100, (profile?.trustScore ?? 0))}%` }}
                  />
                </div>
                <span className="text-white/50 text-xs">{profile?.trustScore ?? 0}/100</span>
              </div>
            }
          />
        </Section>

        {/* App info */}
        <div className="px-5 pt-1 pb-2 text-center text-white/20 text-[10px]">
          Bandit Buddy v1.0 · BSC Testnet · Made with 🥷
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mb-3">
      <div className="text-white/30 text-[10px] font-bold uppercase tracking-widest px-1 mb-1.5">{title}</div>
      <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

function Row({ icon, label, right }: { icon: React.ReactNode; label: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-shrink-0">{icon}</div>
      <span className="flex-1 text-white/70 text-sm">{label}</span>
      <div className="flex-shrink-0">{right}</div>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span className="text-[9px] text-white/40 bg-white/5 rounded-full px-1.5 py-0.5">{label}</span>
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
