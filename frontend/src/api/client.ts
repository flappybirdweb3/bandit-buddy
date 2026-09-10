import WebApp from '@twa-dev/sdk';
import type {
  UserProfile, FarmData, SeedConfig, StealResult, ClaimPayload, LeaderboardData,
  FriendEntry, ReferralInfo, DailyClaimResult, DailyQuest, ShopCatalog,
  NotificationInbox, ActivityEntry, Achievement, NftStatus,
} from '@/types/game.types';

const BASE_URL = '/api';

function getInitData(): string {
  if (WebApp.initData) return WebApp.initData;

  // Production without Telegram WebView → return empty so auth guard rejects with 401
  // The App component detects this and shows NotInTelegramScreen
  if (import.meta.env.PROD) return '';

  // Local dev only: stable unique user per browser so different browsers get separate accounts
  const DEV_ID_KEY = 'bb_dev_tg_id';
  let devId = localStorage.getItem(DEV_ID_KEY);
  if (!devId) {
    devId = String(100_000_000 + Math.floor(Math.random() * 900_000_000));
    localStorage.setItem(DEV_ID_KEY, devId);
  }
  const mockUser = JSON.stringify({
    id: parseInt(devId, 10),
    first_name: 'Dev',
    username: `dev_${devId.slice(-4)}`,
  });
  return `user=${encodeURIComponent(mockUser)}&hash=devhash`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': getInitData(),
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Request failed');
  }
  return data as T;
}

export const api = {
  // User
  getProfile: () => request<UserProfile>('/user/profile'),
  updateWallet: (walletAddress: string) =>
    request('/user/wallet', { method: 'PATCH', body: JSON.stringify({ walletAddress }) }),

  // Farm
  getMyFarm: () => request<FarmData>('/farm/my'),
  getFarm: (userId: string) => request<FarmData>(`/farm/${userId}`),
  getSeeds: () => request<SeedConfig[]>('/farm/seeds'),

  // Actions
  plant: (plotId: string, seedId: string) =>
    request('/action/plant', { method: 'POST', body: JSON.stringify({ plotId, seedId }) }),

  harvest: (plotId: string) =>
    request<{ goldEarned: number; levelUp: boolean; newLevel: number; message: string }>(
      '/action/harvest', { method: 'POST', body: JSON.stringify({ plotId }) }),

  steal: (targetUserId: string, plotId: string) =>
    request<StealResult>('/action/steal', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, plotId }),
    }),

  // Web3
  claimSignature: (amountToClaim: number) =>
    request<ClaimPayload>('/web3/claim-signature', {
      method: 'POST',
      body: JSON.stringify({ amountToClaim }),
    }),

  syncNft: () => request<{ synced: number; totalNftDefense: number; dogs: Array<{ tokenId: number; dogType: string; defensePower: number; balance: number }>; message: string }>('/web3/sync-nft', { method: 'POST' }),
  getNftStatus: () => request<NftStatus>('/web3/nft-status'),

  // Leaderboard
  getLeaderboard: (category: 'thieves' | 'rich' | 'streak' | 'farmer' = 'thieves') =>
    request<LeaderboardData>(`/user/leaderboard?category=${category}`),

  // Friends & referral (bidirectional: people I invited + person who invited me)
  getFriends: () => request<FriendEntry[]>('/user/friends'),
  getReferral: () => request<ReferralInfo>('/user/referral'),

  // Daily reward
  claimDaily: () => request<DailyClaimResult>('/user/daily-claim', { method: 'POST' }),

  // Notifications
  setNotifications: (enabled: boolean) =>
    request<{ enabled: boolean }>('/user/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  // Explore / search
  searchUsers: (q: string) =>
    request<{ userId: string; username: string }[]>(`/user/search?q=${encodeURIComponent(q)}`),
  getExploreFarms: () =>
    request<{ userId: string; username: string; ripePlots: number; hasGuardDog: boolean; guardDogType: string | null }[]>('/user/explore'),

  // Notifications
  getInbox: () => request<NotificationInbox>('/notification/inbox'),
  markAllRead: () => request('/notification/read-all', { method: 'POST' }),
  clearNotifications: () => request('/notification/clear', { method: 'DELETE' }),
  getActivity: () => request<ActivityEntry[]>('/action/activity'),
  getAchievements: () => request<Achievement[]>('/user/achievements'),

  // Shop
  getShopItems: () => request<ShopCatalog>('/shop/items'),
  buyShopItem: (itemId: string) =>
    request<{ message: string; itemName: string; costGold: number }>(
      '/shop/buy',
      { method: 'POST', body: JSON.stringify({ itemId }) },
    ),

  // Quests
  getDailyQuests: () => request<DailyQuest[]>('/quest/daily'),
  claimQuestReward: (questId: string) =>
    request<{ rewardGold: number; rewardEnergy: number; title: string }>(
      `/quest/daily/${questId}/claim`,
      { method: 'POST' },
    ),

  // Farm plots
  buyPlot: () => request<{ plotCount: number; cost: number; nextCost: number | null }>('/farm/buy-plot', { method: 'POST' }),
  upgradePlot: (plotId: string) =>
    request<{ level: number; multiplier: number; nextCost: number | null }>('/farm/upgrade-plot', {
      method: 'POST',
      body: JSON.stringify({ plotId }),
    }),

  // Weather
  getWeather: () => request<import('@/types/game.types').WeatherEvent>('/farm/weather/today'),

  // Batch actions
  harvestAll: () => request<{ harvested: number; totalGold: number; message: string; levelUp: boolean; newLevel: number }>('/action/harvest-all', { method: 'POST' }),
  plantAll: (seedId: string) => request<{ planted: number; skipped: number; totalCost: number; message: string }>('/action/plant-all', { method: 'POST', body: JSON.stringify({ seedId }) }),

  // Tool actions
  dig: (plotId: string) =>
    request<{ message: string }>('/action/dig', { method: 'POST', body: JSON.stringify({ plotId }) }),
  water: (plotId: string) =>
    request<{ message: string; savedSec: number }>('/action/water', { method: 'POST', body: JSON.stringify({ plotId }) }),
  fertilize: (plotId: string, tier: 'auto' | 'normal' | 'super' | 'advanced' = 'auto') =>
    request<{ message: string; chargesLeft: number; fertTier: string; savedSec: number }>(
      '/action/fertilize', { method: 'POST', body: JSON.stringify({ plotId, tier }) },
    ),

  // Attack tools (infestation)
  throwAttack: (targetUserId: string, plotId: string, type: 'bugs' | 'weeds') =>
    request<{ message: string; type: string; energyLeft: number }>(
      '/action/throw', { method: 'POST', body: JSON.stringify({ targetUserId, plotId, type }) },
    ),
  weedKill: (plotId: string) =>
    request<{ message: string; energyLeft: number }>('/action/weed-kill', { method: 'POST', body: JSON.stringify({ plotId }) }),
  bugSpray: (plotId: string) =>
    request<{ message: string; energyLeft: number }>('/action/bug-spray', { method: 'POST', body: JSON.stringify({ plotId }) }),
};
