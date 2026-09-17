import { Injectable, NotFoundException, BadRequestException, OnApplicationBootstrap, Logger } from '@nestjs/common';
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
export class FarmService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FarmService.name);
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
      this.dogRepo.find({ where: { ownerId: targetUserId, isActive: true, isGuarding: true } }),
    ]);

    // Highest defense pet among actively guarding and unlisted dogs
    const guardingDogs = dogs.filter((d) => d.isGuarding && !d.listingId);
    const activeDog = guardingDogs.length > 0
      ? guardingDogs.reduce((best, d) => d.defensePower > best.defensePower ? d : best)
      : null;
    const now = Date.now();

    return {
      userId: targetUserId,
      username: user.username,
      hasGuardDog: guardingDogs.length > 0,
      guardDogId: activeDog?.id ?? null,
      guardDogType: activeDog?.dogType ?? null,
      guardDogDefense: activeDog?.defensePower ?? 0,
      guardDogLastFedAt: activeDog?.lastFedAt ?? null,
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
          wateredThisCycle,
          soilFertility: plot.soilFertility ?? 100,
        };
      }),
    };
  }

  async ensureInitialPlots(userId: string): Promise<void> {
    const existingCount = await this.plotRepo.count({ where: { userId } });
    if (existingCount > 0) return;

    const initialPlots = (this.config.get<number>('game.initialPlots')) ?? 6;

    // INSERT ... ON CONFLICT DO NOTHING on the (user_id, plot_index) unique index.
    //
    // The count-then-save above is a check-then-act race, and first login is exactly
    // where it fires: GameProvider issues /user/profile and /farm/my in PARALLEL, so two
    // callers can both observe count === 0 and both try to insert plot 0..5. The index
    // rejects the loser with 23505, which escaped this method as an unhandled 500 — and
    // only ever for a brand-new account, never for an existing one.
    //
    // orIgnore() maps to ON CONFLICT DO NOTHING, so the loser is a no-op while any plot
    // genuinely missing from a half-provisioned account (older registerNewUser) is still
    // backfilled.
    await this.plotRepo
      .createQueryBuilder()
      .insert()
      .into(FarmPlot)
      .values(
        Array.from({ length: initialPlots }, (_, i) => ({ userId, plotIndex: i })),
      )
      .orIgnore()
      .execute();
  }

  async onApplicationBootstrap() {
    await this.ensureSeasonalSeeds();
  }

  async ensureSeasonalSeeds() {
    try {
      const seasonalSeeds = [
        {
          name: 'Moonlit Lotus',
          nameVi: 'Moonlit Lotus',
          category: 'flower',
          growTimeSec: 21600,
          growTimeHours: 6.0,
          costGold: 1200,
          baseYield: 2200,
          levelRequired: 3,
          iconKey: 'moonlit_lotus',
          isSeasonal: true,
          seasonalTag: 'autumn_harvest',
        },
        {
          name: 'Golden Starfruit',
          nameVi: 'Golden Starfruit',
          category: 'fruit',
          growTimeSec: 43200,
          growTimeHours: 12.0,
          costGold: 2800,
          baseYield: 5600,
          levelRequired: 7,
          iconKey: 'golden_starfruit',
          isSeasonal: true,
          seasonalTag: 'autumn_harvest',
        },
        {
          name: 'Harvest Feast Gourd',
          nameVi: 'Harvest Feast Gourd',
          category: 'fruit',
          growTimeSec: 64800,
          growTimeHours: 18.0,
          costGold: 3500,
          baseYield: 7500,
          levelRequired: 10,
          iconKey: 'harvest_gourd',
          isSeasonal: true,
          seasonalTag: 'autumn_harvest',
        },
        {
          name: 'Jack-o-Lantern',
          nameVi: 'Jack-o-Lantern',
          category: 'fruit',
          growTimeSec: 28800,
          growTimeHours: 8.0,
          costGold: 3000,
          baseYield: 6000,
          levelRequired: 8,
          iconKey: 'jackolantern',
          isSeasonal: true,
          seasonalTag: 'halloween',
        },
        {
          name: 'Candy Corn',
          nameVi: 'Candy Corn',
          category: 'grain',
          growTimeSec: 14400,
          growTimeHours: 4.0,
          costGold: 1500,
          baseYield: 2800,
          levelRequired: 5,
          iconKey: 'candycorn',
          isSeasonal: true,
          seasonalTag: 'halloween',
        },
        {
          name: 'Christmas Tree',
          nameVi: 'Christmas Tree',
          category: 'flower',
          growTimeSec: 57600,
          growTimeHours: 16.0,
          costGold: 5000,
          baseYield: 10000,
          levelRequired: 12,
          iconKey: 'christmastree',
          isSeasonal: true,
          seasonalTag: 'christmas',
        },
        {
          name: 'Snowdrop',
          nameVi: 'Snowdrop',
          category: 'flower',
          growTimeSec: 7200,
          growTimeHours: 2.0,
          costGold: 800,
          baseYield: 1400,
          levelRequired: 3,
          iconKey: 'snowdrop',
          isSeasonal: true,
          seasonalTag: 'christmas',
        },
        {
          name: 'Lucky Bamboo',
          nameVi: 'Lucky Bamboo',
          category: 'flower',
          growTimeSec: 21600,
          growTimeHours: 6.0,
          costGold: 2000,
          baseYield: 4000,
          levelRequired: 6,
          iconKey: 'luckybamboo',
          isSeasonal: true,
          seasonalTag: 'lunar',
        },
      ];

      for (const s of seasonalSeeds) {
        const existing = await this.seedRepo.findOne({ where: { name: s.name } });
        if (!existing) {
          await this.seedRepo.save(this.seedRepo.create(s));
          this.logger.log(`Initialized seasonal seed: ${s.name} (${s.seasonalTag})`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not ensure seasonal seeds: ${err.message}`);
    }
  }

  getActiveSeasonalEvent(): string {
    const envOverride = this.config.get<string>('seasonal.event') ?? 'none';
    if (envOverride !== 'none') return envOverride;
    // Auto-detect by calendar date
    const now = new Date();
    const m = now.getUTCMonth() + 1; // 1-12
    const d = now.getUTCDate();
    if (m === 9 || (m === 10 && d <= 14))                return 'autumn_harvest';
    if ((m === 10 && d >= 15) || (m === 10 && d <= 31)) return 'halloween';
    if ((m === 12 && d >= 20) || (m === 1 && d <= 1))   return 'christmas';
    if ((m === 1 && d >= 28) || (m === 2 && d <= 7))    return 'lunar';
    if (m === 7 && d <= 15)                              return 'summer';
    return 'none';
  }

  async getSeeds(): Promise<SeedConfig[]> {
    const activeEvent = this.getActiveSeasonalEvent();
    const seeds = await this.seedRepo.find({ order: { levelRequired: 'ASC' } });
    // Filter: show regular seeds + seeds matching the active seasonal event
    return seeds.filter(s => !s.isSeasonal || s.seasonalTag === activeEvent);
  }

  getSeasonalEventInfo(): { event: string; endsAt: string | null } {
    const event = this.getActiveSeasonalEvent();
    const now = new Date();
    const y = now.getUTCFullYear();
    const endsAtMap: Record<string, Date> = {
      autumn_harvest: new Date(`${y}-10-14T23:59:59Z`),
      halloween:      new Date(`${y}-10-31T23:59:59Z`),
      christmas:      new Date(`${y + (now.getUTCMonth() >= 11 ? 1 : 0)}-01-01T23:59:59Z`),
      lunar:          new Date(`${y}-02-07T23:59:59Z`),
      summer:         new Date(`${y}-07-15T23:59:59Z`),
    };
    return { event, endsAt: endsAtMap[event]?.toISOString() ?? null };
  }

  async buyPlot(userId: string) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const user = await qr.manager
        .createQueryBuilder(User, 'u')
        .where('u.id = :id', { id: userId })
        .setLock('pessimistic_write')
        .getOne();
      if (!user) throw new NotFoundException('User not found');

      const currentCount = await qr.manager.count(FarmPlot, { where: { userId } });
      if (currentCount >= MAX_PLOTS) {
        throw new BadRequestException('Maximum plot limit reached (12 plots)');
      }

      const priceIdx = currentCount - 6;
      const cost = priceIdx >= 0 ? (PLOT_PRICES[priceIdx] ?? PLOT_PRICES[PLOT_PRICES.length - 1]) : PLOT_PRICES[0];

      if (Number(user.goldBalance) < cost) {
        throw new BadRequestException(`Not enough gold. Need ${cost}G to unlock this plot`);
      }

      await qr.manager.update(User, userId, { goldBalance: () => `"gold_balance" - ${cost}` });
      await qr.manager.save(FarmPlot, qr.manager.create(FarmPlot, { userId, plotIndex: currentCount }));
      await qr.commitTransaction();

      const newCount = currentCount + 1;
      const nextPriceIdx = newCount - 6;
      const nextCost = newCount < MAX_PLOTS ? (PLOT_PRICES[nextPriceIdx] ?? null) : null;

      return { plotCount: newCount, cost, nextCost };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async upgradePlot(userId: string, plotId: string) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [plot, user] = await Promise.all([
        qr.manager.createQueryBuilder(FarmPlot, 'p')
          .where('p.id = :id AND p.user_id = :userId', { id: plotId, userId })
          .setLock('pessimistic_write')
          .getOne(),
        qr.manager.createQueryBuilder(User, 'u')
          .where('u.id = :id', { id: userId })
          .setLock('pessimistic_write')
          .getOne(),
      ]);

      if (!plot) throw new NotFoundException('Plot not found');
      if (!user) throw new NotFoundException('User not found');

      const currentLevel = plot.level ?? 1;
      if (currentLevel >= MAX_PLOT_LEVEL) {
        throw new BadRequestException('Plot is already at max level');
      }

      const cost = UPGRADE_COSTS[currentLevel - 1];
      if (Number(user.goldBalance) < cost) {
        throw new BadRequestException(`Not enough gold. Need ${cost}G to upgrade`);
      }

      await qr.manager.update(User, userId, { goldBalance: () => `"gold_balance" - ${cost}` });
      await qr.manager.update(FarmPlot, plotId, { level: currentLevel + 1 });
      await qr.commitTransaction();

      const newLevel = currentLevel + 1;
      return {
        level: newLevel,
        multiplier: UPGRADE_MULTIPLIERS[newLevel - 1],
        nextCost: newLevel < MAX_PLOT_LEVEL ? UPGRADE_COSTS[newLevel - 1] : null,
      };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
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
