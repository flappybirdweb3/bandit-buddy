import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';
import { StealLog } from '../farm/entities/steal-log.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';
import { User } from '../user/entities/user.entity';
import { PlantDto, HarvestDto, StealDto } from './dto/action.dto';

@Injectable()
export class ActionService {
  constructor(
    @InjectRepository(FarmPlot)
    private readonly plotRepo: Repository<FarmPlot>,
    @InjectRepository(SeedConfig)
    private readonly seedRepo: Repository<SeedConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(NftGuardDog)
    private readonly dogRepo: Repository<NftGuardDog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  private cfg<T>(key: string): T {
    return this.config.get<T>(key) as T;
  }

  async plant(userId: string, dto: PlantDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const plot = await queryRunner.manager.findOne(FarmPlot, { where: { id: dto.plotId, userId } });
      const seed = await queryRunner.manager.findOne(SeedConfig, { where: { id: dto.seedId } });
      const user = await queryRunner.manager.findOne(User, { where: { id: userId } });

      if (!plot) throw new NotFoundException('Plot not found or not yours');
      if (!seed) throw new NotFoundException('Seed not found');
      if (!user) throw new NotFoundException('User not found');
      if (plot.seedId) throw new BadRequestException('Plot already has a crop planted');
      if (Number(user.goldBalance) < Number(seed.costGold)) {
        throw new BadRequestException(`Insufficient GOLD. Need ${seed.costGold}, have ${user.goldBalance}`);
      }

      const now = new Date();
      const harvestableAt = new Date(now.getTime() + seed.growTimeSec * 1000);

      await queryRunner.manager.update(FarmPlot, plot.id, {
        seedId: seed.id,
        plantedAt: now,
        harvestableAt,
        totalStolen: 0,
      });

      await queryRunner.manager.decrement(User, { id: userId }, 'goldBalance', Number(seed.costGold));
      await queryRunner.commitTransaction();

      return {
        message: `${seed.name} planted successfully`,
        harvestableAt,
        costGold: Number(seed.costGold),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async harvest(userId: string, dto: HarvestDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const plot = await queryRunner.manager
        .createQueryBuilder(FarmPlot, 'plot')
        .innerJoinAndSelect('plot.seed', 'seed')
        .where('plot.id = :id AND plot.user_id = :userId', { id: dto.plotId, userId })
        .setLock('pessimistic_write')
        .getOne();

      if (!plot) throw new NotFoundException('Plot not found or not yours');
      if (!plot.seedId || !plot.seed) throw new BadRequestException('Plot has no crop');
      if (!plot.harvestableAt) throw new BadRequestException('Plot has no harvest time');

      const now = Date.now();
      if (now < plot.harvestableAt.getTime()) {
        const remainingSec = Math.ceil((plot.harvestableAt.getTime() - now) / 1000);
        throw new BadRequestException(`Crop not ready. ${remainingSec}s remaining`);
      }

      const baseYield = Number(plot.seed.baseYield);
      const totalStolen = Number(plot.totalStolen);
      const actualYield = Math.max(0, baseYield - totalStolen);

      // Clear the plot
      await queryRunner.manager
        .createQueryBuilder()
        .update(FarmPlot)
        .set({ seedId: null, plantedAt: null, harvestableAt: null, totalStolen: 0, lastStolenAt: null })
        .where('id = :id', { id: plot.id })
        .execute();

      if (actualYield > 0) {
        await queryRunner.manager.increment(User, { id: userId }, 'goldBalance', actualYield);
      }

      await queryRunner.commitTransaction();

      return {
        message: `Harvested ${actualYield.toFixed(2)} GOLD`,
        goldEarned: actualYield,
        goldLostToThieves: totalStolen,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async steal(thiefId: string, dto: StealDto): Promise<{ success: boolean; goldChange: number; message: string }> {
    if (thiefId === dto.targetUserId) {
      throw new BadRequestException('You cannot steal from yourself');
    }

    // Fast pre-check before acquiring locks
    const stealEnergyCost = this.cfg<number>('game.stealEnergyCost');
    const thief = await this.userRepo.findOne({ where: { id: thiefId } });
    if (!thief) throw new NotFoundException('User not found');
    if (thief.energy < stealEnergyCost) {
      throw new BadRequestException(`Insufficient energy. Need ${stealEnergyCost}, have ${thief.energy}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      // ============================================================
      // CRITICAL: SELECT ... FOR UPDATE prevents race conditions
      // All concurrent steal attempts on this plot are serialized
      // ============================================================
      const plot = await queryRunner.manager
        .createQueryBuilder(FarmPlot, 'plot')
        .innerJoinAndSelect('plot.seed', 'seed')
        .where('plot.id = :plotId AND plot.user_id = :victimId', {
          plotId: dto.plotId,
          victimId: dto.targetUserId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!plot) throw new NotFoundException('Target plot not found');
      if (!plot.seedId || !plot.seed) throw new BadRequestException('Target plot has no crop');
      if (!plot.harvestableAt) throw new BadRequestException('Crop has no harvest time');

      const now = Date.now();
      if (now < plot.harvestableAt.getTime()) {
        throw new BadRequestException('Crop is not ripe yet');
      }

      const baseYield = Number(plot.seed.baseYield);
      const maxStealable = baseYield * this.cfg<number>('game.maxStealPercent');
      const currentStolen = Number(plot.totalStolen);
      const remaining = maxStealable - currentStolen;

      if (remaining <= 0) {
        throw new BadRequestException('This crop has already been stolen to its 20% limit');
      }

      // Re-read thief inside transaction to get current energy/gold
      const thiefLocked = await queryRunner.manager
        .createQueryBuilder(User, 'u')
        .where('u.id = :id', { id: thiefId })
        .setLock('pessimistic_write')
        .getOne();

      if (!thiefLocked) throw new NotFoundException('Thief not found');
      if (thiefLocked.energy < stealEnergyCost) {
        throw new BadRequestException('Insufficient energy (race condition)');
      }

      // Get victim's total active dog defense power
      const dogs = await queryRunner.manager.find(NftGuardDog, {
        where: { ownerId: dto.targetUserId, isActive: true },
      });
      const totalDefensePower = dogs.reduce((sum, d) => sum + d.defensePower, 0);

      // RNG: success_rate = 80 - totalDefensePower, clamped [0, 80]
      const baseRate = this.cfg<number>('game.baseStealSuccessRate');
      const successRate = Math.max(0, Math.min(baseRate, baseRate - totalDefensePower));
      const roll = Math.random() * 100;
      const isSuccess = roll <= successRate;

      if (isSuccess) {
        const stealAmount = Math.min(
          baseYield * this.cfg<number>('game.stealPerActionPercent'),
          remaining,
        );

        await queryRunner.manager
          .createQueryBuilder()
          .update(FarmPlot)
          .set({ totalStolen: () => `"total_stolen" + ${stealAmount}`, lastStolenAt: new Date() })
          .where('id = :id', { id: plot.id })
          .execute();

        await queryRunner.manager
          .createQueryBuilder()
          .update(User)
          .set({
            goldBalance: () => `"gold_balance" + ${stealAmount}`,
            energy: () => `"energy" - ${stealEnergyCost}`,
          })
          .where('id = :id', { id: thiefId })
          .execute();

        await queryRunner.manager
          .createQueryBuilder()
          .update(User)
          .set({ goldBalance: () => `GREATEST(0, "gold_balance" - ${stealAmount})` })
          .where('id = :id', { id: dto.targetUserId })
          .execute();

        await queryRunner.manager.insert(StealLog, {
          thiefId,
          victimId: dto.targetUserId,
          plotId: plot.id,
          amount: stealAmount,
          success: true,
        });

        await queryRunner.commitTransaction();

        return {
          success: true,
          goldChange: stealAmount,
          message: `Stolen ${stealAmount.toFixed(2)} GOLD!`,
        };
      } else {
        // Dog bite: thief loses energy and drops gold to victim
        const dogBiteEnergyCost = this.cfg<number>('game.dogBiteEnergyCost');
        const bitePenalty = Number(thiefLocked.goldBalance) * this.cfg<number>('game.dogBitePenaltyPercent');

        await queryRunner.manager
          .createQueryBuilder()
          .update(User)
          .set({
            energy: () => `GREATEST(0, "energy" - ${dogBiteEnergyCost})`,
            goldBalance: () => `GREATEST(0, "gold_balance" - ${bitePenalty})`,
          })
          .where('id = :id', { id: thiefId })
          .execute();

        if (bitePenalty > 0) {
          await queryRunner.manager
            .createQueryBuilder()
            .update(User)
            .set({ goldBalance: () => `"gold_balance" + ${bitePenalty}` })
            .where('id = :id', { id: dto.targetUserId })
            .execute();
        }

        await queryRunner.manager.insert(StealLog, {
          thiefId,
          victimId: dto.targetUserId,
          plotId: plot.id,
          amount: bitePenalty,
          success: false,
        });

        await queryRunner.commitTransaction();

        return {
          success: false,
          goldChange: -bitePenalty,
          message: `Guard dog bit you! Lost ${bitePenalty.toFixed(2)} GOLD and ${dogBiteEnergyCost} energy.`,
        };
      }
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
