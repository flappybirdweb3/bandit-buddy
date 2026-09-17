import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, MoreThan, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';
import { StealLog } from '../farm/entities/steal-log.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';
import { FarmBuilding } from '../farm/entities/farm-building.entity';
import { User } from '../user/entities/user.entity';
import { UserItem } from '../user/entities/user-item.entity';
import { Subscription } from '../guild/entities/subscription.entity';
import { PlantDto, HarvestDto, StealDto, RevealThiefDto } from './dto/action.dto';
import { NotificationService } from '../notification/notification.service';
import { QuestService } from '../quest/quest.service';
import { UserService } from '../user/user.service';
import { UPGRADE_MULTIPLIERS } from '../farm/farm.service';
import { AntiCheatService } from '../../common/anti-cheat.service';

// Cost to repair 10% durability
const REPAIR_COST_PER_10PCT = 50; // 50 GOLD per 10%

// ── Anti-bot constants ────────────────────────────────────────────
const MAX_DAILY_STEALS        = 5;
const FARM_RAID_COOLDOWN_MS   = 24 * 60 * 60 * 1000; // 24 h
const MAX_TRUST               = 200;   // level = floor(trust/10), max level = 20 (covers all seeds up to lvl 18)
const MIN_TRUST               = 0;
const TRUST_PER_HARVEST       = 1;
const TRUST_PER_DAILY_CLAIM   = 2;   // applied in UserService
const CONSEC_FAIL_THRESHOLD   = 3;   // consecutive dog-bites before trust penalty
const TRUST_BOT_PENALTY       = 2;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// Deterministic weather — same logic as FarmService.getTodayWeather()
type WeatherEffect = 'harvest_gold_bonus' | 'grow_speed_bonus' | 'gold_multiplier' | 'pest_damage' | 'steal_penalty' | 'festival';
interface WeatherToday { effect: WeatherEffect; value: number }

function getTodayWeather(): WeatherToday {
  const EVENTS: WeatherToday[] = [
    { effect: 'harvest_gold_bonus', value: 0.15 },
    { effect: 'grow_speed_bonus',   value: 0.25 },
    { effect: 'gold_multiplier',    value: 2.0  },
    { effect: 'pest_damage',        value: 0.10 },
    { effect: 'steal_penalty',      value: 0.20 },
    { effect: 'festival',           value: 0.30 },
  ];
  const dateStr = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (const ch of dateStr) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return EVENTS[Math.abs(hash) % EVENTS.length];
}

@Injectable()
export class ActionService {
  constructor(
    @InjectRepository(FarmPlot)
    private readonly plotRepo: Repository<FarmPlot>,
    @InjectRepository(SeedConfig)
    private readonly seedRepo: Repository<SeedConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(StealLog)
    private readonly stealLogRepo: Repository<StealLog>,
    @InjectRepository(NftGuardDog)
    private readonly dogRepo: Repository<NftGuardDog>,
    @InjectRepository(FarmBuilding)
    private readonly buildingRepo: Repository<FarmBuilding>,
    @InjectRepository(UserItem)
    private readonly itemRepo: Repository<UserItem>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly questService: QuestService,
    private readonly antiCheat: AntiCheatService,
    private readonly userService: UserService,
  ) {}

  private cfg<T>(key: string): T {
    return this.config.get<T>(key) as T;
  }

  // ─────────────────────────────────────────────────────────────
  //  PLANT
  // ─────────────────────────────────────────────────────────────
  async plant(userId: string, dto: PlantDto) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const plot = await qr.manager.findOne(FarmPlot, { where: { id: dto.plotId, userId } });
      const seed = await qr.manager.findOne(SeedConfig, { where: { id: dto.seedId } });
      const user = await qr.manager.findOne(User, { where: { id: userId } });

      if (!plot) throw new NotFoundException('Plot not found or not yours');
      if (!seed)  throw new NotFoundException('Seed not found');
      if (!user)  throw new NotFoundException('User not found');
      if (plot.seedId) throw new BadRequestException('Plot already has a crop planted');

      // Soil fertility gate: 0% means soil is exhausted, must restore with compost
      if ((plot.soilFertility ?? 100) <= 0) {
        throw new BadRequestException('🌱 Soil exhausted! Buy Basic Compost from the shop to restore fertility.');
      }

      const playerLevel = Math.floor(user.trustScore / 10);
      if (playerLevel < (seed.levelRequired ?? 0)) {
        throw new BadRequestException(`Need level ${seed.levelRequired} to plant ${seed.name}. You are level ${playerLevel}.`);
      }

      if (Number(user.goldBalance) < Number(seed.costGold)) {
        throw new BadRequestException(`Insufficient GOLD. Need ${seed.costGold}, have ${user.goldBalance}`);
      }

      const now = new Date();
      const weather = getTodayWeather();
      const growSec = weather.effect === 'grow_speed_bonus'
        ? Math.round(seed.growTimeSec * (1 - weather.value))
        : seed.growTimeSec;
      const harvestableAt = new Date(now.getTime() + growSec * 1000);

      await qr.manager.update(FarmPlot, plot.id, {
        seedId: seed.id, plantedAt: now, harvestableAt, totalStolen: 0,
      });
      await qr.manager.decrement(User, { id: userId }, 'goldBalance', Number(seed.costGold));
      await qr.manager.increment(User, { id: userId }, 'totalPlants', 1);
      await qr.manager.query(
        `INSERT INTO gold_transactions (user_id, amount, type, category, description) VALUES ($1, $2, 'BURN', 'SEED_PURCHASE', $3)`,
        [userId, Number(seed.costGold), `Plant ${seed.name}`],
      ).catch(() => {});
      await qr.commitTransaction();

      // Quest progress (non-blocking)
      this.questService.onPlant(userId, 1).catch(() => {});

      return {
        message: weather.effect === 'grow_speed_bonus'
          ? `🌧️ Rainy bonus! ${seed.name} grows ${Math.round(weather.value * 100)}% faster`
          : `${seed.name} planted successfully`,
        harvestableAt,
        costGold: Number(seed.costGold),
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  PLANT ALL — plant every empty plot with the same seed
  // ─────────────────────────────────────────────────────────────
  async plantAll(userId: string, seedId: string) {
    const seed = await this.dataSource.getRepository(SeedConfig).findOne({ where: { id: seedId } });
    if (!seed) throw new NotFoundException('Seed not found');

    const emptyPlots = await this.dataSource
      .getRepository(FarmPlot)
      .find({ where: { userId, seedId: IsNull() } });

    if (emptyPlots.length === 0) {
      return { planted: 0, totalCost: 0, message: 'No empty plots to plant.' };
    }

    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const playerLevel = Math.floor((user.trustScore ?? 0) / 10);
    if (playerLevel < (seed.levelRequired ?? 0)) {
      throw new BadRequestException(`Need level ${seed.levelRequired} to plant ${seed.name}. You are level ${playerLevel}.`);
    }

    // Filter out exhausted plots (soilFertility <= 0)
    const plantablePlots = emptyPlots.filter((p) => (p.soilFertility ?? 100) > 0);
    if (plantablePlots.length === 0) {
      throw new BadRequestException('All plots have exhausted soil — buy Compost from the Shop to restore fertility.');
    }

    const costPer   = Number(seed.costGold);
    const maxAfford = Math.floor(Number(user.goldBalance) / costPer);
    const toPlant   = plantablePlots.slice(0, Math.max(0, maxAfford));

    if (toPlant.length === 0) {
      throw new BadRequestException(`Insufficient GOLD. Need ${costPer}G per plot, have ${user.goldBalance.toFixed(0)}G`);
    }

    const totalCost = toPlant.length * costPer;
    const now       = new Date();
    const weather   = getTodayWeather();
    const growSec   = weather.effect === 'grow_speed_bonus'
      ? Math.round(seed.growTimeSec * (1 - weather.value))
      : seed.growTimeSec;
    const harvestableAt = new Date(now.getTime() + growSec * 1000);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const plot of toPlant) {
        await qr.manager.update(FarmPlot, plot.id, {
          seedId: seed.id, plantedAt: now, harvestableAt, totalStolen: 0,
        });
      }
      await qr.manager.decrement(User, { id: userId }, 'goldBalance', totalCost);
      await qr.manager.query(
        `INSERT INTO gold_transactions (user_id, amount, type, category, description) VALUES ($1, $2, 'BURN', 'SEED_PURCHASE', $3)`,
        [userId, totalCost, `Plant all ${toPlant.length} seeds`],
      ).catch(() => {});
      await qr.manager.createQueryBuilder()
        .update(User)
        .set({ totalPlants: () => `"total_plants" + ${toPlant.length}` })
        .where('id = :id', { id: userId })
        .execute();
      await qr.commitTransaction();

      this.questService.onPlant(userId, toPlant.length).catch(() => {});

      return {
        planted: toPlant.length,
        skipped: emptyPlots.length - toPlant.length,
        totalCost,
        message: `Planted ${toPlant.length} ${seed.name} for ${totalCost}G!`,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  HARVEST  (+1 trust per crop)
  // ─────────────────────────────────────────────────────────────
  async harvest(userId: string, dto: HarvestDto) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const plot = await qr.manager
        .createQueryBuilder(FarmPlot, 'plot')
        .innerJoinAndSelect('plot.seed', 'seed')
        .where('plot.id = :id AND plot.user_id = :userId', { id: dto.plotId, userId })
        .setLock('pessimistic_write')
        .getOne();

      if (!plot)               throw new NotFoundException('Plot not found or not yours');
      if (!plot.seedId)        throw new BadRequestException('Plot has no crop');
      if (!plot.harvestableAt) throw new BadRequestException('Plot has no harvest time');

      const userForTrust = await qr.manager.findOne(User, { where: { id: userId }, select: ['id', 'trustScore', 'referredBy'] });
      const prevTrust = userForTrust?.trustScore ?? 0;

      const now = Date.now();
      if (now < plot.harvestableAt.getTime()) {
        const remainSec = Math.ceil((plot.harvestableAt.getTime() - now) / 1000);
        throw new BadRequestException(`Crop not ready. ${remainSec}s remaining`);
      }

      // Anti-cheat: flag suspiciously precise harvest timing (bot signal)
      this.antiCheat.checkHarvestTiming(userId, plot.harvestableAt).catch(() => {});

      const baseYield       = Number(plot.seed!.baseYield);
      const levelMultiplier = UPGRADE_MULTIPLIERS[(plot.level ?? 1) - 1] ?? 1.0;
      const effectiveYield  = baseYield * levelMultiplier;
      const totalStolen     = Number(plot.totalStolen);

      // ── Soil Fertility multiplier (#37) ──────────────────────────
      const soilFertility    = plot.soilFertility ?? 100;
      const soilMult         = soilFertility / 100;
      const newSoilFertility = Math.max(0, soilFertility - 20);

      // Apply weather multiplier
      const weather = getTodayWeather();
      let weatherMultiplier = 1.0;
      if (weather.effect === 'harvest_gold_bonus') weatherMultiplier = 1 + weather.value;
      if (weather.effect === 'gold_multiplier')    weatherMultiplier = weather.value;
      if (weather.effect === 'festival')           weatherMultiplier = 1 + weather.value;
      // Pest damage skipped if plot was fertilized (sprayed)
      if (weather.effect === 'pest_damage' && !plot.fertilized) weatherMultiplier = 1 - weather.value;

      // Infestation penalties (applied before stolen deduction)
      let infestMult = 1.0;
      if (plot.hasBugs)  infestMult -= 0.20;
      if (plot.hasWeeds) infestMult -= 0.30;
      infestMult = Math.max(0, infestMult);

      // Dry soil penalty: -15% if never watered this planting cycle
      const wateredThisCycle = plot.lastWateredAt !== null && plot.plantedAt !== null
        && plot.lastWateredAt >= plot.plantedAt;
      const dryMult = wateredThisCycle ? 1.0 : 0.85;

      const actualYield = Math.max(0, effectiveYield * soilMult * weatherMultiplier * infestMult * dryMult - totalStolen);

      // Clear plot + apply soil fertility decay
      await qr.manager.createQueryBuilder()
        .update(FarmPlot)
        .set({ seedId: null, plantedAt: null, harvestableAt: null, totalStolen: 0, lastStolenAt: null,
               fertilized: false, hasBugs: false, hasWeeds: false, lastWateredAt: null,
               soilFertility: newSoilFertility })
        .where('id = :id', { id: plot.id })
        .execute();

      // Harvest → user_items (crop inventory) instead of direct GOLD
      // Player then chooses: "Sell to System" (1:1 GOLD) or "Pack Crate" (tradeable on Marketplace)
      if (actualYield > 0) {
        const cropKey = plot.seed!.iconKey ?? plot.seed!.name.toLowerCase().replace(/\s+/g, '_');
        const cropItemType = `crop_${cropKey}`;
        await qr.manager.query(
          `INSERT INTO user_items (user_id, item_type, quantity, locked_quantity)
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (user_id, item_type)
           DO UPDATE SET quantity = user_items.quantity + $3`,
          [userId, cropItemType, Math.floor(actualYield)],
        );
      }

      // ── Trust accrual + harvest counter ──
      const newTrust  = Math.min(MAX_TRUST, prevTrust + TRUST_PER_HARVEST);
      await qr.manager.createQueryBuilder()
        .update(User)
        .set({
          trustScore:     () => `LEAST(${MAX_TRUST}, "trust_score" + ${TRUST_PER_HARVEST})`,
          totalHarvests:  () => '"total_harvests" + 1',
        })
        .where('id = :id', { id: userId })
        .execute();

      await qr.commitTransaction();

      const prevLevel = Math.floor(prevTrust / 10);
      const newLevel  = Math.floor(newTrust / 10);
      const levelUp   = newLevel > prevLevel;

      if (newLevel >= 3 && prevLevel < 3 && userForTrust?.referredBy) {
        this.userService.checkAndGrantMasterKeys(userForTrust.referredBy).catch(() => {});
      }

      // Quest progress (non-blocking)
      this.questService.onHarvest(userId, 1, Math.floor(actualYield)).catch(() => {});

      const weatherMsg =
        weather.effect === 'harvest_gold_bonus' ? ` ☀️ +${Math.round(weather.value * 100)}% weather bonus!` :
        weather.effect === 'gold_multiplier'    ? ` ✨ Golden Hour ×${weather.value}!` :
        weather.effect === 'festival'           ? ` 🎉 Festival +${Math.round(weather.value * 100)}%!` :
        weather.effect === 'pest_damage' && !plot.fertilized ? ` 🐛 Pest ate ${Math.round(weather.value * 100)}%!` : '';

      const infestMsg =
        plot.hasBugs && plot.hasWeeds ? ' 🐛🌿 −50% (bugs + weeds)' :
        plot.hasBugs  ? ' 🐛 −20% (bugs)' :
        plot.hasWeeds ? ' 🌿 −30% (weeds)' : '';

      const dryMsg = !wateredThisCycle ? ' 🏜️ −15% (dry soil)' : '';

      const cropKey = plot.seed!.iconKey ?? plot.seed!.name.toLowerCase().replace(/\s+/g, '_');
      const soilMsg = soilFertility < 100 ? ` 🌱 Soil ${soilFertility}%→${newSoilFertility}%` : '';
      return {
        message: `Harvested ${Math.floor(actualYield)} ${plot.seed!.name}${weatherMsg}${infestMsg}${dryMsg}${soilMsg}`,
        cropEarned: Math.floor(actualYield),
        cropType: `crop_${cropKey}`,
        goldLostToThieves: totalStolen,
        fertilizerUsed: plot.fertilized,
        hadBugs: plot.hasBugs,
        hadWeeds: plot.hasWeeds,
        hadDrySoil: !wateredThisCycle,
        soilFertilityBefore: soilFertility,
        soilFertilityAfter: newSoilFertility,
        levelUp,
        newLevel,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  HARVEST ALL — harvest every ripe plot in one request
  // ─────────────────────────────────────────────────────────────
  async harvestAll(userId: string) {
    const now = new Date();

    const ripePlots = await this.dataSource
      .createQueryBuilder(FarmPlot, 'plot')
      .innerJoinAndSelect('plot.seed', 'seed')
      .where('plot.user_id = :userId', { userId })
      .andWhere('plot.seed_id IS NOT NULL')
      .andWhere('plot.harvestable_at <= :now', { now })
      .getMany();

    if (ripePlots.length === 0) {
      return { harvested: 0, totalGold: 0, message: 'No ripe crops to harvest.', levelUp: false, newLevel: 0 };
    }

    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'trustScore', 'referredBy'] });
    const prevTrustAll = user?.trustScore ?? 0;

    const weather = getTodayWeather();
    let weatherMult = 1.0;
    if (weather.effect === 'harvest_gold_bonus') weatherMult = 1 + weather.value;
    if (weather.effect === 'gold_multiplier')    weatherMult = weather.value;
    if (weather.effect === 'festival')           weatherMult = 1 + weather.value;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // Accumulate crop yields per item_type
      const cropYields = new Map<string, number>();
      let totalUnits = 0;

      for (const plot of ripePlots) {
        const baseYield       = Number(plot.seed!.baseYield);
        const levelMult       = UPGRADE_MULTIPLIERS[(plot.level ?? 1) - 1] ?? 1.0;
        const plotWeatherMult = weather.effect === 'pest_damage' && !plot.fertilized
          ? (1 - weather.value) : weatherMult;
        let infestMult = 1.0;
        if (plot.hasBugs)  infestMult -= 0.20;
        if (plot.hasWeeds) infestMult -= 0.30;
        infestMult = Math.max(0, infestMult);
        const wateredThisCycle = plot.lastWateredAt !== null && plot.plantedAt !== null
          && plot.lastWateredAt >= plot.plantedAt;
        const dryMult    = wateredThisCycle ? 1.0 : 0.85;
        const soilFert   = plot.soilFertility ?? 100;
        const soilMult   = soilFert / 100;
        const newSoilFertility = Math.max(0, soilFert - 20);
        const actualYield = Math.max(0, baseYield * levelMult * soilMult * plotWeatherMult * infestMult * dryMult - Number(plot.totalStolen));
        const cropKey = plot.seed!.iconKey ?? plot.seed!.name.toLowerCase().replace(/\s+/g, '_');
        const cropItemType = `crop_${cropKey}`;
        const floorYield = Math.floor(actualYield);
        cropYields.set(cropItemType, (cropYields.get(cropItemType) ?? 0) + floorYield);
        totalUnits += floorYield;

        await qr.manager.createQueryBuilder()
          .update(FarmPlot)
          .set({ seedId: null, plantedAt: null, harvestableAt: null, totalStolen: 0, lastStolenAt: null,
                 fertilized: false, hasBugs: false, hasWeeds: false, lastWateredAt: null, soilFertility: newSoilFertility })
          .where('id = :id', { id: plot.id })
          .execute();
      }

      // Upsert all crop types into user_items
      for (const [cropItemType, qty] of cropYields) {
        if (qty > 0) {
          await qr.manager.query(
            `INSERT INTO user_items (user_id, item_type, quantity, locked_quantity)
             VALUES ($1, $2, $3, 0)
             ON CONFLICT (user_id, item_type)
             DO UPDATE SET quantity = user_items.quantity + $3`,
            [userId, cropItemType, qty],
          );
        }
      }

      await qr.manager.createQueryBuilder()
        .update(User)
        .set({
          trustScore:    () => `LEAST(${MAX_TRUST}, "trust_score" + ${TRUST_PER_HARVEST * ripePlots.length})`,
          totalHarvests: () => `"total_harvests" + ${ripePlots.length}`,
        })
        .where('id = :id', { id: userId })
        .execute();

      await qr.commitTransaction();

      // Quest progress (non-blocking)
      this.questService.onHarvest(userId, ripePlots.length, Math.floor(totalUnits)).catch(() => {});

      const newTrustAll  = Math.min(MAX_TRUST, prevTrustAll + TRUST_PER_HARVEST * ripePlots.length);
      const prevLevelAll = Math.floor(prevTrustAll / 10);
      const newLevelAll  = Math.floor(newTrustAll / 10);
      const levelUpAll   = newLevelAll > prevLevelAll;

      if (newLevelAll >= 3 && prevLevelAll < 3 && user?.referredBy) {
        this.userService.checkAndGrantMasterKeys(user.referredBy).catch(() => {});
      }

      const weatherSuffix =
        weather.effect === 'harvest_gold_bonus' ? ` ☀️ +${Math.round(weather.value * 100)}% weather!` :
        weather.effect === 'gold_multiplier'    ? ` ✨ Golden Hour ×${weather.value}!` :
        weather.effect === 'festival'           ? ` 🎉 Festival +${Math.round(weather.value * 100)}%!` :
        weather.effect === 'pest_damage'        ? ` 🐛 Pests hit unsprayed crops!` : '';

      const cropSummary = [...cropYields.entries()]
        .filter(([, q]) => q > 0)
        .map(([type, q]) => `${q} ${type.replace('crop_', '')}`)
        .join(', ');

      return {
        harvested: ripePlots.length,
        totalCrops: totalUnits,
        crops: Object.fromEntries(cropYields),
        message: `Harvested ${ripePlots.length} crops! Got: ${cropSummary}${weatherSuffix}`,
        levelUp: levelUpAll,
        newLevel: newLevelAll,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  STEAL — with daily quota + 24h farm protection + trust accrual
  // ─────────────────────────────────────────────────────────────
  async steal(thiefId: string, dto: StealDto): Promise<{ success: boolean; goldChange: number; message: string; fenceBypass?: boolean; masterKeyUsed?: boolean; isRevenge?: boolean; insurancePayout?: number }> {
    if (thiefId === dto.targetUserId) {
      throw new BadRequestException('You cannot steal from yourself');
    }

    const stealEnergyCost = this.cfg<number>('game.stealEnergyCost');
    const today = todayUTC();

    // Anti-cheat: track steal rate; trust penalty applied async if flood detected
    this.antiCheat.trackSteal(thiefId).catch(() => {});

    // ── Pre-checks (fast, before acquiring transaction locks) ──────

    const thief = await this.userRepo.findOne({ where: { id: thiefId } });
    if (!thief) throw new NotFoundException('User not found');

    if (thief.energy < stealEnergyCost) {
      throw new BadRequestException(`Insufficient energy. Need ${stealEnergyCost}, have ${thief.energy}`);
    }

    // Daily steal quota
    const isNewDay    = thief.lastStealDate !== today;
    const dailyCount  = isNewDay ? 0 : (thief.dailyStealCount ?? 0);
    if (dailyCount >= MAX_DAILY_STEALS) {
      throw new BadRequestException(
        `Daily steal limit reached (${MAX_DAILY_STEALS}/day). Resets at midnight UTC!`,
      );
    }

    // Check revenge eligibility first (target was unmasked by this player within 24 hours)
    const revengeCutoff = new Date(Date.now() - FARM_RAID_COOLDOWN_MS);
    const preRevengeLog = await this.stealLogRepo.findOne({
      where: {
        thiefId: dto.targetUserId,
        victimId: thiefId,
        isAnonymous: false,
        success: true,
        createdAt: MoreThan(revengeCutoff),
      },
    });
    const isRevengeEligible = !!(preRevengeLog || dto.isRevenge);

    // 24-hour farm protection — check if ANY of victim's plots was stolen recently
    // (Bypassed if this is a legitimate 24h Revenge Raid)
    const protectedSince = new Date(Date.now() - FARM_RAID_COOLDOWN_MS);
    if (!isRevengeEligible) {
      const recentRaid = await this.plotRepo
        .createQueryBuilder('p')
        .where('p.user_id = :uid', { uid: dto.targetUserId })
        .andWhere('p.last_stolen_at > :since', { since: protectedSince })
        .getOne();

      if (recentRaid) {
        const protectedUntil = new Date((recentRaid.lastStolenAt as Date).getTime() + FARM_RAID_COOLDOWN_MS);
        const remainMin = Math.ceil((protectedUntil.getTime() - Date.now()) / 60_000);
        throw new BadRequestException(
          `🛡️ This farm was recently raided and is protected for ${remainMin} more minute${remainMin !== 1 ? 's' : ''}.`,
        );
      }
    }

    // ── Critical transaction ──────────────────────────────────────
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction(); // READ COMMITTED + pessimistic_write locks are sufficient
    try {
      // Lock the target plot first (prevents race on the same crop)
      const plot = await qr.manager
        .createQueryBuilder(FarmPlot, 'plot')
        .innerJoinAndSelect('plot.seed', 'seed')
        .where('plot.id = :plotId AND plot.user_id = :victimId', {
          plotId: dto.plotId, victimId: dto.targetUserId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!plot)                   throw new NotFoundException('Target plot not found');
      if (!plot.seedId || !plot.seed) throw new BadRequestException('Target plot has no crop');
      if (!plot.harvestableAt)     throw new BadRequestException('Crop has no harvest time');

      const now = Date.now();
      if (now < plot.harvestableAt.getTime()) {
        throw new BadRequestException('Crop is not ripe yet');
      }

      // PVP-05: Check revenge window (target was unmasked by this player within 24 hours)
      let isRevenge = false;
      const revengeLog = await qr.manager.findOne(StealLog, {
        where: {
          thiefId: dto.targetUserId,
          victimId: thiefId,
          isAnonymous: false,
          success: true,
          createdAt: MoreThan(revengeCutoff),
        },
      });
      if (revengeLog || dto.isRevenge) {
        isRevenge = true;
      }

      // Re-check 24h protection inside transaction (bypassed for legitimate revenge raids)
      if (!isRevenge) {
        const recentRaidTx = await qr.manager
          .createQueryBuilder(FarmPlot, 'p')
          .where('p.user_id = :uid', { uid: dto.targetUserId })
          .andWhere('p.last_stolen_at > :since', { since: protectedSince })
          .getOne();

        if (recentRaidTx) {
          throw new BadRequestException('🛡️ Farm is protected — another raider just hit it.');
        }
      }

      const baseYield       = Number(plot.seed.baseYield);
      const levelMultiplier = UPGRADE_MULTIPLIERS[(plot.level ?? 1) - 1] ?? 1.0;
      const effectiveYield  = baseYield * levelMultiplier;
      const maxStealPercent = isRevenge ? 0.35 : this.cfg<number>('game.maxStealPercent');
      const maxStealable    = effectiveYield * maxStealPercent;
      const currentStolen   = Number(plot.totalStolen);
      const remaining       = maxStealable - currentStolen;

      if (remaining <= 0) {
        throw new BadRequestException(
          isRevenge
            ? 'This crop has already reached its 35% revenge steal limit'
            : 'This crop has already been stolen to its 20% limit',
        );
      }

      // Lock thief row (for accurate gold/energy reads)
      const thiefLocked = await qr.manager
        .createQueryBuilder(User, 'u')
        .where('u.id = :id', { id: thiefId })
        .setLock('pessimistic_write')
        .getOne();

      if (!thiefLocked) throw new NotFoundException('Thief not found');
      if (thiefLocked.energy < stealEnergyCost) {
        throw new BadRequestException('Insufficient energy (race condition)');
      }

      // Re-check daily quota inside transaction
      const lockedDay   = thiefLocked.lastStealDate !== today;
      const lockedCount = lockedDay ? 0 : (thiefLocked.dailyStealCount ?? 0);
      if (lockedCount >= MAX_DAILY_STEALS) {
        throw new BadRequestException(`Daily steal limit reached (${MAX_DAILY_STEALS}/day).`);
      }

      // Weather check — festival disables stealing entirely
      const weather = getTodayWeather();
      if (weather.effect === 'festival') {
        await qr.rollbackTransaction();
        throw new BadRequestException('🎉 Harvest Festival! Stealing is disabled today — come back tomorrow.');
      }

      // ── Farm Maintenance: fence durability (#36) ─────────────────
      const building = await qr.manager.findOne(FarmBuilding, {
        where: { userId: dto.targetUserId },
      });
      const currentDurability = building ? building.getCurrentDurability() : 100;
      const fenceBypass = currentDurability <= 0; // 0% fence = guard dogs ignored

      // ── Master Key (#38): consume to bypass guard dogs ────────────
      let masterKeyUsed = false;
      if (dto.useMasterKey) {
        const keyItem = await qr.manager.findOne(UserItem, {
          where: { userId: thiefId, itemType: 'master_key' },
        });
        if (!keyItem || keyItem.quantity < 1) {
          throw new BadRequestException('No Master Key in inventory');
        }
        // Consume only on successful result — deduct now, record flag
        masterKeyUsed = true;
        await qr.manager.decrement(UserItem, { userId: thiefId, itemType: 'master_key' }, 'quantity', 1);
      }

      // Guard dog defense — only dogs that are actively guarding (not stored/listed)
      const dogs = await qr.manager.find(NftGuardDog, {
        where: { ownerId: dto.targetUserId, isActive: true, isGuarding: true },
      });
      // Hunger-adjusted defense (#55): unfed 24h → 50%, unfed 48h → 0%
      const activeGuardingDogs = dogs.filter((d) => d.isGuarding && !d.listingId);
      const rawDefense = activeGuardingDogs.reduce((sum, d) => {
        const hoursSinceFed = (Date.now() - new Date(d.lastFedAt).getTime()) / 3_600_000;
        const mult = hoursSinceFed < 24 ? 1 : hoursSinceFed < 48 ? 0.5 : 0;
        return sum + Math.floor(d.defensePower * mult);
      }, 0);
      const totalDefensePower = (fenceBypass || masterKeyUsed) ? 0 : rawDefense;
      const baseRate    = this.cfg<number>('game.baseStealSuccessRate');
      const weatherPenalty = weather.effect === 'steal_penalty' ? weather.value * 100 : 0;
      const successRate = Math.max(0, Math.min(baseRate, baseRate - totalDefensePower - weatherPenalty));
      const isSuccess   = (Math.random() * 100) <= successRate;

      // ── Update daily steal counter (always, win or lose) ─────────
      await qr.manager.createQueryBuilder()
        .update(User)
        .set({
          dailyStealCount: lockedDay ? 1 : () => `"daily_steal_count" + 1`,
          lastStealDate: today,
        })
        .where('id = :id', { id: thiefId })
        .execute();

      // ─────────────────────────────────────────────────────────────
      if (isSuccess) {
        const stealActionPercent = isRevenge ? 0.35 : this.cfg<number>('game.stealPerActionPercent');
        const stealAmount = Math.min(
          effectiveYield * stealActionPercent,
          remaining,
        );

        // Update plot stolen totals
        await qr.manager.createQueryBuilder()
          .update(FarmPlot)
          .set({ totalStolen: () => `"total_stolen" + ${stealAmount}`, lastStolenAt: new Date() })
          .where('id = :id', { id: plot.id })
          .execute();

        // Thief: +gold, +gold_stolen (leaderboard), -energy, reset consecutive failures, maybe +trust
        const thievConsecFails = thiefLocked.consecutiveStealFailures ?? 0;
        await qr.manager.createQueryBuilder()
          .update(User)
          .set({
            goldBalance:  () => `"gold_balance" + ${stealAmount}`,
            goldStolen:   () => `"gold_stolen" + ${stealAmount}`,
            energy:       () => `"energy" - ${stealEnergyCost}`,
            consecutiveStealFailures: 0,
            // +1 trust per success, but only if we were at risk (defense > 0)
            trustScore: totalDefensePower > 0
              ? () => `LEAST(${MAX_TRUST}, "trust_score" + 1)`
              : () => `"trust_score"`,
          })
          .where('id = :id', { id: thiefId })
          .execute();

        // SUB-02: Auto-reimburse 80% if victim has active crop insurance
        let insurancePayout = 0;
        const now = new Date();
        const activeInsurance = await qr.manager.findOne(Subscription, {
          where: [
            { userId: dto.targetUserId, type: 'crop_insurance', expiresAt: MoreThan(now) },
            { userId: dto.targetUserId, type: 'crop_insurance_7d' as any, expiresAt: MoreThan(now) },
          ],
        });

        if (activeInsurance) {
          insurancePayout = Number((stealAmount * 0.8).toFixed(2));
          if (insurancePayout > 0) {
            await qr.manager.createQueryBuilder()
              .update(User)
              .set({ goldBalance: () => `"gold_balance" + ${insurancePayout}` })
              .where('id = :id', { id: dto.targetUserId })
              .execute();
          }
        }

        // Victim gold is NOT deducted here — theft is accounted for via
        // plot.totalStolen which reduces actualYield at harvest time (line 271).

        await qr.manager.insert(StealLog, {
          thiefId, victimId: dto.targetUserId, plotId: plot.id,
          amount: stealAmount, success: true, isAnonymous: true,
        });

        await qr.commitTransaction();

        // Quest progress (non-blocking)
        this.questService.onStealAttempt(thiefId, true, stealAmount).catch(() => {});

        // Notify victim (non-blocking)
        this.userRepo.findOne({
          where: { id: dto.targetUserId },
          select: ['id', 'telegramId', 'notificationsEnabled'],
        }).then((victim) => {
          if (victim?.notificationsEnabled) {
            this.notificationService
              .notifyStealVictim(
                Number(victim.telegramId),
                victim.id,
                thief.username ?? 'Someone',
                stealAmount,
                thiefId,
                insurancePayout,
              )
              .catch(() => {});
          }
        }).catch(() => {});

        return {
          success: true,
          goldChange: stealAmount,
          fenceBypass,
          masterKeyUsed,
          isRevenge,
          insurancePayout: insurancePayout > 0 ? insurancePayout : undefined,
          message: isRevenge
            ? `⚔️ REVENGE RAID! Stolen ${stealAmount.toFixed(2)} GOLD (35% Revenge Cap)!${fenceBypass ? ' (broken fence)' : ''}`
            : `Stolen ${stealAmount.toFixed(2)} GOLD!${fenceBypass ? ' (broken fence — no dog defense)' : ''}`,
        };

      } else {
        // ── Dog bite ──────────────────────────────────────────────
        const dogBiteEnergyCost = this.cfg<number>('game.dogBiteEnergyCost');
        const bitePenalty = Number(thiefLocked.goldBalance) * this.cfg<number>('game.dogBitePenaltyPercent');

        // Increment consecutive failures; if threshold hit → -trust
        const newConsecFails = (thiefLocked.consecutiveStealFailures ?? 0) + 1;
        const trustPenalty   = newConsecFails >= CONSEC_FAIL_THRESHOLD ? TRUST_BOT_PENALTY : 0;
        const resetConsec    = newConsecFails >= CONSEC_FAIL_THRESHOLD; // reset counter after penalty

        await qr.manager.createQueryBuilder()
          .update(User)
          .set({
            energy: () => `GREATEST(0, "energy" - ${dogBiteEnergyCost})`,
            goldBalance: () => `GREATEST(0, "gold_balance" - ${bitePenalty})`,
            consecutiveStealFailures: resetConsec ? 0 : newConsecFails,
            trustScore: trustPenalty > 0
              ? () => `GREATEST(${MIN_TRUST}, "trust_score" - ${trustPenalty})`
              : () => `"trust_score"`,
          })
          .where('id = :id', { id: thiefId })
          .execute();

        if (bitePenalty > 0) {
          await qr.manager.createQueryBuilder()
            .update(User)
            .set({ goldBalance: () => `"gold_balance" + ${bitePenalty}` })
            .where('id = :id', { id: dto.targetUserId })
            .execute();
        }

        await qr.manager.insert(StealLog, {
          thiefId, victimId: dto.targetUserId, plotId: plot.id,
          amount: bitePenalty, success: false,
        });

        await qr.commitTransaction();

        // Quest progress + notify dog owner (non-blocking)
        this.questService.onStealAttempt(thiefId, false, 0).catch(() => {});
        if (bitePenalty > 0) {
          this.userRepo.findOne({
            where: { id: dto.targetUserId },
            select: ['id', 'telegramId', 'notificationsEnabled'],
          }).then((owner) => {
            const tgId = owner?.notificationsEnabled && owner?.telegramId ? Number(owner.telegramId) : undefined;
            this.notificationService
              .notifyDogBiteOwner(dto.targetUserId, thief.username ?? 'Someone', bitePenalty, tgId)
              .catch(() => {});
          }).catch(() => {});
        }

        const trustMsg = trustPenalty > 0
          ? ` Your trust score dropped (${CONSEC_FAIL_THRESHOLD} consecutive failures).`
          : '';

        const failMsg = rawDefense > 0
          ? `Guard dog bit you! Lost ${bitePenalty.toFixed(2)} GOLD and ${dogBiteEnergyCost} energy.${trustMsg}`
          : `You were caught! Lost ${bitePenalty.toFixed(2)} GOLD and ${dogBiteEnergyCost} energy.${trustMsg}`;

        return {
          success: false,
          goldChange: -bitePenalty,
          message: failMsg,
        };
      }
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  DIG — remove a planted (but not yet harvested) crop
  // ─────────────────────────────────────────────────────────────
  async dig(userId: string, plotId: string) {
    const plot = await this.plotRepo.findOne({ where: { id: plotId, userId } });
    if (!plot) throw new NotFoundException('Plot not found or not yours');
    if (!plot.seedId) throw new BadRequestException('Plot is already empty');

    await this.plotRepo.update(plot.id, {
      seedId: null, plantedAt: null, harvestableAt: null,
      totalStolen: 0, lastStolenAt: null, fertilized: false,
      hasBugs: false, hasWeeds: false, lastWateredAt: null,
    });
    return { message: 'Crop removed. Plot is now empty.' };
  }

  // ─────────────────────────────────────────────────────────────
  //  WATER — hydrate dry soil to prevent -15% harvest penalty
  //  Can only water once per planting cycle. Costs 5 energy.
  //  Bonus: speeds up growth by 10% as reward for remembering.
  // ─────────────────────────────────────────────────────────────
  async water(userId: string, plotId: string) {
    const WATER_ENERGY_COST = 5;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    let isHelpingNeighbor = false;
    let isDry = false;
    let savedSec = 0;
    let plotOwnerId = '';
    let helperUsername = '';

    try {
      // Lock both rows inside the transaction so two concurrent water() calls on the
      // same plot cannot both pass the "already watered" guard and double-credit energy.
      const [plot, user] = await Promise.all([
        qr.manager
          .createQueryBuilder(FarmPlot, 'p')
          .where('p.id = :id', { id: plotId })
          .setLock('pessimistic_write')
          .getOne(),
        qr.manager
          .createQueryBuilder(User, 'u')
          .where('u.id = :id', { id: userId })
          .setLock('pessimistic_write')
          .getOne(),
      ]);

      if (!plot)  throw new NotFoundException('Plot not found');
      if (!user)  throw new NotFoundException('User not found');
      if (!plot.seedId || !plot.harvestableAt || !plot.plantedAt)
        throw new BadRequestException('Plot has no growing crop');

      // seed_configs is immutable static data — load outside the FOR UPDATE lock to avoid
      // "FOR UPDATE cannot be applied to the nullable side of an outer join" (PostgreSQL)
      const seedConfig = await this.seedRepo.findOneBy({ id: plot.seedId });

      isHelpingNeighbor = plot.userId !== userId;
      plotOwnerId = plot.userId;
      helperUsername = user.username ?? 'Someone';

      const now = Date.now();
      if (now >= plot.harvestableAt.getTime())
        throw new BadRequestException('Crop is already ripe — harvest it instead!');

      if (plot.lastWateredAt && plot.lastWateredAt >= plot.plantedAt)
        throw new BadRequestException(isHelpingNeighbor ? 'Neighbor\'s crop was already watered! Soil is moist. 💧' : 'Already watered this crop! Soil is moist. 💧');

      if (user.energy < WATER_ENERGY_COST)
        throw new BadRequestException(`Need ${WATER_ENERGY_COST} ⚡ to water. Have ${user.energy}`);

      const growTimeSec = seedConfig?.growTimeSec ?? 0;
      const dryThreshold = plot.plantedAt.getTime() + growTimeSec * 500;
      isDry = now >= dryThreshold;

      const remaining = plot.harvestableAt.getTime() - now;
      savedSec = Math.round(remaining * 0.10 / 1000);
      const newHarvestableAt = new Date(now + remaining * 0.90);

      await qr.manager.update(FarmPlot, plot.id, {
        lastWateredAt: new Date(),
        harvestableAt: newHarvestableAt,
      });
      await qr.manager.decrement(User, { id: userId }, 'energy', WATER_ENERGY_COST);

      if (isHelpingNeighbor) {
        const REWARD_GOLD = 10;
        await qr.manager.increment(User, { id: userId }, 'goldBalance', REWARD_GOLD);
        await qr.manager.update(User, { id: userId }, { trustScore: () => `LEAST(200, "trust_score" + 1)` });
        await qr.query(
          `INSERT INTO gold_transactions (user_id, amount, type, category, description) VALUES ($1, $2, 'MINT', 'HELP_REWARD', $3)`,
          [userId, REWARD_GOLD, `Helped neighbor by watering crop on plot #${plot.plotIndex + 1}`],
        ).catch(() => {});
      }

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    if (isHelpingNeighbor) {
      void this.notificationService.notifyHelpNeighbor(plotOwnerId, helperUsername, 'water').catch(() => {});
    }

    // Quest + lifetime stat tracking (non-blocking)
    void this.questService.onWater(userId).catch(() => {});
    void this.userRepo.increment({ id: userId }, 'totalWaters', 1).catch(() => {});

    const msg = isHelpingNeighbor
      ? `🤝 You helped water your neighbor's crop! Rewarded +10 Gold & +1 Trust Score!`
      : isDry
      ? `💧 Watered! Dry soil fixed — harvest penalty removed. +10% speed (~${savedSec}s saved).`
      : `💧 Watered early! Soil is moist. +10% speed (~${savedSec}s saved).`;
    return { message: msg, savedSec, wasDry: isDry, isHelp: isHelpingNeighbor, rewardGold: isHelpingNeighbor ? 10 : 0 };
  }

  // ─────────────────────────────────────────────────────────────
  //  FERTILIZE — reduce grow time by tier amount, costs 1 charge
  //  Auto-selects cheapest available tier: normal → super → advanced
  // ─────────────────────────────────────────────────────────────
  async fertilize(userId: string, plotId: string, tierChoice: 'auto' | 'normal' | 'super' | 'advanced' = 'auto') {
    const [plot, user] = await Promise.all([
      this.plotRepo.findOne({ where: { id: plotId, userId } }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    if (!plot) throw new NotFoundException('Plot not found or not yours');
    if (!user) throw new NotFoundException('User not found');
    if (!plot.seedId || !plot.harvestableAt) throw new BadRequestException('No crop planted — plant a seed first');

    const now = Date.now();
    if (now >= plot.harvestableAt.getTime()) {
      throw new BadRequestException('Crop is already ripe — harvest it instead!');
    }

    const TIERS = [
      { key: 'normal',   field: 'normalFertCharges' as const,   reductionSec: 3600,  label: 'Normal',   timeLabel: '1h' },
      { key: 'super',    field: 'superFertCharges'  as const,   reductionSec: 9000,  label: 'Super',    timeLabel: '2.5h' },
      { key: 'advanced', field: 'advancedFertCharges' as const, reductionSec: 18000, label: 'Advanced', timeLabel: '5h' },
    ];

    let tier: typeof TIERS[number] | undefined;
    if (tierChoice === 'auto') {
      tier = TIERS.find((t) => (user[t.field] ?? 0) > 0);
    } else {
      tier = TIERS.find((t) => t.key === tierChoice);
      if (tier && (user[tier.field] ?? 0) === 0) {
        throw new BadRequestException(`No ${tier.label} fertilizer charges remaining`);
      }
    }
    if (!tier) {
      throw new BadRequestException('No fertilizer charges. Buy some from the Shop!');
    }

    // Reduce harvestable_at (floor at now so it doesn't go negative)
    const remaining = plot.harvestableAt.getTime() - now;
    const reductionMs = tier.reductionSec * 1000;
    const newHarvestableAt = new Date(Math.max(now, plot.harvestableAt.getTime() - reductionMs));
    const actualSavedSec = Math.round(Math.min(remaining, reductionMs) / 1000);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    let chargesLeft = 0;
    try {
      const lockedUser = await qr.manager
        .createQueryBuilder(User, 'u')
        .where('u.id = :id', { id: userId })
        .setLock('pessimistic_write')
        .getOne();

      if (!lockedUser || (lockedUser[tier.field] ?? 0) <= 0) {
        throw new BadRequestException(`No ${tier.label} fertilizer charges remaining`);
      }

      await qr.manager.update(FarmPlot, { id: plot.id }, { fertilized: true, harvestableAt: newHarvestableAt });
      await qr.manager.decrement(User, { id: userId }, tier.field, 1);
      await qr.commitTransaction();
      chargesLeft = Math.max(0, (lockedUser[tier.field] ?? 0) - 1);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    return {
      message: `🌿 ${tier.label} Fertilizer! Grow time reduced by ${tier.timeLabel} (saved ~${Math.round(actualSavedSec / 60)}m). (${chargesLeft} ${tier.label.toLowerCase()} charges left)`,
      chargesLeft,
      fertTier: tier.label.toLowerCase(),
      savedSec: actualSavedSec,
      newHarvestableAt,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  THROW ATTACK — throw weeds or bugs at a neighbor's plot
  //  Costs 15 energy, free gold. Reduces their harvest yield.
  // ─────────────────────────────────────────────────────────────
  async throwAttack(userId: string, dto: { targetUserId: string; plotId: string; type: 'bugs' | 'weeds' }) {
    const ENERGY_COST = 15;

    if (userId === dto.targetUserId) {
      throw new BadRequestException('Cannot attack your own farm');
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [attacker, plot] = await Promise.all([
        qr.manager.createQueryBuilder(User, 'u')
          .where('u.id = :id', { id: userId })
          .setLock('pessimistic_write')
          .getOne(),
        qr.manager.createQueryBuilder(FarmPlot, 'p')
          .where('p.id = :id AND p.user_id = :targetId', { id: dto.plotId, targetId: dto.targetUserId })
          .setLock('pessimistic_write')
          .getOne(),
      ]);

      if (!attacker) throw new NotFoundException('User not found');
      if (attacker.energy < ENERGY_COST) {
        throw new BadRequestException(`Need ${ENERGY_COST} energy. Have ${attacker.energy}.`);
      }
      if (!plot) throw new NotFoundException('Plot not found');
      if (!plot.seedId) throw new BadRequestException('Target plot has no crop to infest');

      if (dto.type === 'bugs'  && plot.hasBugs)  throw new BadRequestException('Plot already has bugs');
      if (dto.type === 'weeds' && plot.hasWeeds) throw new BadRequestException('Plot already has weeds');

      // Deduct energy
      await qr.manager.decrement(User, { id: userId }, 'energy', ENERGY_COST);

      // Infest
      const update: Partial<FarmPlot> = dto.type === 'bugs'
        ? { hasBugs: true }
        : { hasWeeds: true };
      await qr.manager.update(FarmPlot, { id: plot.id }, update);

      await qr.commitTransaction();

      // Notify victim (non-blocking)
      void this.notificationService
        .notifyAttackVictim(dto.targetUserId, attacker.username ?? 'Someone', dto.type)
        .catch(() => {});

      // Quest + lifetime stat tracking (non-blocking)
      void this.questService.onAttack(userId).catch(() => {});
      void this.userRepo.increment({ id: userId }, 'totalAttacks', 1).catch(() => {});

      const label = dto.type === 'bugs' ? '🐛 bugs' : '🌿 weeds';
      return {
        message: `Threw ${label} into their plot! Their harvest will be reduced.`,
        type: dto.type,
        energyLeft: attacker.energy - ENERGY_COST,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  WEED KILL — remove weeds from own or neighbor plot
  //  Costs 5 energy. If neighbor's plot: rewards +15G & +1 Trust
  // ─────────────────────────────────────────────────────────────
  async weedKill(userId: string, plotId: string) {
    const ENERGY_COST = 5;

    const [plot, user] = await Promise.all([
      this.plotRepo.findOne({ where: { id: plotId } }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    if (!plot) throw new NotFoundException('Plot not found');
    if (!user) throw new NotFoundException('User not found');
    if (!plot.hasWeeds) throw new BadRequestException('Plot has no weeds to remove');
    if (user.energy < ENERGY_COST) {
      throw new BadRequestException(`Need ${ENERGY_COST} energy to use Weed Killer. Have ${user.energy}.`);
    }

    const isHelpingNeighbor = plot.userId !== userId;

    if (isHelpingNeighbor) {
      const REWARD_GOLD = 15;
      await Promise.all([
        this.plotRepo.update(plot.id, { hasWeeds: false }),
        this.userRepo.decrement({ id: userId }, 'energy', ENERGY_COST),
        this.userRepo.increment({ id: userId }, 'goldBalance', REWARD_GOLD),
        this.userRepo.update(userId, { trustScore: () => `LEAST(200, "trust_score" + 1)` }),
      ]);

      await this.userRepo.query(
        `INSERT INTO gold_transactions (user_id, amount, type, category, description) VALUES ($1, $2, 'MINT', 'HELP_REWARD', $3)`,
        [userId, REWARD_GOLD, `Helped neighbor by removing weeds from plot #${plot.plotIndex + 1}`],
      ).catch(() => {});

      void this.notificationService.notifyHelpNeighbor(plot.userId, user.username ?? 'Someone', 'weeds').catch(() => {});

      return {
        message: `🤝 You helped your neighbor! Rewarded +${REWARD_GOLD} Gold & +1 Trust Score!`,
        energyLeft: user.energy - ENERGY_COST,
        rewardGold: REWARD_GOLD,
        isHelp: true,
      };
    }

    await Promise.all([
      this.plotRepo.update(plot.id, { hasWeeds: false }),
      this.userRepo.decrement({ id: userId }, 'energy', ENERGY_COST),
    ]);

    return { message: '🌿 Weeds removed!', energyLeft: user.energy - ENERGY_COST, isHelp: false };
  }

  // ─────────────────────────────────────────────────────────────
  //  BUG SPRAY (override existing fertilize-named method alias)
  //  Clear bugs from own or neighbor plot — costs 5 energy
  //  If neighbor's plot: rewards +15G & +1 Trust
  // ─────────────────────────────────────────────────────────────
  async bugSpray(userId: string, plotId: string) {
    const ENERGY_COST = 5;

    const [plot, user] = await Promise.all([
      this.plotRepo.findOne({ where: { id: plotId } }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    if (!plot) throw new NotFoundException('Plot not found');
    if (!user) throw new NotFoundException('User not found');
    if (!plot.hasBugs) throw new BadRequestException('Plot has no bugs to spray');
    if (user.energy < ENERGY_COST) {
      throw new BadRequestException(`Need ${ENERGY_COST} energy to spray. Have ${user.energy}.`);
    }

    const isHelpingNeighbor = plot.userId !== userId;

    if (isHelpingNeighbor) {
      const REWARD_GOLD = 15;
      await Promise.all([
        this.plotRepo.update(plot.id, { hasBugs: false }),
        this.userRepo.decrement({ id: userId }, 'energy', ENERGY_COST),
        this.userRepo.increment({ id: userId }, 'goldBalance', REWARD_GOLD),
        this.userRepo.update(userId, { trustScore: () => `LEAST(200, "trust_score" + 1)` }),
      ]);

      await this.userRepo.query(
        `INSERT INTO gold_transactions (user_id, amount, type, category, description) VALUES ($1, $2, 'MINT', 'HELP_REWARD', $3)`,
        [userId, REWARD_GOLD, `Helped neighbor by spraying bugs on plot #${plot.plotIndex + 1}`],
      ).catch(() => {});

      void this.notificationService.notifyHelpNeighbor(plot.userId, user.username ?? 'Someone', 'bugs').catch(() => {});

      return {
        message: `🤝 You helped your neighbor! Rewarded +${REWARD_GOLD} Gold & +1 Trust Score!`,
        energyLeft: user.energy - ENERGY_COST,
        rewardGold: REWARD_GOLD,
        isHelp: true,
      };
    }

    await Promise.all([
      this.plotRepo.update(plot.id, { hasBugs: false }),
      this.userRepo.decrement({ id: userId }, 'energy', ENERGY_COST),
    ]);

    return { message: '🐛 Bugs cleared!', energyLeft: user.energy - ENERGY_COST, isHelp: false };
  }

  async getActivityFeed(userId: string, limit = 30) {
    const rows = await this.stealLogRepo
      .createQueryBuilder('sl')
      .innerJoin('users', 'thief',  'thief.id  = sl.thief_id')
      .innerJoin('users', 'victim', 'victim.id = sl.victim_id')
      .select([
        'sl.id           AS id',
        'sl.thief_id     AS "thiefId"',
        'sl.victim_id    AS "victimId"',
        'sl.success      AS success',
        'sl.is_anonymous AS "isAnonymous"',
        'CAST(sl.amount AS FLOAT) AS amount',
        'sl.created_at   AS "createdAt"',
        'thief.username  AS "thiefUsername"',
        'victim.username AS "victimUsername"',
      ])
      .where('sl.thief_id = :uid OR sl.victim_id = :uid', { uid: userId })
      .orderBy('sl.created_at', 'DESC')
      .limit(limit)
      .getRawMany<{
        id: string; thiefId: string; victimId: string;
        success: boolean; isAnonymous: boolean; amount: number; createdAt: Date;
        thiefUsername: string | null; victimUsername: string | null;
      }>();

    return rows.map((r) => {
      const isAttacker = r.thiefId === userId;
      // Never expose thief identity to victim if still anonymous
      const otherUsername = isAttacker
        ? (r.victimUsername ?? 'Unknown')
        : (!r.isAnonymous ? (r.thiefUsername ?? 'Unknown') : '???');
      return {
        id: r.id,
        role: isAttacker ? ('attacker' as const) : ('defender' as const),
        success: r.success,
        isAnonymous: r.isAnonymous && !isAttacker,
        amount: r.amount,
        createdAt: r.createdAt,
        otherUsername,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  REVEAL THIEF (#38) — consume 1 Magnifying Glass to unmask
  // ─────────────────────────────────────────────────────────────
  async revealThief(userId: string, dto: RevealThiefDto) {
    const log = await this.stealLogRepo.findOne({
      where: { id: dto.stealLogId, victimId: userId, isAnonymous: true, success: true },
      relations: ['thief'],
    });
    if (!log) throw new NotFoundException('Steal log not found or already revealed');

    // Consume 1 Magnifying Glass
    const glass = await this.itemRepo.findOne({
      where: { userId, itemType: 'magnifying_glass' },
    });
    if (!glass || glass.quantity < 1) {
      throw new BadRequestException('🔍 No Magnifying Glass in inventory. Invite a friend to earn one!');
    }

    await Promise.all([
      this.itemRepo.decrement({ userId, itemType: 'magnifying_glass' }, 'quantity', 1),
      this.stealLogRepo.update(log.id, { isAnonymous: false }),
    ]);

    return {
      thiefId: log.thiefId,
      thiefUsername: log.thief?.username ?? 'Unknown',
      stolenAmount: Number(log.amount),
      stolenAt: log.createdAt,
      glassesLeft: glass.quantity - 1,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  GET BUILDING STATUS (#36)
  // ─────────────────────────────────────────────────────────────
  async getBuildingStatus(userId: string) {
    let building = await this.buildingRepo.findOne({ where: { userId } });
    if (!building) {
      building = this.buildingRepo.create({ userId, fenceDurability: 100, barnDurability: 100 });
      await this.buildingRepo.save(building);
    }
    const currentDurability = building.getCurrentDurability();
    return {
      fenceDurability: currentDurability,
      barnDurability: building.barnDurability,
      lastRepairedAt: building.lastRepairedAt,
      repairCostPer10Pct: REPAIR_COST_PER_10PCT,
      alertNeeded: currentDurability < 30,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  REPAIR BUILDING (#36) — restore fence/barn durability
  //  Cost: 50 GOLD per 10% restored
  // ─────────────────────────────────────────────────────────────
  async repairBuilding(userId: string, target: 'fence' | 'barn', amount: number) {
    if (amount <= 0 || amount > 100 || amount % 10 !== 0) {
      throw new BadRequestException('Repair amount must be a multiple of 10 between 10 and 100');
    }

    const [building, user] = await Promise.all([
      this.buildingRepo.findOne({ where: { userId } }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');

    const totalCost = (amount / 10) * REPAIR_COST_PER_10PCT;
    if (Number(user.goldBalance) < totalCost) {
      throw new BadRequestException(`Need ${totalCost} GOLD to repair ${amount}% durability. Have ${user.goldBalance}.`);
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const b = building ?? this.buildingRepo.create({ userId });
      const currentFence = b ? b.getCurrentDurability() : 100;
      const newFence = Math.min(100, (target === 'fence' ? currentFence : b?.barnDurability ?? 100) + amount);

      await qr.manager.save(FarmBuilding, {
        ...b,
        userId,
        fenceDurability: target === 'fence' ? newFence : (b?.fenceDurability ?? 100),
        barnDurability:  target === 'barn'  ? newFence : (b?.barnDurability ?? 100),
        lastRepairedAt: new Date(),
      });
      await qr.manager.decrement(User, { id: userId }, 'goldBalance', totalCost);
      await qr.commitTransaction();

      return {
        message: `🔧 Repaired ${amount}% ${target} durability for ${totalCost} GOLD`,
        newDurability: newFence,
        goldSpent: totalCost,
        goldBalance: Number(user.goldBalance) - totalCost,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
