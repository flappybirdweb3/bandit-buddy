import type { PlotClickEvent, FarmData, UserProfile } from '@/types/game.types';

type EventMap = {
  'plot-clicked': PlotClickEvent;
  'farm-updated': FarmData;
  'profile-updated': UserProfile;
  'scene-ready': string;
  'show-friends': void;
  'show-claim': { tab?: 'convert' | 'dex' | 'deposit_tx' | 'treasury' } | void;
  'show-storage': void;
  'show-wallet': { tab?: 'tokens' | 'nfts' | 'defi' } | void;
  'show-shop': { tab?: 'seeds' | 'energy' | 'defense' | 'boost' | 'upgrades' } | void;
  'visit-farm': { userId: string; username: string; isRevenge?: boolean };
  'back-to-my-farm': void;
  'return-to-own-farm': void;
  'steal-animation':   { success: boolean; plotIndex: number };
  'plant-animation':   { plotIndex: number };
  'harvest-animation': { plotIndex: number; gold?: number; cropYield?: number };
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
  'show-tutorial': void;
  'ui-overlay': boolean;
  'play-sound': SoundId;
  'wallet-balance-updated': { bnb: bigint | null; farm: bigint | null; walletAddress?: string };
  'swap-success': { txHash?: string | null; fromAmount: string; fromToken: string; toAmount: string; toToken: string };
  'dog-clicked': { dogId?: string | null; dogType?: string | null; defense: number; lastFedAt?: string | null; isVisiting?: boolean };
};

export type SoundId = 'plant' | 'harvest' | 'steal_win' | 'steal_fail' | 'coin' | 'quest' | 'click' | 'error' | 'daily' | 'attack' | 'water' | 'weed_kill' | 'upgrade' | 'level_up' | 'dog_bark';

type EventCallback<T> = (data: T) => void;

class EventBus {
  private listeners: Map<string, EventCallback<unknown>[]> = new Map();
  private activeOverlays: Set<string> = new Set();
  private overlayDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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
    // If emitting 'ui-overlay' false directly while other overlays are still registered, protect it
    if (event === 'ui-overlay' && data === false && this.activeOverlays.size > 0) {
      return;
    }
    const list = this.listeners.get(event) ?? [];
    list.forEach((fn) => fn(data as unknown));
  }

  /**
   * Reference-counted centralized overlay tracker.
   * Prevents competing modals from resetting ui-overlay to false while another modal is open.
   */
  setOverlay(sourceId: string, active: boolean): void {
    if (active) {
      this.activeOverlays.add(sourceId);
      if (this.overlayDebounceTimer) {
        clearTimeout(this.overlayDebounceTimer);
        this.overlayDebounceTimer = null;
      }
      this.emit('ui-overlay', true);
    } else {
      this.activeOverlays.delete(sourceId);
      if (this.activeOverlays.size === 0) {
        if (this.overlayDebounceTimer) clearTimeout(this.overlayDebounceTimer);
        this.overlayDebounceTimer = setTimeout(() => {
          if (this.activeOverlays.size === 0) {
            this.emit('ui-overlay', false);
          }
        }, 200);
      }
    }
  }

  isOverlayActive(): boolean {
    return this.activeOverlays.size > 0;
  }
}

export const eventBus = new EventBus();
