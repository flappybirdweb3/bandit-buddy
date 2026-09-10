import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Guild } from './entities/guild.entity';
import { GuildMember } from './entities/guild-member.entity';
import { Subscription } from './entities/subscription.entity';
import { User } from '../user/entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';

const GUILD_MAX_MEMBERS = 50;
const GUILD_CREATE_COST = 200;   // GOLD to create a guild
const ELITE_TAX_MAX    = 0.05;   // 5% max harvest tax
const BUTLER_CHECK_INTERVAL = '*/30 * * * *'; // every 30 min

const SUBSCRIPTION_DAYS: Record<string, number> = {
  butler_7d:         7,
  butler_30d:       30,
  crop_insurance_7d: 7,
};

@Injectable()
export class GuildService {
  private readonly logger = new Logger(GuildService.name);

  constructor(
    @InjectRepository(Guild)        private readonly guildRepo: Repository<Guild>,
    @InjectRepository(GuildMember)  private readonly memberRepo: Repository<GuildMember>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(User)         private readonly userRepo: Repository<User>,
    @InjectRepository(FarmPlot)     private readonly plotRepo: Repository<FarmPlot>,
    @InjectRepository(SeedConfig)   private readonly seedRepo: Repository<SeedConfig>,
    @InjectDataSource()             private readonly dataSource: DataSource,
  ) {}

  // ── Guild CRUD ─────────────────────────────────────────────────────────────

  async createGuild(ownerId: string, name: string) {
    const existing = await this.memberRepo.findOne({ where: { userId: ownerId } });
    if (existing) throw new BadRequestException('You are already in a guild. Leave first.');

    const nameTaken = await this.guildRepo.findOne({ where: { name } });
    if (nameTaken) throw new BadRequestException('Guild name already taken');

    const owner = await this.userRepo.findOneOrFail({ where: { id: ownerId } });
    if (Number(owner.goldBalance) < GUILD_CREATE_COST) {
      throw new BadRequestException(`Need ${GUILD_CREATE_COST}G to create a guild`);
    }

    return this.dataSource.transaction(async (em) => {
      await em.decrement(User, { id: ownerId }, 'goldBalance', GUILD_CREATE_COST);
      const guild = em.create(Guild, { name, ownerId });
      const saved = await em.save(Guild, guild);
      await em.save(GuildMember, { userId: ownerId, guildId: saved.id, role: 'owner' });
      return { id: saved.id, name: saved.name, tier: saved.tier, message: `Guild "${name}" created!` };
    });
  }

  async joinGuild(userId: string, guildId: string) {
    const already = await this.memberRepo.findOne({ where: { userId } });
    if (already) throw new BadRequestException('Leave your current guild first');

    const guild = await this.guildRepo.findOne({ where: { id: guildId }, relations: ['members'] });
    if (!guild) throw new NotFoundException('Guild not found');

    const memberCount = guild.members?.length ?? 0;
    if (memberCount >= GUILD_MAX_MEMBERS)
      throw new BadRequestException('Guild is full (max 50 members)');

    await this.memberRepo.save({ userId, guildId, role: 'member' });
    return { message: `Joined guild "${guild.name}"` };
  }

  async leaveGuild(userId: string) {
    const member = await this.memberRepo.findOne({ where: { userId } });
    if (!member) throw new BadRequestException('You are not in a guild');

    const guild = await this.guildRepo.findOneOrFail({ where: { id: member.guildId } });
    if (guild.ownerId === userId) {
      throw new BadRequestException('Owner must transfer ownership or disband the guild before leaving');
    }

    await this.memberRepo.delete({ userId, guildId: member.guildId });
    return { message: 'Left guild' };
  }

  async disbandGuild(ownerId: string) {
    const member = await this.memberRepo.findOne({ where: { userId: ownerId } });
    if (!member) throw new NotFoundException('You are not in a guild');

    const guild = await this.guildRepo.findOneOrFail({ where: { id: member.guildId } });
    if (guild.ownerId !== ownerId) throw new ForbiddenException('Only the owner can disband');

    await this.guildRepo.delete(guild.id); // cascade deletes members
    return { message: 'Guild disbanded' };
  }

  async getMyGuild(userId: string) {
    const member = await this.memberRepo.findOne({ where: { userId } });
    if (!member) return null;

    const guild = await this.guildRepo.findOne({
      where: { id: member.guildId },
      relations: ['members', 'members.user'],
    });
    if (!guild) return null;

    return {
      id: guild.id,
      name: guild.name,
      tier: guild.tier,
      stakedFarm: Number(guild.stakedFarm),
      taxRate: Number(guild.taxRate),
      worldTreeHp: guild.worldTreeHp,
      myRole: member.role,
      memberCount: guild.members?.length ?? 0,
      members: guild.members?.map((m) => ({
        userId: m.userId,
        username: m.user?.username ?? 'Unknown',
        role: m.role,
        joinedAt: m.joinedAt,
      })) ?? [],
    };
  }

  async listGuilds(limit = 20, offset = 0) {
    const guilds = await this.guildRepo.find({
      relations: ['members', 'owner'],
      order: { stakedFarm: 'DESC' },
      take: limit,
      skip: offset,
    });
    return guilds.map((g) => ({
      id: g.id,
      name: g.name,
      tier: g.tier,
      stakedFarm: Number(g.stakedFarm),
      memberCount: g.members?.length ?? 0,
      ownerUsername: g.owner?.username ?? 'Unknown',
    }));
  }

  async upgradeToElite(ownerId: string) {
    const member = await this.memberRepo.findOne({ where: { userId: ownerId } });
    if (!member) throw new NotFoundException('You are not in a guild');

    const guild = await this.guildRepo.findOneOrFail({ where: { id: member.guildId } });
    if (guild.ownerId !== ownerId) throw new ForbiddenException('Only the owner can upgrade');
    if (guild.tier === 'elite') throw new BadRequestException('Already Elite tier');
    if (Number(guild.stakedFarm) < 500) {
      throw new BadRequestException('Need 500 staked $FARM to upgrade to Elite');
    }

    await this.guildRepo.update(guild.id, { tier: 'elite', taxRate: 0.02 });
    return { message: 'Guild upgraded to Elite! Harvest tax set to 2%.' };
  }

  // ── Subscription (#49) ────────────────────────────────────────────────────

  async purchaseSubscription(userId: string, effectType: string) {
    const days = SUBSCRIPTION_DAYS[effectType];
    if (!days) throw new BadRequestException('Unknown subscription type');

    const type = effectType.startsWith('butler') ? 'butler' : 'crop_insurance';
    const existing = await this.subRepo.findOne({
      where: { userId, type, expiresAt: MoreThan(new Date()) },
    });

    // Extend existing subscription or create new
    const now = new Date();
    const base = existing?.expiresAt ?? now;
    const expiresAt = new Date(base.getTime() + days * 86_400_000);

    if (existing) {
      await this.subRepo.update(existing.id, { expiresAt });
    } else {
      await this.subRepo.save({ userId, type, expiresAt });
    }

    return { message: `${type} subscription active until ${expiresAt.toISOString()}`, expiresAt };
  }

  async getSubscriptionStatus(userId: string) {
    const subs = await this.subRepo.find({
      where: { userId, expiresAt: MoreThan(new Date()) },
    });
    return {
      hasButler:        subs.some((s) => s.type === 'butler'),
      hasCropInsurance: subs.some((s) => s.type === 'crop_insurance'),
      subscriptions:    subs.map((s) => ({ type: s.type, expiresAt: s.expiresAt })),
    };
  }

  // ── Butler cron (#49) ─────────────────────────────────────────────────────

  /** Auto-harvest ripe crops for all active Butler subscribers every 30 min. */
  @Cron(BUTLER_CHECK_INTERVAL)
  async runButlerHarvests(): Promise<void> {
    const now = new Date();

    // Find active Butler subscribers
    const butlerSubs = await this.subRepo.find({
      where: { type: 'butler', expiresAt: MoreThan(now) },
    });
    if (butlerSubs.length === 0) return;

    const userIds = [...new Set(butlerSubs.map((s) => s.userId))];
    let totalHarvested = 0;

    for (const userId of userIds) {
      try {
        const ripePlots = await this.plotRepo
          .createQueryBuilder('p')
          .leftJoinAndSelect('p.seed', 'seed')
          .where('p.user_id = :userId', { userId })
          .andWhere('p.seed_id IS NOT NULL')
          .andWhere('p.harvestable_at <= :now', { now })
          .getMany();

        for (const plot of ripePlots) {
          const baseYield = Number(plot.seed?.baseYield ?? 0);
          const mult = plot.level >= 1 ? 1 + (plot.level - 1) * 0.25 : 1;
          const soilMult = (plot.soilFertility ?? 100) / 100;
          const earned = parseFloat((baseYield * mult * soilMult).toFixed(2));

          await this.dataSource.transaction(async (em) => {
            await em.increment(User, { id: userId }, 'goldBalance', earned);
            await em.increment(User, { id: userId }, 'totalHarvests', 1);
            await em.update(FarmPlot, plot.id, {
              seedId: null,
              plantedAt: null,
              harvestableAt: null,
              totalStolen: 0,
              lastStolenAt: null,
              fertilized: false,
              soilFertility: Math.max(0, (plot.soilFertility ?? 100) - 20),
            });
          });
          totalHarvested++;
        }
      } catch (err: any) {
        this.logger.warn(`Butler harvest failed for ${userId}: ${err.message}`);
      }
    }

    if (totalHarvested > 0) {
      this.logger.log(`Butler: auto-harvested ${totalHarvested} plots for ${userIds.length} users`);
    }
  }

  // ── Harvest tax (called by action.service on harvest) ────────────────────

  async applyGuildHarvestTax(userId: string, goldEarned: number): Promise<number> {
    const member = await this.memberRepo.findOne({ where: { userId } });
    if (!member) return 0;

    const guild = await this.guildRepo.findOne({ where: { id: member.guildId } });
    if (!guild || guild.tier !== 'elite') return 0;

    const taxRate = Math.min(Number(guild.taxRate), ELITE_TAX_MAX);
    const tax = parseFloat((goldEarned * taxRate).toFixed(2));
    if (tax <= 0) return 0;

    // Add tax to guild's staked_farm pool
    await this.guildRepo.increment({ id: guild.id }, 'stakedFarm', tax);
    return tax;
  }
}
