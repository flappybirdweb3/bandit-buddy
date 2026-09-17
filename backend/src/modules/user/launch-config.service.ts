import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SystemConfig } from '../marketplace/entities/system-config.entity';

@Injectable()
export class LaunchConfigService implements OnModuleInit {
  private readonly logger = new Logger(LaunchConfigService.name);

  // In-memory cache with conservative defaults
  private cache: Record<string, string> = {
    IS_LAUNCH_EVENT_ACTIVE: 'true',
    NEW_USER_STARTING_GOLD: '500',
    NEW_USER_STARTING_MAGNIFIER: '1',
    REF_MAGNIFIER_REWARD_MULTIPLIER: '2',
    GUILD_NEW_MEMBER_WATER_BOOST: '10',
    FIRST_DEPOSIT_GIFT_ENABLED: 'true',
  };

  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 60_000; // 1 minute refresh

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.refreshCache().catch((err) => {
      this.logger.warn(`Failed initial load of system_config: ${err.message}`);
    });
  }

  async refreshCache(): Promise<void> {
    try {
      const repo = this.dataSource.getRepository(SystemConfig);
      const configs = await repo.find();
      for (const item of configs) {
        this.cache[item.key] = item.value;
      }
      this.lastFetchTime = Date.now();
      this.logger.log(`[LaunchConfig] Loaded configs: active=${this.isLaunchEventActive()}, boost=${this.getGuildNewMemberWaterBoost()}%`);
    } catch (err: any) {
      this.logger.warn(`Could not refresh system_config from DB: ${err.message}`);
    }
  }

  private maybeRefreshAsync(): void {
    if (Date.now() - this.lastFetchTime > this.CACHE_TTL_MS) {
      this.refreshCache().catch(() => {});
    }
  }

  isLaunchEventActive(): boolean {
    this.maybeRefreshAsync();
    return (this.cache['IS_LAUNCH_EVENT_ACTIVE'] ?? 'true').toLowerCase() === 'true';
  }

  getNewUserStartingGold(): number {
    this.maybeRefreshAsync();
    if (!this.isLaunchEventActive()) return 250; // default baseline when event ends
    return parseInt(this.cache['NEW_USER_STARTING_GOLD'] ?? '500', 10) || 500;
  }

  getNewUserStartingMagnifier(): number {
    this.maybeRefreshAsync();
    if (!this.isLaunchEventActive()) return 0;
    return parseInt(this.cache['NEW_USER_STARTING_MAGNIFIER'] ?? '1', 10) || 1;
  }

  getRefMagnifierMultiplier(): number {
    this.maybeRefreshAsync();
    if (!this.isLaunchEventActive()) return 1;
    return parseInt(this.cache['REF_MAGNIFIER_REWARD_MULTIPLIER'] ?? '2', 10) || 2;
  }

  getGuildNewMemberWaterBoost(): number {
    this.maybeRefreshAsync();
    if (!this.isLaunchEventActive()) return 5.0; // standard PRD value
    return parseFloat(this.cache['GUILD_NEW_MEMBER_WATER_BOOST'] ?? '10.0') || 10.0;
  }

  isFirstDepositGiftEnabled(): boolean {
    this.maybeRefreshAsync();
    return (this.cache['FIRST_DEPOSIT_GIFT_ENABLED'] ?? 'true').toLowerCase() === 'true';
  }
}
