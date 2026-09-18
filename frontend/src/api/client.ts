import WebApp from '@twa-dev/sdk';
import type {
  UserProfile, FarmData, SeedConfig, StealResult, ClaimPayload, LeaderboardData,
  FriendEntry, ReferralInfo, DailyClaimResult, DailyQuest, ShopCatalog,
  NotificationInbox, ActivityEntry, Achievement, NftStatus, ExchangeRate,
  BuildingStatus, MarketplaceListing, MarketplaceListingsResponse, InventoryItem, BarnData,
  DepositInfo, DepositVerifyResult, DexTier, DynamicRates, CashoutQuota,
  TreasuryStatus,
} from '@/types/game.types';

const BASE_URL = '/api';

function getInitData(): string {
  // initData from the Telegram Mini App runtime is the ONLY accepted credential.
  //
  // There is deliberately NO dev fallback. A synthesised id (or one read back out of
  // localStorage) is different on every browser profile, so the same Telegram account
  // landed on a brand-new user row — with its own wallet, gold and farm — on every
  // machine. Empty here now means "not launched from Telegram", which the auth guard
  // answers with 401 and App.tsx renders as NotInTelegramScreen.
  return WebApp.initData ?? '';
}

// Auth via session token obtained from GET /api/auth/session (a simple GET with no
// custom headers, so it passes through any Telegram proxy or CORS restriction).
//
// The returned token is stored in memory and used as "Authorization: Bearer <token>"
// on all subsequent game requests. "Authorization" is a standard HTTP header that
// every compliant proxy passes through. The previous approach of sending initData as
// "x-telegram-init-data" was blocked on Telegram accounts that route through certain
// proxies in Telegram Desktop, causing a "Failed to fetch" TypeError.
let _sessionToken: string | null = null;
let _sessionDone = false;
let _sessionPromise: Promise<void> | null = null;

function ensureSession(): Promise<void> {
  const initData = getInitData();
  if (!initData) return Promise.resolve();
  if (_sessionDone) return Promise.resolve();
  if (_sessionPromise) return _sessionPromise;

  try {
    const b64 = btoa(unescape(encodeURIComponent(initData)));
    _sessionPromise = fetch(`${BASE_URL}/auth/session?d=${encodeURIComponent(b64)}`)
      .then(async (r) => {
        if (r.ok) {
          try {
            const data = await r.json();
            if (data?.token && typeof data.token === 'string') {
              _sessionToken = data.token;
            }
          } catch {
            // response parse failure — session cookie may still be set, continue
          }
          _sessionDone = true;
        }
      })
      .catch(() => {
        _sessionPromise = null; // allow retry on next request
      });
  } catch {
    _sessionPromise = null;
    return Promise.resolve();
  }

  return _sessionPromise;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Capture diagnostic context so "Failed to fetch" errors reveal the root cause
  const platform = (WebApp as any).platform ?? 'unknown';
  const hasInitData = !!WebApp.initData;
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Attempt to ensure session cookie. Non-fatal if blocked; requests carry x-telegram-init-data header.
  await ensureSession().catch(() => {});

  const initData = getInitData();

  // Build auth header. Priority:
  // 1. Authorization: Bearer <session-token> — standard header, passes through proxies.
  //    Available after the first ensureSession() call completes.
  // 2. x-telegram-init-data — fallback for the very first request before session is
  //    established, or if ensureSession() failed.
  //
  // Accounts that route through a Telegram proxy in Desktop get "TypeError: Failed to
  // fetch" when x-telegram-init-data is sent (the proxy strips or rejects it). The
  // Authorization header is a standard HTTP header that every compliant proxy passes
  // through, so switching to it after ensureSession() eliminates that failure path.
  const authHeader: Record<string, string> = _sessionToken
    ? { Authorization: `Bearer ${_sessionToken}` }
    : initData
    ? { 'x-telegram-init-data': initData }
    : {};

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...authHeader,
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
      // Session expired — force re-auth on next request
      _sessionDone = false;
      _sessionPromise = null;
      _sessionToken = null;
    }
    throw new Error(errorMsg);
  }

  // Gracefully handle empty responses (204 No Content, Content-Length: 0, or empty body)
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return null as unknown as T;
  }
  const text = await res.text();
  if (!text || text.trim() === '') {
    return null as unknown as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as unknown as T;
  }
}

export const api = {
  // Auth
  logout: () => fetch(`${BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {}),

  // User
  getProfile: () => request<UserProfile>('/user/profile'),
  updateWallet: (walletAddress: string) =>
    request('/user/wallet', { method: 'PATCH', body: JSON.stringify({ walletAddress }) }),
  unlinkWallet: () =>
    request('/user/wallet', { method: 'DELETE' }),

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

  steal: (targetUserId: string, plotId: string, useMasterKey?: boolean, isRevenge?: boolean) =>
    request<StealResult>('/action/steal', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId,
        plotId,
        ...(useMasterKey ? { useMasterKey: true } : {}),
        ...(isRevenge ? { isRevenge: true } : {}),
      }),
    }),

  // Web3
  claimSignature: (amountToClaim: number) =>
    request<ClaimPayload>('/web3/claim-signature', {
      method: 'POST',
      body: JSON.stringify({ amountToClaim }),
    }),

  refundClaim: (nonce: number, unbroadcasted = false) =>
    request<{ refunded: boolean; goldRestored: number }>('/web3/refund-claim', {
      method: 'POST',
      body: JSON.stringify({ nonce, unbroadcasted }),
    }),

  refundAllPendingClaims: () =>
    request<{ refundedCount: number; totalGoldRestored: number }>('/web3/refund-all-pending', {
      method: 'POST',
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
  feedDog: (dogId: string) =>
    request<{ message: string; goldSpent: number; nextFeedInHours: number }>(`/web3/dog/${dogId}/feed`, {
      method: 'POST',
    }),
  getShopDogs: () => request<{ id: string; dogType: string; defensePower: number }[]>('/web3/shop-dogs'),
  tokenizeDog: (count: 1 | 3) =>
    request<{ walletAddress: string; count: number; nonce: number; signature: string; contractAddress: string }>(
      '/web3/tokenize-dog', { method: 'POST', body: JSON.stringify({ count }) },
    ),
  rollbackTokenizeDog: (nonce: number, count: 1 | 3) =>
    request<{ restored: boolean; count: number }>(
      '/web3/rollback-tokenize-dog', { method: 'POST', body: JSON.stringify({ nonce, count }) },
    ),
  redeemShards: (count: number) =>
    request<{ walletAddress: string; count: number; nonce: number; signature: string; contractAddress: string }>(
      '/web3/redeem-shards', { method: 'POST', body: JSON.stringify({ count }) },
    ),
  checkFusionEligibility: (tier: number) =>
    request<{ eligible: boolean; baseTierId: number; available: number; tierStats: any }>(
      `/web3/fusion/eligibility?tier=${tier}`,
    ),
  resolveFusion: (requestId: number) =>
    request<{
      requestId: number;
      player: string;
      baseTierId: number;
      upgradedTier: number;
      isSuccess: boolean;
      shardsRewarded: number;
      roll: number;
      targetRate: number;
      useLuckyBone: boolean;
      useCollar: boolean;
      txHash: string;
    }>('/web3/fusion/resolve', { method: 'POST', body: JSON.stringify({ requestId }) }),

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
    request<{ userId: string; username: string; ripePlots: number; hasGuardDog: boolean; guardDogType: string | null; guardDogDefense?: number }[]>('/user/explore'),

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
  claimAllQuests: () =>
    request<{ claimedCount: number; totalGold: number; totalEnergy: number }>(
      '/quest/daily/claim-all',
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

  // Web3 — exchange rate & dynamic peg
  getExchangeRate: () => request<ExchangeRate>('/web3/exchange-rate'),
  getDynamicRates: () => request<DynamicRates>('/web3/dynamic-rates'),
  getDexTier: () => request<DexTier>('/web3/dex-tier'),
  getCashoutQuota: () => request<CashoutQuota>('/web3/cashout-quota'),

  // Web3 — deposit $FARM → GOLD (#72)
  getDepositInfo: () => request<DepositInfo>('/web3/deposit-info'),
  verifyDeposit: (txHash: string) => request<DepositVerifyResult>('/web3/deposit-verify', {
    method: 'POST',
    body: JSON.stringify({ txHash }),
  }),

  // Web3 — Auto Buyback & Burn Vault
  getTreasuryStatus: () => request<TreasuryStatus>('/web3/treasury-status'),
  triggerTreasuryBuyBack: () => request<{ success: boolean; message: string; txHash?: string }>('/web3/treasury-trigger', {
    method: 'POST',
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
  sellAllCrops: () =>
    request<{ message: string; totalGoldGained: number; totalCropsSold: number }>('/inventory/sell-all', {
      method: 'POST',
    }),
  packCrate: (cropKey: string, crateCount: number) =>
    request<{ message: string; cratesMade: number; cropsUsed: number }>('/inventory/pack-crate', {
      method: 'POST', body: JSON.stringify({ cropKey, crateCount }),
    }),
  unpackCrate: (crateItemType: string, quantity: number = 1) =>
    request<{ message: string; cratesUnpacked: number; cropType: string; unitsGained: number }>('/inventory/unpack-crate', {
      method: 'POST', body: JSON.stringify({ crateItemType, quantity }),
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
    request<{ nonce: number; marketContractAddress?: string }>(`/marketplace/nonce?nftContract=${nftContract}&tokenId=${tokenId}`),
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

  // Guild & World Tree Social-Fi
  listGuilds: (limit = 20, offset = 0) =>
    request<import('@/types/game.types').GuildListEntry[]>(`/guild/list?limit=${limit}&offset=${offset}`),
  getMyGuild: () =>
    request<import('@/types/game.types').GuildInfo | null>('/guild/my'),
  createGuild: (name: string) =>
    request<{ id: string; name: string; tier: string; isPremium: boolean; message: string }>('/guild/create', { method: 'POST', body: JSON.stringify({ name }) }),
  joinGuild: (guildId: string) =>
    request<{ message: string }>('/guild/join', { method: 'POST', body: JSON.stringify({ guildId }) }),
  leaveGuild: () => request<{ message: string }>('/guild/leave', { method: 'DELETE' }),
  disbandGuild: () => request<{ message: string }>('/guild/disband', { method: 'DELETE' }),
  upgradeToElite: () => request<{ message: string }>('/guild/upgrade-elite', { method: 'POST' }),
  stakeToGuild: (amount: number) =>
    request<{ message: string; stakedFarm: number; canUpgrade: boolean }>('/guild/stake', { method: 'POST', body: JSON.stringify({ amount }) }),
  waterGuildTree: (guildId?: string) =>
    request<{ message: string; progressAdded: number; treeProgressPercent: number; treeLevel: number; status: string; isRipe: boolean; myPoints: number; waterCount: number; invitedCount: number }>('/guild/water', { method: 'POST', body: JSON.stringify({ guildId }) }),
  buyGuildShield: () =>
    request<{ message: string; shieldUntil: string }>('/guild/buy-shield', { method: 'POST' }),
  autoCompoundGuild: () =>
    request<{
      message: string;
      compoundGold: number;
      remainingTreasuryGold: number;
      progressAdded: number;
      treeProgressPercent: number;
      worldTreeHp: number;
      maxWorldTreeHp: number;
      stakedFarm: number;
      treeStatus: string;
    }>('/guild/auto-compound', { method: 'POST' }),
  claimTreeReward: () =>
    request<{ message: string; earnedFarm: number; earnedGold: number; myPoints: number; totalGuildPoints: number; isOwner: boolean; cycleFinished: boolean }>('/guild/claim-reward', { method: 'POST' }),
  raidGuildTree: (targetGuildId: string) =>
    request<{ message: string; stolenFarm: number; stolenGold: number }>('/guild/raid', { method: 'POST', body: JSON.stringify({ targetGuildId }) }),
  setGuildTaxRate: (taxRate: number) =>
    request<{ message: string; taxRate: number }>('/guild/set-tax-rate', { method: 'POST', body: JSON.stringify({ taxRate }) }),
  linkTelegramGroup: (telegramGroupId: string) =>
    request<{ message: string; telegramGroupId: string }>('/guild/link-group', { method: 'POST', body: JSON.stringify({ telegramGroupId }) }),

  // Subscriptions
  getSubscriptionStatus: () =>
    request<{
      hasButler: boolean;
      butlerExpiresAt?: string | null;
      butlerPreferredSeedId?: string | null;
      butlerPreferredSeed?: { id: string; name: string; costGold: number; levelRequired: number } | null;
      hasCropInsurance: boolean;
      insuranceExpiresAt?: string | null;
      subscriptions: { type: string; expiresAt: string; preferredSeedId?: string | null }[];
    }>('/subscription/status'),
  setButlerPreferredSeed: (seedId: string | null) =>
    request<{ message: string; preferredSeedId: string | null }>('/subscription/butler/seed', {
      method: 'POST',
      body: JSON.stringify({ seedId }),
    }),

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
