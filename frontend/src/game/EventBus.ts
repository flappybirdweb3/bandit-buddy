import type { PlotClickEvent, FarmData, UserProfile } from '@/types/game.types';

type EventMap = {
  'plot-clicked': PlotClickEvent;
  'farm-updated': FarmData;
  'profile-updated': UserProfile;
  'scene-ready': string;
  'show-friends': void;
  'visit-farm': { userId: string; username: string };
  'back-to-my-farm': void;
  'steal-animation': { success: boolean; plotIndex: number };
  'tool-changed': string;
  'seed-preselected': { seedId: string; seedName: string };
};

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
