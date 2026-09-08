export interface UserProfile {
  id: string;
  telegramId: number;
  username: string;
  walletAddress: string | null;
  goldBalance: number;
  energy: number;
  trustScore: number;
  plotCount: number;
}

export interface SeedConfig {
  id: string;
  name: string;
  costGold: number;
  growTimeSec: number;
  baseYield: number;
  iconKey: string;
}

export interface FarmPlot {
  id: string;
  plotIndex: number;
  isEmpty: boolean;
  seed: { id: string; name: string; iconKey: string; baseYield: number } | null;
  plantedAt: string | null;
  harvestableAt: string | null;
  isRipe: boolean;
  totalStolen: number;
  stealableRemaining: number;
  lastStolenAt: string | null;
}

export interface FarmData {
  userId: string;
  username: string;
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
  goldBalance: number;
  trustScore: number;
  isMe: boolean;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
}

export type PlotAction = 'plant' | 'harvest' | 'steal' | 'locked';

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
  userId?: string; // game user id if registered
}
