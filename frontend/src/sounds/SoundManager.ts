import type { SoundId } from '@/game/EventBus';

const SETTINGS_KEY = 'bb_settings';

function isSoundEnabled(): boolean {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').sound !== false; }
  catch { return true; }
}

function isMusicEnabled(): boolean {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').music !== false; }
  catch { return true; }
}

function getMusicVolume(): number {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').musicVol;
    return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.4;
  } catch { return 0.4; }
}

function isHapticEnabled(): boolean {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').haptic !== false; }
  catch { return true; }
}

// ── Web Audio helpers ────────────────────────────────────��───────
function note(
  ctx: AudioContext,
  freq: number,
  startAt: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.22,
) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(vol, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

function sweep(
  ctx: AudioContext,
  f0: number,
  f1: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.2,
) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  const t = ctx.currentTime;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// ── Synth sound definitions ──────────────────────────────────────
type SynthFn = (ctx: AudioContext) => void;

const SYNTHS: Record<SoundId, SynthFn> = {
  // 🌱 Plant — soft thud + quick rise
  plant: (ctx) => {
    sweep(ctx, 160, 380, 0.14, 'sine', 0.18);
    const t = ctx.currentTime;
    note(ctx, 300, t + 0.06, 0.10, 'sine', 0.10);
  },

  // 🌾 Harvest — upward 3-note arpeggio
  harvest: (ctx) => {
    const t = ctx.currentTime;
    [440, 554, 659].forEach((f, i) => note(ctx, f, t + i * 0.09, 0.22, 'sine', 0.20));
  },

  // 🥷 Steal success — swoosh up + bright ping
  steal_win: (ctx) => {
    sweep(ctx, 180, 900, 0.16, 'sawtooth', 0.13);
    const t = ctx.currentTime;
    note(ctx, 1200, t + 0.13, 0.14, 'sine', 0.15);
  },

  // 🐕 Steal fail — square bark + descend
  steal_fail: (ctx) => {
    sweep(ctx, 220, 75, 0.28, 'square', 0.22);
    const t = ctx.currentTime;
    note(ctx, 110, t + 0.05, 0.16, 'square', 0.12);
  },

  // 💰 Coin ping
  coin: (ctx) => {
    sweep(ctx, 1400, 900, 0.13, 'sine', 0.18);
  },

  // 🔥 Daily reward fanfare
  daily: (ctx) => {
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => note(ctx, f, t + i * 0.09, 0.26, 'sine', 0.18));
  },

  // ✅ Quest complete — 4-note + harmonic
  quest: (ctx) => {
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      note(ctx, f,     t + i * 0.1,        0.22, 'sine',     0.17);
      note(ctx, f * 2, t + i * 0.1 + 0.01, 0.18, 'triangle', 0.06);
    });
  },

  // 🖱️ UI click
  click: (ctx) => {
    sweep(ctx, 900, 600, 0.05, 'sine', 0.12);
  },

  // ❌ Error
  error: (ctx) => {
    sweep(ctx, 220, 100, 0.25, 'square', 0.18);
  },

  // 🐛 Attack (throw bugs/weeds) — sharp sawtooth zap + low thud
  attack: (ctx) => {
    sweep(ctx, 600, 120, 0.18, 'sawtooth', 0.20);
    const t = ctx.currentTime;
    note(ctx, 80, t + 0.06, 0.15, 'square', 0.15);
  },

  // 💧 Water — soft bubbly rise
  water: (ctx) => {
    sweep(ctx, 320, 640, 0.12, 'sine', 0.14);
    const t = ctx.currentTime;
    note(ctx, 800, t + 0.10, 0.10, 'sine', 0.08);
    note(ctx, 960, t + 0.18, 0.08, 'sine', 0.06);
  },

  // 🌿 Weed kill / bug spray — dry swish
  weed_kill: (ctx) => {
    sweep(ctx, 900, 300, 0.14, 'sawtooth', 0.12);
    const t = ctx.currentTime;
    note(ctx, 250, t + 0.05, 0.10, 'triangle', 0.08);
  },

  // ⬆️ Upgrade — ascending chime pair
  upgrade: (ctx) => {
    const t = ctx.currentTime;
    [523, 784, 1047].forEach((f, i) => {
      note(ctx, f, t + i * 0.08, 0.20, 'triangle', 0.16);
    });
  },

  // 🌟 Level up — full bright fanfare
  level_up: (ctx) => {
    const t = ctx.currentTime;
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      note(ctx, f,     t + i * 0.08,       0.28, 'sine',     0.18);
      note(ctx, f * 2, t + i * 0.08 + 0.01, 0.22, 'triangle', 0.07);
    });
  },
};

// ── Haptic ───────────────────────────────────────────────────────
type HapticStyle = 'light' | 'medium' | 'heavy';
const HAPTIC_MAP: Partial<Record<SoundId, HapticStyle>> = {
  harvest:    'medium',
  steal_win:  'heavy',
  steal_fail: 'heavy',
  plant:      'light',
  coin:       'light',
  daily:      'medium',
  quest:      'medium',
  attack:     'medium',
  water:      'light',
  weed_kill:  'light',
  upgrade:    'medium',
  level_up:   'heavy',
};

function triggerHaptic(id: SoundId) {
  if (!isHapticEnabled()) return;
  const style = HAPTIC_MAP[id];
  if (!style) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
  } catch {}
}

// ── BGM Engine ───────────────────────────────────────────────────
// Procedural farm ambient music: harp plucks + bass + room reverb
// 8-second phrase (I-IV-V-I in C major) that loops seamlessly

type NoteEvent = [number, number, number]; // [timeOffset, freq, durationSec]

// Melody — triangle wave plucks, 0.5s intervals
const BGM_MELODY: NoteEvent[] = [
  // Bar 1 (C major)
  [0.0, 261.63, 0.70],  // C4
  [0.5, 329.63, 0.70],  // E4
  [1.0, 392.00, 0.70],  // G4
  [1.5, 440.00, 0.70],  // A4
  // Bar 2 (F major colour)
  [2.0, 349.23, 0.70],  // F4
  [2.5, 440.00, 0.70],  // A4
  [3.0, 523.25, 0.80],  // C5 (high point)
  [3.6, 392.00, 0.70],  // G4
  // Bar 3 (G major colour)
  [4.0, 392.00, 0.70],  // G4
  [4.5, 329.63, 0.70],  // E4
  [5.0, 293.66, 0.70],  // D4
  [5.5, 329.63, 0.70],  // E4
  // Bar 4 (resolve C)
  [6.0, 392.00, 0.70],  // G4
  [6.5, 329.63, 0.70],  // E4
  [7.0, 293.66, 0.70],  // D4
  [7.5, 261.63, 0.45],  // C4 → loop
];

// Bass — sine, long sustained notes
const BGM_BASS: NoteEvent[] = [
  [0.0, 130.81, 1.85],  // C3
  [2.0,  87.31, 1.85],  // F2
  [4.0,  98.00, 1.85],  // G2
  [6.0, 130.81, 1.85],  // C3
];

// Harmony pad — quiet fifths, sine
const BGM_PAD: NoteEvent[] = [
  [0.0, 196.00, 1.85],  // G3 (fifth of C)
  [2.0, 174.61, 1.85],  // F3 (root of F)
  [4.0, 196.00, 1.85],  // G3 (root of G)
  [6.0, 196.00, 1.85],  // G3 (fifth of C)
];

class BGMEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private running = false;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private vol = 0.4;

  private readonly PHRASE = 8; // seconds

  private buildReverb(): ConvolverNode {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 1.4);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
      }
    }
    const node = ctx.createConvolver();
    node.buffer = buf;
    return node;
  }

  private scheduleNote(
    freq: number, start: number, dur: number,
    type: OscillatorType, vol: number,
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.master!);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.01);
  }

  private schedulePhrase(phraseStart: number) {
    for (const [t, f, d] of BGM_MELODY) this.scheduleNote(f, phraseStart + t, d, 'triangle', 0.065);
    for (const [t, f, d] of BGM_BASS)   this.scheduleNote(f, phraseStart + t, d, 'sine', 0.06);
    for (const [t, f, d] of BGM_PAD)    this.scheduleNote(f, phraseStart + t, d, 'sine', 0.032);
  }

  private loop(phraseStart: number) {
    if (!this.running) return;
    this.schedulePhrase(phraseStart);
    // Re-schedule 600ms before end so next phrase is ready
    this.loopTimer = setTimeout(
      () => this.loop(phraseStart + this.PHRASE),
      (this.PHRASE - 0.6) * 1000,
    );
  }

  tryStart(ctx: AudioContext) {
    if (this.running) return;
    if (!isMusicEnabled()) return;
    this.ctx = ctx;
    this.vol = getMusicVolume();
    this.running = true;

    // Master gain
    this.master = ctx.createGain();
    this.master.gain.value = 0;

    // Reverb wet/dry blend
    this.reverb = this.buildReverb();
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    this.master.connect(ctx.destination);         // dry
    this.master.connect(this.reverb);
    this.reverb.connect(wet);
    wet.connect(ctx.destination);                  // wet

    // Fade in
    this.master.gain.setValueAtTime(0, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(this.vol * 0.32, ctx.currentTime + 2.5);

    this.loop(ctx.currentTime + 0.15);
  }

  stop() {
    this.running = false;
    if (this.loopTimer) { clearTimeout(this.loopTimer); this.loopTimer = null; }
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 1.8);
      setTimeout(() => { this.master?.disconnect(); this.reverb?.disconnect(); this.master = null; this.reverb = null; }, 2000);
    }
  }

  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.vol * 0.32, this.ctx.currentTime, 0.15);
    }
  }

  isPlaying() { return this.running; }
}

export const bgmManager = new BGMEngine();

// ── SoundManager ─────────────────────────────────────────────────
class SoundManager {
  private ctx: AudioContext | null = null;
  private unlocked = false;

  // Call once on first user gesture to warm up AudioContext
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      // Play a silent buffer to satisfy iOS autoplay policy
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
      // Start BGM after a short delay (let silent buffer play first)
      setTimeout(() => { if (this.ctx) bgmManager.tryStart(this.ctx); }, 400);
    } catch {}
  }

  getCtx() { return this.ctx; }

  play(id: SoundId) {
    triggerHaptic(id);
    if (!isSoundEnabled()) return;

    try {
      if (!this.ctx) this.ctx = new AudioContext();

      const doPlay = () => {
        try { SYNTHS[id]?.(this.ctx!); } catch {}
      };

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(doPlay).catch(() => {});
      } else {
        doPlay();
      }
    } catch {}
  }
}

export const soundManager = new SoundManager();
