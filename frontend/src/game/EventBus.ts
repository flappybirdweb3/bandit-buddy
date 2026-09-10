import type { PlotClickEvent, FarmData, UserProfile } from '@/types/game.types';

type EventMap = {
  'plot-clicked': PlotClickEvent;
  'farm-updated': FarmData;
  'profile-updated': UserProfile;
  'scene-ready': string;
  'show-friends': void;
  'visit-farm': { userId: string; username: string };
  'back-to-my-farm': void;
  'steal-animation':   { success: boolean; plotIndex: number };
  'plant-animation':   { plotIndex: number };
  'harvest-animation': { plotIndex: number; gold: number };
  'water-animation':   { plotIndex: number };
  'dig-animation':     { plotIndex: number };
  'tool-changed': string;
  'seed-preselected': { seedId: string; seedName: string };
  'seed-cleared': void;
  'buy-plot': { cost: number };
  'plot-tool-action': { tool: string; plotId: string; plotIndex: number };
  'fertilizer-select': { plotId: string; plotIndex: number };
  'level-up': { newLevel: number };
  'show-toast': { message: string; type?: 'success' | 'error' | 'info' };
  'ui-overlay': boolean;
  'play-sound': SoundId;
};

export type SoundId = 'plant' | 'harvest' | 'steal_win' | 'steal_fail' | 'coin' | 'quest' | 'click' | 'error' | 'daily' | 'attack' | 'water' | 'weed_kill' | 'upgrade' | 'level_up';

type EventCallback<T> = (data: T) => void;

class EventBus {
  private listeners: Map<string, EventCallback<unknown>[]> = new Map();

  on<K extends keyof EventMap>(event: K, cb: EventCallback<EventMap[K]>): () => void {
    const list = this.listeners.get(event) ?? [];
    list.push(cb as EventCallback<unknown>);
    this.listeners.set(event, list);
    return () => this.off(event, cb);
  }

  off<K extends keyof EventMap>(event: K, cb: EventCallback<EventMap[K]>): void {
    const list = this.listeners.get(event) ?? [];
    this.listeners.set(event, list.filter((fn) => fn !== cb));
  }

  emit<K extends keyof EventMap>(event: K, data?: EventMap[K]): void {
    const list = this.listeners.get(event) ?? [];
    list.forEach((fn) => fn(data as unknown));
  }
}

export const eventBus = new EventBus();
