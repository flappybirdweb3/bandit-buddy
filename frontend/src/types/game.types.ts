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
}

export interface FarmData {
  userId: string;
  username: string;
  hasGuardDog: boolean;
  guardDogType: string | null;
  guardDogDefense: number;
  plots: FarmPlot[];
}

export interface StealResult {
  success: boolean;
  goldChange: number;
  message: string;
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

export interface ReferralInfo {
  referralCount: number;
  bonusEarned: number;
  bonusPerReferral: number;
  inviteLink: string;
  shareText: string;
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
  | 'attack_victim';

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

export type ShopCategory = 'energy' | 'defense' | 'boost';
export type EffectType =
  | 'energy'
  | 'dog_stray' | 'dog_beagle' | 'dog_husky' | 'dog_shepherd' | 'elephant'
  | 'guard_pup' | 'guard_hound'   // legacy
  | 'fertilizer_normal' | 'fertilizer_super' | 'fertilizer_advanced';

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
  fertilizerCharges: number;       // total (all tiers)
  normalFertCharges: number;
  superFertCharges: number;
  advancedFertCharges: number;
  currentPetType: string | null;
  currentPetDefense: number;
  items: ShopItemData[];
}

export interface ActivityEntry {
  id: string;
  role: 'attacker' | 'defender';
  success: boolean;
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
  tokenId: number;
  dogType: string;
  defensePower: number;
}

export interface NftStatus {
  ownedBreeds: NftBreed[];
  totalNftDefense: number;
  breedCount: number;
}
