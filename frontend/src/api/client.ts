import WebApp from '@twa-dev/sdk';
import type {
  UserProfile, FarmData, SeedConfig, StealResult, ClaimPayload, LeaderboardData,
  FriendEntry, ReferralInfo, DailyClaimResult,
} from '@/types/game.types';

const BASE_URL = '/api';

function getInitData(): string {
  // In production: real Telegram initData
  // In dev: mock initData for testing
  if (WebApp.initData) return WebApp.initData;

  // Dev fallback
  const mockUser = JSON.stringify({ id: 123456789, first_name: 'Dev', username: 'devuser' });
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
    request('/action/harvest', { method: 'POST', body: JSON.stringify({ plotId }) }),

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

  syncNft: () => request('/web3/sync-nft', { method: 'POST' }),

  // Leaderboard
  getLeaderboard: () => request<LeaderboardData>('/user/leaderboard'),

  // Friends & referral
  getFriends: () => request<FriendEntry[]>('/user/friends'),
  getReferral: () => request<ReferralInfo>('/user/referral'),

  // Daily reward
  claimDaily: () => request<DailyClaimResult>('/user/daily-claim', { method: 'POST' }),
};
