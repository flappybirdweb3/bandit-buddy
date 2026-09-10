import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';
import { StealLog } from '../farm/entities/steal-log.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';
import { FarmBuilding } from '../farm/entities/farm-building.entity';
import { User } from '../user/entities/user.entity';
import { UserItem } from '../user/entities/user-item.entity';
import { PlantDto, HarvestDto, StealDto, RevealThiefDto } from './dto/action.dto';
import { NotificationService } from '../notification/notification.service';
import { QuestService } from '../quest/quest.service';
import { UPGRADE_MULTIPLIERS } from '../farm/farm.service';

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
      await qr.commitTransaction();

      // Quest progress (non-blocking)
      this.questService.onPlant(userId).catch(() => {});

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

    const costPer   = Number(seed.costGold);
    const maxAfford = Math.floor(Number(user.goldBalance) / costPer);
    const toPlant   = emptyPlots.slice(0, Math.max(0, maxAfford));

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
      await qr.manager.createQueryBuilder()
        .update(User)
        .set({ totalPlants: () => `"total_plants" + ${toPlant.length}` })
        .where('id = :id', { id: userId })
        .execute();
      await qr.commitTransaction();

      this.questService.onPlant(userId).catch(() => {});

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

      const userForTrust = await qr.manager.findOne(User, { where: { id: userId }, select: ['trustScore'] });
      const prevTrust = userForTrust?.trustScore ?? 0;

      const now = Date.now();
      if (now < plot.harvestableAt.getTime()) {
        const remainSec = Math.ceil((plot.harvestableAt.getTime() - now) / 1000);
        throw new BadRequestException(`Crop not ready. ${remainSec}s remaining`);
      }

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

      if (actualYield > 0) {
        await qr.manager.increment(User, { id: userId }, 'goldBalance', actualYield);
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

      // Quest progress (non-blocking)
      this.questService.onHarvest(userId, actualYield).catch(() => {});

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

      const soilMsg = soilFertility < 100 ? ` 🌱 Soil ${soilFertility}%→${newSoilFertility}%` : '';
      return {
        message: `Harvested ${actualYield.toFixed(2)} GOLD${weatherMsg}${infestMsg}${dryMsg}${soilMsg}`,
        goldEarned: actualYield,
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

    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['trustScore'] });
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
      let totalGold = 0;

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
        const dryMult = wateredThisCycle ? 1.0 : 0.85;
        const actualYield = Math.max(0, baseYield * levelMult * plotWeatherMult * infestMult * dryMult - Number(plot.totalStolen));
        totalGold += actualYield;

        await qr.manager.createQueryBuilder()
          .update(FarmPlot)
          .set({ seedId: null, plantedAt: null, harvestableAt: null, totalStolen: 0, lastStolenAt: null, fertilized: false, hasBugs: false, hasWeeds: false, lastWateredAt: null })
          .where('id = :id', { id: plot.id })
          .execute();
      }

      if (totalGold > 0) {
        await qr.manager.increment(User, { id: userId }, 'goldBalance', totalGold);
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
      this.questService.onHarvest(userId, totalGold).catch(() => {});

      const newTrustAll  = Math.min(MAX_TRUST, prevTrustAll + TRUST_PER_HARVEST * ripePlots.length);
      const prevLevelAll = Math.floor(prevTrustAll / 10);
      const newLevelAll  = Math.floor(newTrustAll / 10);
      const levelUpAll   = newLevelAll > prevLevelAll;

      const weatherSuffix =
        weather.effect === 'harvest_gold_bonus' ? ` ☀️ +${Math.round(weather.value * 100)}% weather!` :
        weather.effect === 'gold_multiplier'    ? ` ✨ Golden Hour ×${weather.value}!` :
        weather.effect === 'festival'           ? ` 🎉 Festival +${Math.round(weather.value * 100)}%!` :
        weather.effect === 'pest_damage'        ? ` 🐛 Pests hit unsprayed crops!` : '';

      return {
        harvested: ripePlots.length,
        totalGold: parseFloat(totalGold.toFixed(2)),
        message: `Harvested ${ripePlots.length} crops for ${totalGold.toFixed(2)} GOLD!${weatherSuffix}`,
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
  async steal(thiefId: string, dto: StealDto): Promise<{ success: boolean; goldChange: number; message: string; fenceBypass?: boolean; masterKeyUsed?: boolean }> {
    if (thiefId === dto.targetUserId) {
      throw new BadRequestException('You cannot steal from yourself');
    }

    const stealEnergyCost = this.cfg<number>('game.stealEnergyCost');
    const today = todayUTC();

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

    // 24-hour farm protection — check if ANY of victim's plots was stolen recently
    const protectedSince = new Date(Date.now() - FARM_RAID_COOLDOWN_MS);
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

    // ── Critical transaction ──────────────────────────────────────
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('SERIALIZABLE');
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

      // Re-check 24h protection inside transaction (SERIALIZABLE catches concurrent race)
      const recentRaidTx = await qr.manager
        .createQueryBuilder(FarmPlot, 'p')
        .where('p.user_id = :uid', { uid: dto.targetUserId })
        .andWhere('p.last_stolen_at > :since', { since: protectedSince })
        .getOne();

      if (recentRaidTx) {
        throw new BadRequestException('🛡️ Farm is protected — another raider just hit it.');
      }

      const baseYield       = Number(plot.seed.baseYield);
      const levelMultiplier = UPGRADE_MULTIPLIERS[(plot.level ?? 1) - 1] ?? 1.0;
      const effectiveYield  = baseYield * levelMultiplier;
      const maxStealable    = effectiveYield * this.cfg<number>('game.maxStealPercent');
      const currentStolen   = Number(plot.totalStolen);
      const remaining       = maxStealable - currentStolen;

      if (remaining <= 0) {
        throw new BadRequestException('This crop has already been stolen to its 20% limit');
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

      // Guard dog defense
      const dogs = await qr.manager.find(NftGuardDog, {
        where: { ownerId: dto.targetUserId, isActive: true },
      });
      const rawDefense      = dogs.reduce((sum, d) => sum + d.defensePower, 0);
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
        const stealAmount = Math.min(
          effectiveYield * this.cfg<number>('game.stealPerActionPercent'),
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

        // Victim: -gold
        await qr.manager.createQueryBuilder()
          .update(User)
          .set({ goldBalance: () => `GREATEST(0, "gold_balance" - ${stealAmount})` })
          .where('id = :id', { id: dto.targetUserId })
          .execute();

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
              .notifyStealVictim(Number(victim.telegramId), victim.id, thief.username ?? 'Someone', stealAmount, thiefId)
              .catch(() => {});
          }
        }).catch(() => {});

        return {
          success: true,
          goldChange: stealAmount,
          fenceBypass,
          masterKeyUsed,
          message: `Stolen ${stealAmount.toFixed(2)} GOLD!${fenceBypass ? ' (broken fence — no dog defense)' : ''}`,
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
          this.notificationService
            .notifyDogBiteOwner(dto.targetUserId, thief.username ?? 'Someone', bitePenalty)
            .catch(() => {});
        }

        const trustMsg = trustPenalty > 0
          ? ` Your trust score dropped (${CONSEC_FAIL_THRESHOLD} consecutive failures).`
          : '';

        return {
          success: false,
          goldChange: -bitePenalty,
          message: `Guard dog bit you! Lost ${bitePenalty.toFixed(2)} GOLD and ${dogBiteEnergyCost} energy.${trustMsg}`,
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

    const [plot, user] = await Promise.all([
      this.plotRepo.findOne({ where: { id: plotId, userId }, relations: ['seed'] }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    if (!plot)  throw new NotFoundException('Plot not found or not yours');
    if (!user)  throw new NotFoundException('User not found');
    if (!plot.seedId || !plot.harvestableAt || !plot.plantedAt)
      throw new BadRequestException('Plot has no growing crop');

    const now = Date.now();
    if (now >= plot.harvestableAt.getTime())
      throw new BadRequestException('Crop is already ripe — harvest it instead!');

    // Already watered this planting cycle
    if (plot.lastWateredAt && plot.lastWateredAt >= plot.plantedAt)
      throw new BadRequestException('Already watered this crop! Soil is moist. 💧');

    if (user.energy < WATER_ENERGY_COST)
      throw new BadRequestException(`Need ${WATER_ENERGY_COST} ⚡ to water. Have ${user.energy}`);

    // Check if soil is already dry (past 50% grow time without watering)
    const growTimeSec = plot.seed?.growTimeSec ?? 0;
    const dryThreshold = plot.plantedAt.getTime() + growTimeSec * 500;
    const isDry = now >= dryThreshold;

    // 10% speed bonus for watering
    const remaining = plot.harvestableAt.getTime() - now;
    const newHarvestableAt = new Date(now + remaining * 0.90);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.manager.update(FarmPlot, plot.id, {
        lastWateredAt: new Date(),
        harvestableAt: newHarvestableAt,
      });
      await qr.manager.decrement(User, { id: userId }, 'energy', WATER_ENERGY_COST);
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    // Quest + lifetime stat tracking (non-blocking)
    void this.questService.onWater(userId).catch(() => {});
    void this.userRepo.increment({ id: userId }, 'totalWaters', 1).catch(() => {});

    const savedSec = Math.round(remaining * 0.10 / 1000);
    const msg = isDry
      ? `💧 Watered! Dry soil fixed — harvest penalty removed. +10% speed (~${savedSec}s saved).`
      : `💧 Watered early! Soil is moist. +10% speed (~${savedSec}s saved).`;
    return { message: msg, savedSec, wasDry: isDry };
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
      { key: 'normal',   field: 'normalFertCharges' as const,   col: 'normal_fert_charges',   reductionSec: 3600,  label: 'Normal',   timeLabel: '1h' },
      { key: 'super',    field: 'superFertCharges'  as const,   col: 'super_fert_charges',    reductionSec: 9000,  label: 'Super',    timeLabel: '2.5h' },
      { key: 'advanced', field: 'advancedFertCharges' as const, col: 'advanced_fert_charges', reductionSec: 18000, label: 'Advanced', timeLabel: '5h' },
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
    try {
      await qr.manager.update(FarmPlot, plot.id, { fertilized: true, harvestableAt: newHarvestableAt });
      await qr.manager.decrement(User, { id: userId }, tier.col, 1);
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    const chargesLeft = (user[tier.field] ?? 0) - 1;
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
  //  WEED KILL — remove weeds from own plot
  //  Costs 5 energy
  // ─────────────────────────────────────────────────────────────
  async weedKill(userId: string, plotId: string) {
    const ENERGY_COST = 5;

    const [plot, user] = await Promise.all([
      this.plotRepo.findOne({ where: { id: plotId, userId } }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    if (!plot) throw new NotFoundException('Plot not found or not yours');
    if (!user) throw new NotFoundException('User not found');
    if (!plot.hasWeeds) throw new BadRequestException('Plot has no weeds to remove');
    if (user.energy < ENERGY_COST) {
      throw new BadRequestException(`Need ${ENERGY_COST} energy to use Weed Killer. Have ${user.energy}.`);
    }

    await Promise.all([
      this.plotRepo.update(plot.id, { hasWeeds: false }),
      this.userRepo.decrement({ id: userId }, 'energy', ENERGY_COST),
    ]);

    return { message: '🌿 Weeds removed!', energyLeft: user.energy - ENERGY_COST };
  }

  // ─────────────────────────────────────────────────────────────
  //  BUG SPRAY (override existing fertilize-named method alias)
  //  Clear bugs from own plot — costs 5 energy
  //  Note: the "spray" tool in BottomBar calls /action/bug-spray
  // ─────────────────────────────────────────────────────────────
  async bugSpray(userId: string, plotId: string) {
    const ENERGY_COST = 5;

    const [plot, user] = await Promise.all([
      this.plotRepo.findOne({ where: { id: plotId, userId } }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    if (!plot) throw new NotFoundException('Plot not found or not yours');
    if (!user) throw new NotFoundException('User not found');
    if (!plot.hasBugs) throw new BadRequestException('Plot has no bugs to spray');
    if (user.energy < ENERGY_COST) {
      throw new BadRequestException(`Need ${ENERGY_COST} energy to spray. Have ${user.energy}.`);
    }

    await Promise.all([
      this.plotRepo.update(plot.id, { hasBugs: false }),
      this.userRepo.decrement({ id: userId }, 'energy', ENERGY_COST),
    ]);

    return { message: '🐛 Bugs cleared!', energyLeft: user.energy - ENERGY_COST };
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
