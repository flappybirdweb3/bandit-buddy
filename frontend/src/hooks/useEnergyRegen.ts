import { useState, useEffect } from 'react';

const MAX_ENERGY       = 100;
const REGEN_PER_HOUR   = 10;        // +10 energy per hour = +1 per 6 min
const TICK_MS          = 360_000;   // 6 minutes in ms

export interface EnergyRegenInfo {
  nextTickIn: number;   // ms until next +1 energy tick
  timeToFull: number;   // ms until energy hits 100 (0 if already full)
  nextTickLabel: string; // "4m 32s"
  fullLabel: string;     // "1h 20m" or "Full!"
}

function fmtMs(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function useEnergyRegen(
  energy: number,
  lastEnergyUpdate: string | null | undefined,
): EnergyRegenInfo {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!lastEnergyUpdate || energy >= MAX_ENERGY) {
    return { nextTickIn: 0, timeToFull: 0, nextTickLabel: '', fullLabel: 'Full!' };
  }

  const lastMs      = new Date(lastEnergyUpdate).getTime();
  const elapsedMs   = Math.max(0, now - lastMs);
  const elapsedTicks = Math.floor((elapsedMs / 3_600_000) * REGEN_PER_HOUR);

  // ms until the (elapsedTicks + 1)-th tick fires
  const nextTickAtMs = lastMs + ((elapsedTicks + 1) / REGEN_PER_HOUR) * 3_600_000;
  const nextTickIn   = Math.max(0, nextTickAtMs - now);

  // how many more ticks until full
  const ticksNeeded  = MAX_ENERGY - energy;
  const fullAtMs     = lastMs + ((elapsedTicks + ticksNeeded) / REGEN_PER_HOUR) * 3_600_000;
  const timeToFull   = Math.max(0, fullAtMs - now);

  return {
    nextTickIn,
    timeToFull,
    nextTickLabel: fmtMs(nextTickIn),
    fullLabel: timeToFull <= 0 ? 'Full!' : fmtMs(timeToFull),
  };
}
