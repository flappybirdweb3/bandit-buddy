export interface UserProfile {
  id: string;
  telegramId: number;
  username: string;
  walletAddress: string | null;
  goldBalance: number;
  energy: number;
  maxEnergy: number;
  lastEnergyUpdate: string;
  trustScore: number;
  plotCount: number;
  dailyStreak: number;
  canClaimDaily: boolean;
  nextClaimAt: string | null;
  notificationsEnabled: boolean;
  goldStolen: number;
  totalHarvests: number;
  totalPlants: number;
  totalAttacks: number;
  totalWaters: number;
  fertilizerCharges: number;       // total of all tiers (for BottomBar badge)
  normalFertCharges: number;
  superFertCharges: number;
  advancedFertCharges: number;
  // Raid stats
  dailyStealCount: number;
  maxDailySteals: number;
}

export interface DailyClaimResult {
  goldReward: number;
  energyRestore: number;
  streak: number;
  nextStreakReward: number;
  isMaxStreak: boolean;
}

export interface SeedConfig {
  id: string;
  name: string;
  nameVi: string | null;
  costGold: number;
  growTimeSec: number;
  growTimeHours: number;
  baseYield: number;
  iconKey: string;
  levelRequired: number;
  category: string;
  isSeasonal?: boolean;
  seasonalTag?: string | null;
}

export interface FarmPlot {
  id: string;
  plotIndex: number;
  isEmpty: boolean;
  seed: { id: string; name: string; iconKey: string; baseYield: number } | null;
  plantedAt: string | null;
  harvestableAt: string | null;
  isRipe: boolean;
  level: number;
  multiplier: number;
  totalStolen: number;
  stealableRemaining: number;
  lastStolenAt: string | null;
  fertilized: boolean;
  hasBugs: boolean;
  hasWeeds: boolean;
  hasDrySoil: boolean;
  wateredThisCycle?: boolean;
  soilFertility: number;
}

export interface FarmData {
  userId: string;
  username: string;
  hasGuardDog: boolean;
  guardDogId?: string | null;
  guardDogType: string | null;
  guardDogDefense: number;
  guardDogLastFedAt?: string | null;
  plots: FarmPlot[];
}

export interface StealResult {
  success: boolean;
  goldChange: number;
  message: string;
  isRevenge?: boolean;
  fenceBypass?: boolean;
  masterKeyUsed?: boolean;
  insurancePayout?: number;
}

export interface ClaimPayload {
  userAddress: string;
  amountWei: string;
  nonce: number;
  signature: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  goldStolen: number;
  goldBalance: number;
  dailyStreak: number;
  trustScore: number;
  totalHarvests: number;
  isMe: boolean;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
  category: 'thieves' | 'rich' | 'streak' | 'farmer';
}

export type PlotAction = 'plant' | 'harvest' | 'steal' | 'attack' | 'locked' | 'upgrade';

export interface PlotClickEvent {
  plotId: string;
  plotIndex: number;
  action: PlotAction;
  isOwnFarm: boolean;
}

export interface TelegramFriend {
  id: number;
  username: string;
  firstName: string;
  hasRipeCrops?: boolean;
  userId?: string;
}

export interface FriendEntry {
  userId: string;
  username: string;
  hasRipeCrops: boolean;
  isStealable: boolean;
  connection: 'invited' | 'invited_by';
}

export interface ReferralCrewMember {
  id: string;
  username: string;
  level: number;
  isLevel3: boolean;
  status: 'Level 3 Reached' | 'Grinding';
}

export interface ReferralInfo {
  referralCount: number;
  bonusEarned: number;
  bonusPerReferral: number;
  inviteLink: string;
  shareText: string;
  level3FriendsCount?: number;
  masterKeyProgress?: number;
  masterKeyTarget?: number;
  masterKeysEarned?: number;
  magnifiersEarned?: number;
  isLaunchEventActive?: boolean;
  magnifierMultiplier?: number;
  guildWaterBoost?: number;
  crew?: ReferralCrewMember[];
}

export type QuestType =
  | 'harvest_count'
  | 'plant_count'
  | 'steal_attempts'
  | 'steal_count'
  | 'steal_gold'
  | 'harvest_gold'
  | 'attack_count'
  | 'water_count';

export interface DailyQuest {
  id: string;
  questType: QuestType;
  title: string;
  description: string;
  targetValue: number;
  rewardGold: number;
  rewardEnergy: number;
  iconKey: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export type NotifType =
  | 'steal_victim'
  | 'dog_bite_owner'
  | 'quest_complete'
  | 'harvest_ready'
  | 'referral_joined'
  | 'daily_reminder'
  | 'attack_victim'
  | 'help_received';

export interface InAppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  actorUserId: string | null;
  actorUsername: string | null;
}

export interface NotificationInbox {
  unreadCount: number;
  items: InAppNotification[];
}

export type ShopCategory = 'energy' | 'defense' | 'boost' | 'soil' | 'subscription' | 'upgrades';
export type EffectType =
  | 'energy'
  | 'dog_stray' | 'dog_beagle' | 'dog_husky' | 'dog_shepherd' | 'elephant'
  | 'guard_pup' | 'guard_hound'
  | 'fertilizer_normal' | 'fertilizer_super' | 'fertilizer_advanced'
  | 'soil_restore_basic' | 'soil_restore_premium'
  | 'butler_7d' | 'butler_30d' | 'crop_insurance_7d'
  | 'max_energy';

export interface ShopItemData {
  id: string;
  category: ShopCategory;
  name: string;
  description: string;
  effectType: EffectType;
  effectValue: number;
  costGold: number;
  iconKey: string;
  owned: number;
  maxOwned: number | null;
  soldOut: boolean;
}

export interface ShopCatalog {
  goldBalance: number;
  energy?: number;
  maxEnergy?: number;
  fertilizerCharges: number;       // total (all tiers)
  normalFertCharges: number;
  superFertCharges: number;
  advancedFertCharges: number;
  currentPetType: string | null;
  currentPetDefense: number;
  subscriptions?: { type: string; expiresAt: string | Date }[];
  hasButler?: boolean;
  hasCropInsurance?: boolean;
  items: ShopItemData[];
}

export interface ActivityEntry {
  id: string;
  role: 'attacker' | 'defender';
  success: boolean;
  isAnonymous?: boolean;
  amount: number;
  createdAt: string;
  otherUsername: string;
}

export type AchievementCategory = 'farmer' | 'raider' | 'streak' | 'social';

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string;
  category: AchievementCategory;
  progress: number;
  target: number;
  unlocked: boolean;
  pct: number;
}

export type WeatherEffect =
  | 'harvest_gold_bonus'
  | 'grow_speed_bonus'
  | 'gold_multiplier'
  | 'pest_damage'
  | 'steal_penalty'
  | 'festival';

export interface WeatherEvent {
  id: string;
  emoji: string;
  name: string;
  description: string;
  effect: WeatherEffect;
  value: number;
  date: string;
  expiresAt: string;
}

export interface NftBreed {
  id?: string;
  tokenId: number;
  dogType: string;
  defensePower: number;
  isGuarding: boolean;
  listingId?: string | null;
  isListed?: boolean;
}

export interface NftStatus {
  ownedBreeds: NftBreed[];
  totalNftDefense: number;
  breedCount: number;
  soulShards?: number;
  tierStats?: Record<number, {
    total: number;
    guarding: number;
    listed: number;
    available: number;
    canFuse: boolean;
  }>;
}

export interface DynamicRates {
  farmPriceUsd: number;
  farmPriceBnb: number;
  baseGoldUsdValue: number;
  baseRate: number;
  alpha: number;
  depositFee: number;
  withdrawFee: number;
  depositRate: number;
  withdrawRate: number;
  goldPerFarmWithdraw: number;
  goldMinted24h: number;
  goldBurned24h: number;
  burnMintRatio: number;
  economyStatus: 'balanced' | 'deflationary' | 'inflationary';
  treasuryFarmBalance: number;
  killSwitchActive: boolean;
  killSwitchReason: string | null;
  lastUpdated: string;
}

export interface CashoutQuota {
  date: string;
  tier: number;
  tierName: string;
  tierPercentage: number;
  userDailyLimit: number;
  userSpentToday: number;
  userRemaining: number;
  globalDailyPool: number;
  globalSpentToday: number;
  globalRemaining: number;
  releaseRate: number;
  priceGrowth24h: number;
  totalCirculatingGold: number;
  goldPerFarmWithdraw: number;
  resetAtUtc: string;
  canWithdraw: boolean;
  reason?: string;
}

export interface ExchangeRate {
  goldPerFarm: number;
  totalGoldCirculating: number;
  farmInTreasury: number;
  farmPriceUsd?: number;
  farmPriceBnb?: number;
  source?: string;
  killSwitchActive?: boolean;
  inflationWarning: boolean;
  lastUpdated: string;
  note: string;
  baseGoldUsdValue?: number;
  baseRate?: number;
  alpha?: number;
  depositFee?: number;
  withdrawFee?: number;
  depositRate?: number;
  withdrawRate?: number;
  goldMinted24h?: number;
  goldBurned24h?: number;
  burnMintRatio?: number;
  economyStatus?: string;
}

export interface DexTier {
  walletAddress: string;
  volume24h: number;
  tier: number;
  buyTax: number;
  sellTax: number;
}

export interface DepositInfo {
  treasuryAddress: string;
  farmTokenAddress: string;
  goldPerFarm: number;
  baseRate?: number;
  alpha?: number;
  depositFee?: number;
  chainId: number;
  instructions: string[];
  note: string;
}

export interface DepositVerifyResult {
  goldCredited: number;
  goldBalance: number;
  txHash: string;
  farmAmount: number;
  depositRate?: number;
}

export interface DepositResultData {
  goldCredited: number;
  goldBalance: number;
  txHash: string;
  farmAmount: number;
  depositRate: number;
  senderAddress: string;
  treasuryAddress: string;
}

export interface BuildingStatus {
  fenceDurability: number;
  barnDurability: number;
  lastRepairedAt: string;
  repairCostPer10Pct: number;
  alertNeeded: boolean;
}

export interface GuildContribution {
  waterCount: number;
  invitedCount: number;
  calculatedPoints: number;
  claimed: boolean;
  lastWateredAt: string | null;
  canWater: boolean;
  isViralBoostEligible?: boolean;
  cooldownRemainingHours: number;
  sharePercent: number;
}

export interface GuildTopContributor {
  userId: string;
  username: string;
  points: number;
  waterCount: number;
  invitedCount: number;
}

export interface GuildInfo {
  id: string;
  name: string;
  tier: string;
  isPremium: boolean;
  stakedFarm: number;
  taxRate: number;
  worldTreeHp: number;
  treeLevel: number;
  treeProgressPercent: number;
  status: 'growing' | 'ripe' | 'harvested';
  isShielded: boolean;
  shieldRemainingHours: number;
  shieldRemainingMs?: number;
  shieldUntil?: string | Date | null;
  rewardPoolFarm: number;
  rewardPoolGold: number;
  telegramGroupId?: string | null;
  myRole: string;
  memberCount: number;
  maxMembers: number;
  members: { userId: string; username: string; role: string; joinedAt: string }[];
  myContribution?: GuildContribution;
  topContributors?: GuildTopContributor[];
}

export interface GuildListEntry {
  id: string;
  name: string;
  tier: string;
  isPremium: boolean;
  treeLevel: number;
  treeProgressPercent: number;
  stakedFarm: number;
  memberCount: number;
  maxMembers: number;
  ownerUsername: string;
  status?: 'growing' | 'ripe' | 'harvested';
  worldTreeHp?: number;
  rewardPoolFarm?: number;
  rewardPoolGold?: number;
  shieldUntil?: string | Date | null;
  isShielded?: boolean;
}

export interface SubscriptionStatus {
  hasButler: boolean;
  hasCropInsurance: boolean;
  subscriptions: { type: string; expiresAt: string }[];
}

export interface MarketplaceListingsResponse {
  total: number;
  offset: number;
  limit: number;
  items: MarketplaceListing[];
}

export interface MarketplaceListing {
  id: string;
  seller: string;
  sellerId?: string;
  nftContract: string | null;
  tokenId: number | null;
  priceFarm: number;
  pricePerUnit: number | null;
  deadline: string;
  createdAt: string;
  eip712Sig: string | null;
  nonce: number;
  assetType: 'nft' | 'user_items';
  itemType: string | null;
  quantity: number;
  status?: 'active' | 'filled' | 'cancelled';
}

export interface InventoryItem {
  itemType: string;
  quantity: number;
  lockedQuantity: number;
  available: number;
}

export interface BarnDog {
  id: string;
  tokenId: number;
  dogType: string;
  defensePower: number;
  isActive: boolean;
  isGuarding: boolean;
  listingId?: string | null;
  isListed?: boolean;
  listingPrice?: number | string | null;
  source: 'nft' | 'shop';
  lastFedAt: string;
}

export interface BarnData {
  crops:  InventoryItem[];
  crates: InventoryItem[];
  seeds:  InventoryItem[];
  tools:  InventoryItem[];
  fertilizer: { normal: number; super: number; advanced: number; total: number };
  dogs:   BarnDog[];
}

export interface BuyBackEventRecord {
  txHash: string;
  bnbSpent: string;
  farmBurned: string;
  timestamp: number;
  blockNumber: number;
}

export interface TreasuryStatus {
  contractAddress: string;
  bnbBalance: string;
  bnbBalanceWei: string;
  buyBackThreshold: string;
  buyBackThresholdWei: string;
  progressPercent: number;
  totalBurned: string;
  totalBnbSpent: string;
  deadAddress: string;
  isReady: boolean;
  isPaused: boolean;
  recentEvents: BuyBackEventRecord[];
  lastCheckedAt: number;
}
