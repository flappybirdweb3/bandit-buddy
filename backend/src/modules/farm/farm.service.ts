import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FarmPlot } from './entities/farm-plot.entity';
import { SeedConfig } from './entities/seed-config.entity';
import { NftGuardDog } from './entities/nft-guard-dog.entity';
import { User } from '../user/entities/user.entity';

const PLOT_PRICES = [150, 300, 500, 800, 1200, 2000];
const MAX_PLOTS = 12;

export const UPGRADE_COSTS = [200, 500, 1000, 2000];       // level 1→2, 2→3, 3→4, 4→5
export const UPGRADE_MULTIPLIERS = [1.0, 1.5, 2.0, 3.0, 4.0]; // level 1 through 5
export const MAX_PLOT_LEVEL = 5;

@Injectable()
export class FarmService {
  constructor(
    @InjectRepository(FarmPlot)
    private readonly plotRepo: Repository<FarmPlot>,
    @InjectRepository(SeedConfig)
    private readonly seedRepo: Repository<SeedConfig>,
    @InjectRepository(NftGuardDog)
    private readonly dogRepo: Repository<NftGuardDog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async getFarm(targetUserId: string) {
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    const [plots, dogs] = await Promise.all([
      this.plotRepo.find({
        where: { userId: targetUserId },
        relations: ['seed'],
        order: { plotIndex: 'ASC' },
      }),
      this.dogRepo.find({ where: { ownerId: targetUserId, isActive: true } }),
    ]);

    // Highest defense pet wins
    const activeDog = dogs.length > 0
      ? dogs.reduce((best, d) => d.defensePower > best.defensePower ? d : best)
      : null;
    const now = Date.now();

    return {
      userId: targetUserId,
      username: user.username,
      hasGuardDog: dogs.length > 0,
      guardDogType: activeDog?.dogType ?? null,
      guardDogDefense: activeDog?.defensePower ?? 0,
      plots: plots.map((plot) => {
        const isRipe = plot.harvestableAt ? now >= plot.harvestableAt.getTime() : false;

        // Dry soil: crop is past 50% of grow time without being watered this cycle
        const growTimeSec = plot.seed?.growTimeSec ?? 0;
        const dryThreshold = plot.plantedAt
          ? plot.plantedAt.getTime() + growTimeSec * 500  // *0.5*1000
          : Infinity;
        const wateredThisCycle = plot.lastWateredAt !== null
          && plot.plantedAt !== null
          && plot.lastWateredAt >= plot.plantedAt;
        const hasDrySoil = !!plot.seedId && !isRipe && now >= dryThreshold && !wateredThisCycle;

        return {
          id: plot.id,
          plotIndex: plot.plotIndex,
          isEmpty: !plot.seedId,
          seed: plot.seed
            ? {
                id: plot.seed.id,
                name: plot.seed.name,
                iconKey: plot.seed.iconKey,
                baseYield: Number(plot.seed.baseYield),
              }
            : null,
          plantedAt: plot.plantedAt,
          harvestableAt: plot.harvestableAt,
          isRipe,
          level: plot.level ?? 1,
          multiplier: UPGRADE_MULTIPLIERS[(plot.level ?? 1) - 1] ?? 1.0,
          totalStolen: Number(plot.totalStolen),
          stealableRemaining: plot.seed
            ? Math.max(0, Number(plot.seed.baseYield) * (UPGRADE_MULTIPLIERS[(plot.level ?? 1) - 1] ?? 1.0) * 0.20 - Number(plot.totalStolen))
            : 0,
          lastStolenAt: plot.lastStolenAt,
          fertilized: plot.fertilized ?? false,
          hasBugs:    plot.hasBugs  ?? false,
          hasWeeds:   plot.hasWeeds ?? false,
          hasDrySoil,
          soilFertility: plot.soilFertility ?? 100,
        };
      }),
    };
  }

  async ensureInitialPlots(userId: string): Promise<void> {
    const existingCount = await this.plotRepo.count({ where: { userId } });
    if (existingCount > 0) return;

    const initialPlots = (this.config.get<number>('game.initialPlots')) ?? 6;
    const plots: Partial<FarmPlot>[] = Array.from({ length: initialPlots }, (_, i) => ({
      userId,
      plotIndex: i,
    }));
    await this.plotRepo.save(plots as FarmPlot[]);
  }

  async getSeeds(): Promise<SeedConfig[]> {
    const activeEvent = this.config.get<string>('seasonal.event') ?? 'none';
    const seeds = await this.seedRepo.find({ order: { levelRequired: 'ASC' } });
    // Filter: show regular seeds + seeds matching the active seasonal event
    return seeds.filter(s => !s.isSeasonal || s.seasonalTag === activeEvent);
  }

  async buyPlot(userId: string) {
    const currentCount = await this.plotRepo.count({ where: { userId } });
    if (currentCount >= MAX_PLOTS) {
      throw new BadRequestException('Maximum plot limit reached (12 plots)');
    }

    const priceIdx = currentCount - 6;
    const cost = priceIdx >= 0 ? (PLOT_PRICES[priceIdx] ?? PLOT_PRICES[PLOT_PRICES.length - 1]) : PLOT_PRICES[0];

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (Number(user.goldBalance) < cost) {
      throw new BadRequestException(`Not enough gold. Need ${cost}G to unlock this plot`);
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.update(User, userId, {
        goldBalance: () => `"gold_balance" - ${cost}`,
      });
      const newPlot = qr.manager.create(FarmPlot, { userId, plotIndex: currentCount });
      await qr.manager.save(FarmPlot, newPlot);
      await qr.commitTransaction();
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }

    const newCount = currentCount + 1;
    const nextPriceIdx = newCount - 6;
    const nextCost = newCount < MAX_PLOTS ? (PLOT_PRICES[nextPriceIdx] ?? null) : null;

    return { plotCount: newCount, cost, nextCost };
  }

  async upgradePlot(userId: string, plotId: string) {
    const plot = await this.plotRepo.findOne({ where: { id: plotId, userId } });
    if (!plot) throw new NotFoundException('Plot not found');
    if ((plot.level ?? 1) >= MAX_PLOT_LEVEL) {
      throw new BadRequestException('Plot is already at max level');
    }

    const currentLevel = plot.level ?? 1;
    const cost = UPGRADE_COSTS[currentLevel - 1];
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (Number(user.goldBalance) < cost) {
      throw new BadRequestException(`Not enough gold. Need ${cost}G to upgrade`);
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.update(User, userId, { goldBalance: () => `"gold_balance" - ${cost}` });
      await qr.manager.update(FarmPlot, plotId, { level: currentLevel + 1 });
      await qr.commitTransaction();
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }

    const newLevel = currentLevel + 1;
    return {
      level: newLevel,
      multiplier: UPGRADE_MULTIPLIERS[newLevel - 1],
      nextCost: newLevel < MAX_PLOT_LEVEL ? UPGRADE_COSTS[newLevel - 1] : null,
    };
  }

  static getNextPlotCost(currentCount: number): number | null {
    if (currentCount >= MAX_PLOTS) return null;
    const idx = currentCount - 6;
    return idx >= 0 ? (PLOT_PRICES[idx] ?? null) : null;
  }

  getTodayWeather() {
    const EVENTS = [
      {
        id: 'sunny',
        emoji: '☀️',
        name: 'Sunny Day',
        description: 'Perfect weather! Harvest yields +15% gold.',
        effect: 'harvest_gold_bonus',
        value: 0.15,
      },
      {
        id: 'rainy',
        emoji: '🌧️',
        name: 'Rainy Season',
        description: 'Crops grow 25% faster today.',
        effect: 'grow_speed_bonus',
        value: 0.25,
      },
      {
        id: 'golden',
        emoji: '✨',
        name: 'Golden Hour',
        description: 'All gold rewards doubled for today!',
        effect: 'gold_multiplier',
        value: 2.0,
      },
      {
        id: 'pest',
        emoji: '🐛',
        name: 'Pest Outbreak',
        description: 'Pests are destroying crops! Use Spray tool to protect.',
        effect: 'pest_damage',
        value: 0.10,
      },
      {
        id: 'storm',
        emoji: '⛈️',
        name: 'Storm Warning',
        description: 'Thieves struggle in the storm. Steal success -20%.',
        effect: 'steal_penalty',
        value: 0.20,
      },
      {
        id: 'harvest_festival',
        emoji: '🎉',
        name: 'Harvest Festival',
        description: 'Community event! Stealing is disabled, harvests give +30% gold.',
        effect: 'festival',
        value: 0.30,
      },
    ];

    // Deterministic pick from date — same for all players on same day
    const dateStr = new Date().toISOString().slice(0, 10); // "2026-09-09"
    let hash = 0;
    for (const ch of dateStr) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
    const idx = Math.abs(hash) % EVENTS.length;
    const event = EVENTS[idx];

    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);

    return {
      ...event,
      date: dateStr,
      expiresAt: tomorrow.toISOString(),
    };
  }
}
