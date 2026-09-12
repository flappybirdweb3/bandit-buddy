import WebApp from '@twa-dev/sdk';
import type {
  UserProfile, FarmData, SeedConfig, StealResult, ClaimPayload, LeaderboardData,
  FriendEntry, ReferralInfo, DailyClaimResult, DailyQuest, ShopCatalog,
  NotificationInbox, ActivityEntry, Achievement, NftStatus, ExchangeRate,
  BuildingStatus, MarketplaceListing, MarketplaceListingsResponse, InventoryItem, BarnData,
  DepositInfo, DepositVerifyResult, DexTier,
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

// Auth via cookie (bb_sess) set by GET /api/auth/session.
// Cookie is sent automatically by the browser — no custom headers needed on game requests.
// This bypasses ANY proxy that strips Authorization or custom headers.
let _sessionDone = false;
let _sessionPromise: Promise<void> | null = null;

function ensureSession(): Promise<void> {
  if (_sessionDone) return Promise.resolve();
  if (_sessionPromise) return _sessionPromise;

  // Simple GET — no body, no custom headers — works through any proxy.
  // initData is base64-encoded in the query param to avoid URL special chars.
  const b64 = btoa(unescape(encodeURIComponent(getInitData())));
  _sessionPromise = fetch(`${BASE_URL}/auth/session?d=${encodeURIComponent(b64)}`)
    .then(async (r) => {
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`auth-${r.status}: ${text.slice(0, 120)}`);
      }
      _sessionDone = true;
    })
    .catch((err) => {
      _sessionPromise = null; // allow retry
      throw err;
    });

  return _sessionPromise;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Capture diagnostic context so "Failed to fetch" errors reveal the root cause
  const platform = (WebApp as any).platform ?? 'unknown';
  const hasInitData = !!WebApp.initData;
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Ensure session cookie is set before any game request. Kept because it is cheaper for
  // same-origin clients, but it is no longer the only auth path — see the header below.
  await ensureSession();

  const initData = getInitData();

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        // Only set Content-Type for requests that have a body (POST/PATCH/PUT).
        // GET requests with Content-Type can trigger CORS preflight and confuse proxies.
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        // ALWAYS carry initData as a header, in addition to the bb_sess cookie.
        //
        // Why this is mandatory, not belt-and-braces: fetch defaults to
        // credentials:'same-origin'. In Telegram Web and Telegram Desktop the Mini App is
        // an iframe on a Telegram origin, so every call to /api/... is CROSS-origin — and
        // for a cross-origin request in that credentials mode the browser neither sends
        // nor STORES the Set-Cookie issued by /auth/session. The cookie flow silently
        // no-ops there: /api/ping (unauthenticated) answers 200 while every authenticated
        // route is 401, which renders as the "Connection error — server is reachable"
        // screen. Same-origin mobile WebViews keep working, so the failure looks
        // account- or device-specific when it is really origin-specific.
        //
        // TelegramAuthGuard validates this header on its own, so auth no longer depends on
        // cookie storage at all. Cost: a CORS preflight on cross-origin calls —
        // x-telegram-init-data is already in the backend's allowedHeaders list.
        ...(initData ? { 'x-telegram-init-data': initData } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${msg} [platform=${platform} online=${online} initData=${hasInitData}]`);
  }

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      errorMsg = data.message || data.error || errorMsg;
    } catch {}
    if (res.status === 401) {
      // Session cookie expired — force re-auth on next request
      _sessionDone = false;
      _sessionPromise = null;
    }
    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
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
    request<{ cropEarned: number; cropType: string; goldLostToThieves: number; levelUp: boolean; newLevel: number; message: string }>(
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

  refundClaim: (nonce: number) =>
    request<{ refunded: boolean; goldRestored: number }>('/web3/refund-claim', {
      method: 'POST',
      body: JSON.stringify({ nonce }),
    }),

  markClaimCompleted: (nonce: number) =>
    request<{ ok: boolean }>('/web3/mark-claim-completed', {
      method: 'POST',
      body: JSON.stringify({ nonce }),
    }),

  syncNft: () => request<{ synced: number; totalNftDefense: number; dogs: Array<{ tokenId: number; dogType: string; defensePower: number; balance: number }>; message: string }>('/web3/sync-nft', { method: 'POST' }),
  getNftStatus: () => request<NftStatus>('/web3/nft-status'),
  setDogGuarding: (tokenId: number, isGuarding: boolean) =>
    request<{ tokenId: number; isGuarding: boolean; message: string }>('/web3/nft-dog/guard', {
      method: 'PATCH',
      body: JSON.stringify({ tokenId, isGuarding }),
    }),
  setDogGuardingById: (dogId: string, isGuarding: boolean) =>
    request<{ dogId: string; dogType: string; isGuarding: boolean; message: string }>('/web3/dog/guard-by-id', {
      method: 'PATCH',
      body: JSON.stringify({ dogId, isGuarding }),
    }),
  getShopDogs: () => request<{ id: string; dogType: string; defensePower: number }[]>('/web3/shop-dogs'),
  tokenizeDog: (count: 1 | 3) =>
    request<{ walletAddress: string; count: number; nonce: number; signature: string; contractAddress: string }>(
      '/web3/tokenize-dog', { method: 'POST', body: JSON.stringify({ count }) },
    ),

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

  // Web3 — exchange rate
  getExchangeRate: () => request<ExchangeRate>('/web3/exchange-rate'),
  getDexTier: () => request<DexTier>('/web3/dex-tier'),

  // Web3 — deposit $FARM → GOLD (#72)
  getDepositInfo: () => request<DepositInfo>('/web3/deposit-info'),
  verifyDeposit: (txHash: string) => request<DepositVerifyResult>('/web3/deposit-verify', {
    method: 'POST',
    body: JSON.stringify({ txHash }),
  }),

  // Farm buildings / maintenance (#36)
  getBuildingStatus: () => request<BuildingStatus>('/action/buildings'),
  repairBuilding: (target: 'fence' | 'barn', amount: number) =>
    request<{ message: string; newDurability: number; goldSpent: number }>('/action/repair', {
      method: 'POST', body: JSON.stringify({ target, amount }),
    }),

  // Revenge mechanic (#38)
  revealThief: (stealLogId: string) =>
    request<{ thiefId: string; thiefUsername: string; stolenAmount: number; stolenAt: string; glassesLeft: number }>(
      '/action/reveal-thief',
      { method: 'POST', body: JSON.stringify({ stealLogId }) },
    ),

  // Inventory
  getInventory: () => request<InventoryItem[]>('/inventory'),
  getBarnInventory: () => request<BarnData>('/inventory/barn'),
  sellCrops: (itemType: string, quantity: number) =>
    request<{ message: string; goldEarned: number }>('/inventory/sell', {
      method: 'POST', body: JSON.stringify({ itemType, quantity }),
    }),
  packCrate: (cropKey: string, crateCount: number) =>
    request<{ message: string; cratesMade: number; cropsUsed: number }>('/inventory/pack-crate', {
      method: 'POST', body: JSON.stringify({ cropKey, crateCount }),
    }),
  unpackCrate: (cropKey: string, crateCount: number) =>
    request<{ message: string; cropsRestored: number }>('/inventory/unpack-crate', {
      method: 'POST', body: JSON.stringify({ cropKey, crateCount }),
    }),

  // Marketplace (#19 + #74)
  getMarketplaceListings: (params: {
    limit?: number; offset?: number;
    assetType?: 'nft' | 'user_items'; itemType?: string;
    sortBy?: 'price' | 'createdAt' | 'deadline'; order?: 'ASC' | 'DESC';
    minPrice?: number; maxPrice?: number;
  } = {}) => {
    const { limit = 20, offset = 0, assetType, itemType, sortBy, order, minPrice, maxPrice } = params;
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (assetType) q.set('assetType', assetType);
    if (itemType)  q.set('itemType', itemType);
    if (sortBy)    q.set('sortBy', sortBy);
    if (order)     q.set('order', order);
    if (minPrice != null) q.set('minPrice', String(minPrice));
    if (maxPrice != null) q.set('maxPrice', String(maxPrice));
    return request<MarketplaceListingsResponse>(`/marketplace/listings?${q}`);
  },
  getMyMarketplaceListings: () => request<MarketplaceListing[]>('/marketplace/my-listings'),
  getMarketplaceNonce: (nftContract: string, tokenId: number) =>
    request<{ nonce: number }>(`/marketplace/nonce?nftContract=${nftContract}&tokenId=${tokenId}`),
  createMarketplaceListing: (data: {
    nftContract: string; tokenId: number; amount?: number; priceFarm: number; deadline: string; eip712Sig: string;
  }) => request<MarketplaceListing>('/marketplace/list', { method: 'POST', body: JSON.stringify(data) }),
  cancelMarketplaceListing: (id: string) =>
    request<{ message: string }>(`/marketplace/cancel/${id}`, { method: 'DELETE' }),
  buyMarketplaceListing: (id: string) =>
    request<{
      message: string;
      order: {
        seller: string; nftContract: string; tokenId: number; amount: number;
        priceFarm: string; nonce: number; deadline: number; signature: string;
      };
      contractAddress: string;
    }>(`/marketplace/buy/${id}`, { method: 'POST' }),
  createItemListing: (data: { itemType: string; quantity: number; priceFarm: number; deadline: string }) =>
    request<MarketplaceListing>('/marketplace/list-item', { method: 'POST', body: JSON.stringify(data) }),
  buyItemListing: (id: string) =>
    request<{ message: string; itemType: string; quantity: number }>(`/marketplace/buy/${id}`, { method: 'POST' }),

  // Guild
  listGuilds: (limit = 20, offset = 0) =>
    request<{ id: string; name: string; tier: string; stakedFarm: number; memberCount: number; ownerUsername: string }[]>(`/guild/list?limit=${limit}&offset=${offset}`),
  getMyGuild: () =>
    request<{ id: string; name: string; tier: string; stakedFarm: number; taxRate: number; worldTreeHp: number; myRole: string; memberCount: number; members: { userId: string; username: string; role: string; joinedAt: string }[] } | null>('/guild/my'),
  createGuild: (name: string) =>
    request<{ id: string; name: string; tier: string; message: string }>('/guild/create', { method: 'POST', body: JSON.stringify({ name }) }),
  joinGuild: (guildId: string) =>
    request<{ message: string }>('/guild/join', { method: 'POST', body: JSON.stringify({ guildId }) }),
  leaveGuild: () => request<{ message: string }>('/guild/leave', { method: 'DELETE' }),
  disbandGuild: () => request<{ message: string }>('/guild/disband', { method: 'DELETE' }),
  upgradeToElite: () => request<{ message: string }>('/guild/upgrade-elite', { method: 'POST' }),
  stakeToGuild: (amount: number) =>
    request<{ message: string; stakedFarm: number; canUpgrade: boolean }>('/guild/stake', { method: 'POST', body: JSON.stringify({ amount }) }),

  // Subscriptions
  getSubscriptionStatus: () =>
    request<{ hasButler: boolean; hasCropInsurance: boolean; subscriptions: { type: string; expiresAt: string }[] }>('/subscription/status'),

  // Batch actions
  harvestAll: () => request<{ harvested: number; totalCrops: number; crops: Record<string, number>; message: string; levelUp: boolean; newLevel: number }>('/action/harvest-all', { method: 'POST' }),
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
