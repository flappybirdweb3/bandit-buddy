import { RaccoonMascot } from '@/components/mascot/RaccoonMascot';

const BOT_LINK = 'https://t.me/BanditBuddyBot/game';

export function NotInTelegramScreen() {
  const handleOpen = () => {
    window.open(BOT_LINK, '_blank');
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6 gap-6 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0a1f0a 0%, #1a3a1a 40%, #1e3a5f 100%)' }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, #4ade80 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />

      {/* Floating decorations */}
      <span className="absolute top-[8%]  left-[7%]  text-3xl opacity-20 animate-bounce select-none" style={{ animationDelay: '0s' }}>🌾</span>
      <span className="absolute top-[12%] right-[8%] text-2xl opacity-15 animate-bounce select-none" style={{ animationDelay: '0.4s' }}>🪙</span>
      <span className="absolute bottom-[15%] left-[5%] text-2xl opacity-20 animate-bounce select-none" style={{ animationDelay: '0.8s' }}>🌽</span>
      <span className="absolute bottom-[18%] right-[6%] text-3xl opacity-15 animate-bounce select-none" style={{ animationDelay: '1.2s' }}>💰</span>

      {/* Main card */}
      <div
        className="relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center gap-5 text-center"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Mascot */}
        <div className="relative">
          <RaccoonMascot size={100} className="drop-shadow-2xl" animate />
          <span className="absolute -top-1 -right-2 text-2xl">📱</span>
        </div>

        {/* Logo text */}
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-black text-3xl leading-none tracking-tight select-none">
            <span style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Bandit
            </span>
            <span style={{ background: 'linear-gradient(135deg, #fb923c, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Buddy
            </span>
          </h1>
          <p className="text-white/30 text-[10px] tracking-widest uppercase">Plant · Harvest · Steal · Earn</p>
        </div>

        {/* Message */}
        <div className="flex flex-col gap-2">
          <div className="bg-amber-400/10 border border-amber-400/25 rounded-2xl px-4 py-3">
            <p className="text-amber-300 font-bold text-sm">Telegram Mini App Only</p>
            <p className="text-white/50 text-xs mt-1 leading-relaxed">
              Bandit Buddy runs inside Telegram. Open the link below in the Telegram app to start farming.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 text-left glass rounded-2xl px-4 py-3">
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-0.5">How to play</p>
            <Step n={1} text="Open Telegram on your phone" />
            <Step n={2} text='Search for @BanditBuddyBot or tap the button below' />
            <Step n={3} text='Tap "Play" → your farm loads instantly' />
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleOpen}
          className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 active:scale-95 transition-all"
          style={{
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 60%, #15803d 100%)',
            color: '#fff',
            boxShadow: '0 6px 28px rgba(34,197,94,0.40), 0 0 0 1px rgba(74,222,128,0.2)',
          }}
        >
          <span className="text-xl">🦝</span>
          <span>Open in Telegram</span>
        </button>

        <p className="text-white/15 text-[10px]">BSC Testnet · Play to Earn · Web3</p>
      </div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-green-400 font-black text-[10px]">{n}</span>
      </div>
      <p className="text-white/50 text-xs leading-snug">{text}</p>
    </div>
  );
}
