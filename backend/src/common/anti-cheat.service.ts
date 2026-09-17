import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from './redis.service';

// Trust score deltas (matching issue #21 spec)
const TRUST_HARVEST_BOT   = -5;   // harvest within 100ms of harvestable_at
const TRUST_STEAL_FLOOD   = -10;  // sustained steal rate > 3/min
const STEAL_FLOOD_WINDOW  = 60;   // seconds
const STEAL_FLOOD_LIMIT   = 5;    // > 5 steals in 60s = sustained flood

@Injectable()
export class AntiCheatService {
  private readonly logger = new Logger(AntiCheatService.name);

  constructor(
    private readonly redis: RedisService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Check harvest timing precision — penalise if < 100ms after harvestable_at
   * (timing-bot signal). Trust penalty applied asynchronously (fire-and-forget).
   */
  async checkHarvestTiming(userId: string, harvestableAt: Date): Promise<void> {
    const delta = Date.now() - harvestableAt.getTime();
    if (delta >= 0 && delta < 100) {
      this.applyTrustDelta(userId, TRUST_HARVEST_BOT, 'harvest_timing_bot').catch(() => {});
      this.logger.warn(`Anti-cheat: harvest timing bot detected uid=${userId} delta=${delta}ms`);
    }
  }

  /**
   * Track steals per minute per user via Redis.
   * Returns true if flood threshold exceeded (caller may log but ThrottlerGuard handles HTTP block).
   */
  async trackSteal(userId: string): Promise<boolean> {
    const key = `steal_rate:${userId}`;
    const count = await this.redis.incr(key, STEAL_FLOOD_WINDOW);
    if (count > STEAL_FLOOD_LIMIT) {
      this.applyTrustDelta(userId, TRUST_STEAL_FLOOD, 'steal_flood').catch(() => {});
      this.logger.warn(`Anti-cheat: steal flood detected uid=${userId} count=${count}/60s`);
      return true;
    }
    return false;
  }

  private async applyTrustDelta(userId: string, delta: number, reason: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE users SET trust_score = GREATEST(0, LEAST(200, trust_score + $1)) WHERE id = $2`,
      [delta, userId],
    );
    this.logger.log(`Anti-cheat: trust ${delta > 0 ? '+' : ''}${delta} uid=${userId} reason=${reason}`);
  }
}
