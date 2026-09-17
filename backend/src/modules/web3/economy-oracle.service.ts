import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { RedisService } from '../../common/redis.service';
import { DexOracleService } from './dex-oracle.service';
import { GoldTransaction, GoldTransactionType } from './entities/gold-transaction.entity';

const ALPHA_REDIS_KEY = 'economy:alpha';
const MINTED_REDIS_KEY = 'economy:gold_minted_24h';
const BURNED_REDIS_KEY = 'economy:gold_burned_24h';
const ECONOMY_CACHE_TTL = 7200; // 2 hours
const CASHOUT_CACHE_TTL = 172800; // 48 hours (zero-cronjob auto reset)

const BASE_GOLD_USD_VALUE = 0.0001;
const WITHDRAW_FEE = 0.05;
const MIN_GLOBAL_DAILY_FARM_POOL = 100_000; // Baseline floor ensuring Tier 1: 50, Tier 2: 200, Tier 3: 2000 FARM

export interface EconomyStats {
  alpha: number;
  goldMinted24h: number;
  goldBurned24h: number;
  burnMintRatio: number;
  status: 'balanced' | 'deflationary' | 'inflationary';
  lastUpdated: string;
}

export interface DailyCashoutPoolInfo {
  date: string;
  globalDailyPoolFarm: number;
  releaseRate: number;
  totalCirculatingGold: number;
  priceGrowth24h: number;
  goldPerFarmWithdraw: number;
  withdrawRate: number;
  alpha: number;
}

export interface RecordGoldTxParams {
  userId?: string;
  amount: number;
  type: GoldTransactionType;
  category: string;
  description?: string;
}

@Injectable()
export class EconomyOracleService implements OnModuleInit {
  private readonly logger = new Logger(EconomyOracleService.name);
  private cachedStats: EconomyStats = {
    alpha: 1.0,
    goldMinted24h: 10000,
    goldBurned24h: 10000,
    burnMintRatio: 1.0,
    status: 'balanced',
    lastUpdated: new Date().toISOString(),
  };

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly dexOracle: DexOracleService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Warm up the economy stats and daily cashout pool on startup (safe background async)
    void Promise.all([
      this.syncEconomyStats().catch((err) =>
        this.logger.warn(`Initial economy stats sync failed: ${(err as Error).message}`),
      ),
      this.syncDailyCashoutQuota().catch((err) =>
        this.logger.warn(`Initial daily cashout pool sync failed: ${(err as Error).message}`),
      ),
    ]);
  }

  /**
   * Runs every hour to compute 24h GOLD mint/burn and calculate economy multiplier Alpha.
   */
  @Cron('0 * * * *')
  async scheduledSync(): Promise<void> {
    await this.syncEconomyStats();
  }

  async syncEconomyStats(): Promise<EconomyStats> {
    try {
      const rows = await this.dataSource.query(`
        SELECT 
          type, 
          COALESCE(SUM(amount), 0)::float AS total
        FROM gold_transactions
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY type
      `) as Array<{ type: string; total: number }>;

      let totalMint = 0;
      let totalBurn = 0;

      for (const row of rows) {
        if (row.type === 'MINT') totalMint = Number(row.total) || 0;
        if (row.type === 'BURN') totalBurn = Number(row.total) || 0;
      }

      // If database has 0 transactions in 24h, default to 1:1 baseline
      let rawRatio = 1.0;
      if (totalMint > 0) {
        rawRatio = totalBurn / totalMint;
      } else if (totalBurn > 0) {
        rawRatio = 1.5;
      }

      // Algorithmic Dynamic Peg: clamp Alpha between [0.5, 1.5]
      const alpha = Math.min(Math.max(rawRatio, 0.5), 1.5);
      const roundedAlpha = Number(alpha.toFixed(4));

      const status: 'balanced' | 'deflationary' | 'inflationary' =
        roundedAlpha > 1.05 ? 'deflationary' : roundedAlpha < 0.95 ? 'inflationary' : 'balanced';

      const stats: EconomyStats = {
        alpha: roundedAlpha,
        goldMinted24h: Number(totalMint.toFixed(2)),
        goldBurned24h: Number(totalBurn.toFixed(2)),
        burnMintRatio: Number(rawRatio.toFixed(4)),
        status,
        lastUpdated: new Date().toISOString(),
      };

      this.cachedStats = stats;

      // Cache to Redis
      await Promise.all([
        this.redis.set(ALPHA_REDIS_KEY, roundedAlpha.toString(), ECONOMY_CACHE_TTL),
        this.redis.set(MINTED_REDIS_KEY, totalMint.toString(), ECONOMY_CACHE_TTL),
        this.redis.set(BURNED_REDIS_KEY, totalBurn.toString(), ECONOMY_CACHE_TTL),
      ]);

      this.logger.log(
        `[EconomyOracle] Synced 24h stats: Minted=${totalMint.toFixed(0)}G, Burned=${totalBurn.toFixed(0)}G, Alpha=${roundedAlpha} (${status})`,
      );

      return stats;
    } catch (err) {
      this.logger.error(`[EconomyOracle] Failed to sync economy stats: ${(err as Error).message}`);
      return this.cachedStats;
    }
  }

  async getEconomyStats(): Promise<EconomyStats> {
    try {
      const [alphaRaw, mintRaw, burnRaw] = await Promise.all([
        this.redis.get(ALPHA_REDIS_KEY),
        this.redis.get(MINTED_REDIS_KEY),
        this.redis.get(BURNED_REDIS_KEY),
      ]);

      if (alphaRaw !== null && mintRaw !== null && burnRaw !== null) {
        const alpha = Number(alphaRaw);
        const mint = Number(mintRaw);
        const burn = Number(burnRaw);
        if (Number.isFinite(alpha) && alpha > 0) {
          const rawRatio = mint > 0 ? burn / mint : 1.0;
          return {
            alpha,
            goldMinted24h: mint,
            goldBurned24h: burn,
            burnMintRatio: Number(rawRatio.toFixed(4)),
            status: alpha > 1.05 ? 'deflationary' : alpha < 0.95 ? 'inflationary' : 'balanced',
            lastUpdated: this.cachedStats.lastUpdated,
          };
        }
      }
    } catch {
      // Redis blip — fall back to memory cached
    }

    return this.cachedStats;
  }

  /**
   * Records a GOLD mint or burn transaction.
   * Can accept an active EntityManager or QueryRunner for transactional consistency.
   */
  async record(
    runnerOrManager: EntityManager | QueryRunner | null,
    params: RecordGoldTxParams,
  ): Promise<void> {
    if (!params.amount || params.amount <= 0) return;

    try {
      const txRepo = runnerOrManager
        ? runnerOrManager instanceof EntityManager
          ? runnerOrManager.getRepository(GoldTransaction)
          : runnerOrManager.manager.getRepository(GoldTransaction)
        : this.dataSource.getRepository(GoldTransaction);

      const entity = txRepo.create({
        userId: params.userId,
        amount: params.amount,
        type: params.type,
        category: params.category,
        description: params.description,
      });

      await txRepo.save(entity);
    } catch (err) {
      // Do not abort user's gameplay transaction if logging encounters an issue
      this.logger.warn(`Failed to record gold transaction: ${(err as Error).message}`);
    }
  }

  /**
   * Daily Cronjob at 00:00 UTC:
   * Computes Total Circulating GOLD, 24h Price Growth, dynamic release rate R in [2%, 5%],
   * and stores Global_Daily_Pool_FARM in Redis with 48h TTL.
   */
  @Cron('0 0 * * *')
  async scheduledDailyCashoutSync(): Promise<void> {
    await this.syncDailyCashoutQuota();
  }

  /**
   * Computes and caches dynamic daily cashout pool into Redis.
   */
  async syncDailyCashoutQuota(targetDate?: string): Promise<DailyCashoutPoolInfo> {
    const dateStr = targetDate || new Date().toISOString().slice(0, 10);
    try {
      // 1. Calculate Total Circulating GOLD across all players
      const [goldRes] = await this.dataSource.query(`
        SELECT COALESCE(SUM(gold_balance), 0)::float AS total FROM users
      `) as Array<{ total: number }>;
      const totalCirculatingGold = Number(goldRes?.total) || 0;

      // 2. Fetch 24h price growth of $FARM/USDT from DexOracleService
      const growthInfo = await this.dexOracle.getPriceGrowth24h();
      const growthPercent = growthInfo.growthPercent;

      // 3. Dynamic Release Rate R in [0.02, 0.05] (2% to 5%)
      // Price_Growth >= 10% -> 0.05
      // Price_Growth <= -10% -> 0.02
      // Linear interpolation between -10% and +10%:
      const clampedRatio = Math.min(Math.max((growthPercent + 10) / 20, 0), 1);
      const releaseRate = Number((0.02 + clampedRatio * 0.03).toFixed(4));

      // 4. Algorithmic Dynamic Peg Rate to convert GOLD -> $FARM
      const currentPriceUsd = growthInfo.currentPrice > 0 ? growthInfo.currentPrice : 0.000146;
      const baseRate = currentPriceUsd / BASE_GOLD_USD_VALUE;
      const stats = await this.getEconomyStats();
      const alpha = stats.alpha;
      const withdrawRate = (1 / baseRate) * alpha * (1 - WITHDRAW_FEE);
      const goldPerFarmWithdraw = withdrawRate > 0 ? 1 / withdrawRate : baseRate;

      // 5. Global_Pool_GOLD = Total_Circulating_GOLD * Release_Rate
      const globalPoolGold = totalCirculatingGold * releaseRate;
      const calculatedPoolFarm = Number((globalPoolGold * withdrawRate).toFixed(2));
      const globalDailyPoolFarm = Math.max(calculatedPoolFarm, MIN_GLOBAL_DAILY_FARM_POOL);

      // 6. Cache into Redis with 48h TTL (Zero-cronjob auto reset)
      await Promise.all([
        this.redis.set(`cashout:pool:farm:${dateStr}`, globalDailyPoolFarm.toString(), CASHOUT_CACHE_TTL),
        this.redis.set(`cashout:rate:${dateStr}`, releaseRate.toString(), CASHOUT_CACHE_TTL),
        this.redis.set(`cashout:gold_supply:${dateStr}`, totalCirculatingGold.toString(), CASHOUT_CACHE_TTL),
        this.redis.set(`cashout:price_growth:${dateStr}`, growthPercent.toString(), CASHOUT_CACHE_TTL),
        this.redis.set('cashout:pool:farm:latest', globalDailyPoolFarm.toString(), CASHOUT_CACHE_TTL),
      ]);

      this.logger.log(
        `[EconomyOracle] Synced Daily Cashout Pool for ${dateStr}: CirculatingGold=${totalCirculatingGold.toFixed(0)}G, PriceGrowth=${growthPercent}%, R=${(releaseRate * 100).toFixed(2)}%, GlobalPool=${globalDailyPoolFarm} FARM`,
      );

      return {
        date: dateStr,
        globalDailyPoolFarm,
        releaseRate,
        totalCirculatingGold,
        priceGrowth24h: growthPercent,
        goldPerFarmWithdraw: Number(goldPerFarmWithdraw.toFixed(2)),
        withdrawRate: Number(withdrawRate.toFixed(6)),
        alpha,
      };
    } catch (err) {
      this.logger.error(`[EconomyOracle] Failed to sync daily cashout pool: ${(err as Error).message}`);
      return {
        date: dateStr,
        globalDailyPoolFarm: MIN_GLOBAL_DAILY_FARM_POOL,
        releaseRate: 0.035,
        totalCirculatingGold: 0,
        priceGrowth24h: 0,
        goldPerFarmWithdraw: 1.53,
        withdrawRate: 0.65,
        alpha: 1.0,
      };
    }
  }

  async getDailyCashoutPool(dateStr?: string): Promise<DailyCashoutPoolInfo> {
    const targetDate = dateStr || new Date().toISOString().slice(0, 10);
    try {
      const [poolRaw, rateRaw, supplyRaw, growthRaw] = await Promise.all([
        this.redis.get(`cashout:pool:farm:${targetDate}`),
        this.redis.get(`cashout:rate:${targetDate}`),
        this.redis.get(`cashout:gold_supply:${targetDate}`),
        this.redis.get(`cashout:price_growth:${targetDate}`),
      ]);

      if (poolRaw !== null && rateRaw !== null) {
        const globalDailyPoolFarm = Number(poolRaw);
        const releaseRate = Number(rateRaw);
        const totalCirculatingGold = supplyRaw ? Number(supplyRaw) : 0;
        const priceGrowth24h = growthRaw ? Number(growthRaw) : 0;

        const stats = await this.getEconomyStats();
        const dex = await this.dexOracle.getDexPrice();
        const currentPriceUsd = dex?.priceUsd && dex.priceUsd > 0 ? dex.priceUsd : 0.000146;
        const baseRate = currentPriceUsd / BASE_GOLD_USD_VALUE;
        const withdrawRate = (1 / baseRate) * stats.alpha * (1 - WITHDRAW_FEE);
        const goldPerFarmWithdraw = withdrawRate > 0 ? 1 / withdrawRate : baseRate;

        return {
          date: targetDate,
          globalDailyPoolFarm,
          releaseRate,
          totalCirculatingGold,
          priceGrowth24h,
          goldPerFarmWithdraw: Number(goldPerFarmWithdraw.toFixed(2)),
          withdrawRate: Number(withdrawRate.toFixed(6)),
          alpha: stats.alpha,
        };
      }
    } catch {
      // Redis fallback
    }

    // If cache not found for today, sync on-demand and cache
    return this.syncDailyCashoutQuota(targetDate);
  }
}
