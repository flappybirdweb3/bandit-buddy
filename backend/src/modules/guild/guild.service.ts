import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger, Optional,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan, EntityManager, ILike, Not, IsNull } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Guild } from './entities/guild.entity';
import { GuildMember } from './entities/guild-member.entity';
import { Subscription } from './entities/subscription.entity';
import { TreeContribution } from './entities/tree-contribution.entity';
import { User } from '../user/entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';
import { UPGRADE_MULTIPLIERS } from '../farm/farm.service';
import { LaunchConfigService } from '../user/launch-config.service';

const GUILD_CREATE_COST = 0;     // Free tier: 0G (1 per account as per PRD)
const ELITE_TAX_MIN     = 0.01;  // 1% min harvest tax
const ELITE_TAX_MAX     = 0.05;  // 5% max harvest tax
const BUTLER_CHECK_INTERVAL = '*/30 * * * *'; // every 30 min

const SUBSCRIPTION_DAYS: Record<string, number> = {
  butler_7d:          7,
  butler_30d:        30,
  crop_insurance_7d:  7,
  crop_insurance_30d: 30,
};

@Injectable()
export class GuildService {
  private readonly logger = new Logger(GuildService.name);

  constructor(
    @InjectRepository(Guild)            private readonly guildRepo: Repository<Guild>,
    @InjectRepository(GuildMember)      private readonly memberRepo: Repository<GuildMember>,
    @InjectRepository(Subscription)     private readonly subRepo: Repository<Subscription>,
    @InjectRepository(TreeContribution) private readonly treeContribRepo: Repository<TreeContribution>,
    @InjectRepository(User)             private readonly userRepo: Repository<User>,
    @InjectRepository(FarmPlot)         private readonly plotRepo: Repository<FarmPlot>,
    @InjectRepository(SeedConfig)       private readonly seedRepo: Repository<SeedConfig>,
    @InjectDataSource()                 private readonly dataSource: DataSource,
    @Optional()                         private readonly launchConfig?: LaunchConfigService,
  ) {}

  // ── Guild CRUD ─────────────────────────────────────────────────────────────

  async createGuild(ownerId: string, name: string) {
    const existing = await this.memberRepo.findOne({ where: { userId: ownerId } });
    if (existing) throw new BadRequestException('You are already in a guild. Leave first.');

    const nameTaken = await this.guildRepo.findOne({ where: { name } });
    if (nameTaken) throw new BadRequestException('Guild name already taken');

    return this.dataSource.transaction(async (em) => {
      const guild = em.create(Guild, {
        name,
        ownerId,
        tier: 'free',
        isPremium: false,
        treeLevel: 1,
        treeProgressPercent: 0,
        status: 'growing',
        worldTreeHp: 1000,
        rewardPoolFarm: 100,
        rewardPoolGold: 2000,
        taxRate: 0,
      });
      const saved = await em.save(Guild, guild);
      await em.save(GuildMember, { userId: ownerId, guildId: saved.id, role: 'owner' });

      // Initialize owner contribution
      await em.save(TreeContribution, {
        guildId: saved.id,
        userId: ownerId,
        waterCount: 0,
        invitedCount: 0,
        calculatedPoints: 0,
        claimed: false,
      });

      return {
        id: saved.id,
        name: saved.name,
        tier: saved.tier,
        isPremium: saved.isPremium,
        message: `Guild "${name}" created successfully!`,
      };
    });
  }

  async joinGuild(userId: string, guildId: string) {
    const already = await this.memberRepo.findOne({ where: { userId } });
    if (already) throw new BadRequestException('Leave your current guild first');

    const guild = await this.guildRepo.findOne({ where: { id: guildId }, relations: ['members'] });
    if (!guild) throw new NotFoundException('Guild not found');

    const memberCount = guild.members?.length ?? 0;
    const maxLimit = guild.isElite ? 1000 : 20; // Free tier max 20, Elite unlimited
    if (memberCount >= maxLimit) {
      throw new BadRequestException(
        guild.isElite
          ? 'Guild is at capacity'
          : 'Free tier guilds are limited to 20 members. Upgrade to Elite for unlimited members!',
      );
    }

    await this.memberRepo.save({ userId, guildId, role: 'member' });

    // Initialize member contribution record if not present
    const existingContrib = await this.treeContribRepo.findOne({ where: { guildId, userId } });
    if (!existingContrib) {
      await this.treeContribRepo.save({
        guildId,
        userId,
        waterCount: 0,
        invitedCount: 0,
        calculatedPoints: 0,
        claimed: false,
      });
    }

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

    await this.guildRepo.delete(guild.id); // cascade deletes members and contributions
    return { message: 'Guild disbanded' };
  }

  async getMyGuild(userId: string) {
    const member = await this.memberRepo.findOne({ where: { userId } });
    if (!member) return null;

    return this.buildGuildDetail(member.guildId, member, userId);
  }

  async getGuildByTelegramGroup(telegramGroupId: string, userId?: string) {
    const guild = await this.guildRepo.findOne({ where: { telegramGroupId } });
    if (!guild) return null;

    let member: GuildMember | null = null;
    if (userId) {
      member = await this.memberRepo.findOne({ where: { userId, guildId: guild.id } });
    }
    return this.buildGuildDetail(guild.id, member, userId);
  }

  async buildGuildDetail(guildId: string, member?: GuildMember | null, userId?: string) {
    const guild = await this.guildRepo.findOne({
      where: { id: guildId },
      relations: ['members', 'members.user'],
    });
    if (!guild) return null;

    let contrib: TreeContribution | null = null;
    if (userId) {
      contrib = await this.treeContribRepo.findOne({
        where: { guildId: guild.id, userId },
      });
    }

    const now = new Date();
    const canWater = !contrib?.lastWateredAt ||
      (now.getTime() - new Date(contrib.lastWateredAt).getTime() >= 24 * 60 * 60 * 1000);

    const cooldownRemainingMs = contrib?.lastWateredAt
      ? Math.max(0, 24 * 60 * 60 * 1000 - (now.getTime() - new Date(contrib.lastWateredAt).getTime()))
      : 0;

    const isShielded = !!guild.shieldUntil && new Date(guild.shieldUntil) > now;
    const shieldRemainingMs = isShielded ? new Date(guild.shieldUntil!).getTime() - now.getTime() : 0;

    // Top 5 contributors
    const topContribs = await this.treeContribRepo.find({
      where: { guildId: guild.id },
      relations: ['user'],
      order: { calculatedPoints: 'DESC' },
      take: 5,
    });

    const totalPoints = (await this.treeContribRepo.find({ where: { guildId: guild.id } }))
      .reduce((acc, c) => acc + (c.calculatedPoints || 0), 0) || 1;

    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'referredBy'] });
    const isViralBoostEligible = (!contrib || contrib.waterCount === 0) && !!user?.referredBy;

    return {
      id: guild.id,
      name: guild.name,
      tier: guild.tier,
      isPremium: guild.isElite,
      stakedFarm: Number(guild.stakedFarm || 0),
      taxRate: Number(guild.taxRate || 0),
      worldTreeHp: Number(guild.worldTreeHp ?? 1000),
      treeLevel: Number(guild.treeLevel || 1),
      treeProgressPercent: Number(guild.treeProgressPercent || 0),
      status: guild.status,
      isShielded,
      shieldUntil: guild.shieldUntil,
      shieldRemainingHours: parseFloat((shieldRemainingMs / (1000 * 60 * 60)).toFixed(1)),
      shieldRemainingMs,
      rewardPoolFarm: Number(guild.rewardPoolFarm || 100),
      rewardPoolGold: Number(guild.rewardPoolGold || 2000),
      telegramGroupId: guild.telegramGroupId,
      myRole: member?.role ?? 'guest',
      memberCount: guild.members?.length ?? 0,
      maxMembers: guild.isElite ? 1000 : 20,
      members: guild.members?.map((m) => ({
        userId: m.userId,
        username: m.user?.username ?? 'Unknown',
        role: m.role,
        joinedAt: m.joinedAt,
      })) ?? [],
      myContribution: {
        waterCount: contrib?.waterCount ?? 0,
        invitedCount: contrib?.invitedCount ?? 0,
        calculatedPoints: contrib?.calculatedPoints ?? 0,
        claimed: contrib?.claimed ?? false,
        lastWateredAt: contrib?.lastWateredAt ?? null,
        canWater,
        isViralBoostEligible,
        cooldownRemainingHours: Math.ceil(cooldownRemainingMs / (1000 * 60 * 60)),
        sharePercent: parseFloat((((contrib?.calculatedPoints ?? 0) / totalPoints) * (member?.role === 'owner' ? 100 : 90)).toFixed(1)),
      },
      topContributors: topContribs.map((tc) => ({
        userId: tc.userId,
        username: tc.user?.username ?? 'Farmer',
        points: tc.calculatedPoints,
        waterCount: tc.waterCount,
        invitedCount: tc.invitedCount,
      })),
    };
  }

  async listGuilds(limit = 20, offset = 0) {
    const guilds = await this.guildRepo.find({
      relations: ['members', 'owner'],
      order: { treeLevel: 'DESC', stakedFarm: 'DESC' },
      take: limit,
      skip: offset,
    });
    const now = new Date();
    return guilds.map((g) => ({
      id: g.id,
      name: g.name,
      tier: g.tier,
      isPremium: g.isElite,
      treeLevel: g.treeLevel,
      treeProgressPercent: Number(g.treeProgressPercent || 0),
      status: g.status,
      worldTreeHp: Number(g.worldTreeHp ?? 1000),
      rewardPoolFarm: Number(g.rewardPoolFarm || 100),
      rewardPoolGold: Number(g.rewardPoolGold || 2000),
      shieldUntil: g.shieldUntil,
      isShielded: !!(g.shieldUntil && new Date(g.shieldUntil) > now),
      stakedFarm: Number(g.stakedFarm || 0),
      memberCount: g.members?.length ?? 0,
      maxMembers: g.isElite ? 1000 : 20,
      ownerUsername: g.owner?.username ?? 'Unknown',
    }));
  }

  // ── World Tree Social-Fi Engine ──────────────────────────────────────────

  /**
   * High-concurrency Watering with PostgreSQL Row-Level Lock (FOR UPDATE)
   * Prevents race conditions when 100+ Telegram group members type /water simultaneously.
   */
  async waterTree(userId: string, targetGuildId?: string) {
    return this.dataSource.transaction(async (em) => {
      // 1. Verify membership
      let member: GuildMember | null = null;
      if (targetGuildId) {
        member = await em.findOne(GuildMember, { where: { userId, guildId: targetGuildId } });
        if (!member) {
          const targetGuild = await em.findOne(Guild, {
            where: { id: targetGuildId },
            relations: ['members'],
          });
          if (!targetGuild) throw new NotFoundException('Guild not found');
          const maxM = targetGuild.isElite ? 1000 : 20;
          if ((targetGuild.members?.length ?? 0) >= maxM) {
            throw new BadRequestException('Guild is currently full');
          }
          member = em.create(GuildMember, {
            guildId: targetGuild.id,
            userId,
            role: 'member',
          });
          await em.save(GuildMember, member);
        }
      } else {
        member = await em.findOne(GuildMember, { where: { userId } });
      }
      if (!member) throw new BadRequestException('You are not in a guild. Join one first!');

      // 2. Row-Level Lock on Guild via pessimistic_write (SELECT ... FOR UPDATE)
      const guild = await em.findOne(Guild, {
        where: { id: member.guildId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!guild) throw new NotFoundException('Guild not found');

      if (guild.status === 'ripe') {
        throw new BadRequestException('🌳 World Tree is already RIPE (100%)! Claim your rewards or protect it with an Energy Shield!');
      }

      const maxLevel = guild.isElite ? 10 : 3;
      if (!guild.isElite && guild.treeLevel >= 3 && Number(guild.treeProgressPercent) >= 100) {
        throw new BadRequestException('Free tier guilds are capped at Tree Level 3. Upgrade to Elite for max Level 10!');
      }

      // 3. Check 24h cooldown per user
      let contribution = await em.findOne(TreeContribution, {
        where: { guildId: guild.id, userId },
      });

      const now = new Date();
      if (contribution?.lastWateredAt) {
        const lastWaterMs = new Date(contribution.lastWateredAt).getTime();
        const cooldownMs = 24 * 60 * 60 * 1000;
        if (now.getTime() - lastWaterMs < cooldownMs) {
          const hoursLeft = Math.ceil((cooldownMs - (now.getTime() - lastWaterMs)) / (1000 * 60 * 60));
          throw new BadRequestException(`You have already watered the World Tree today. Cooldown: ${hoursLeft}h remaining.`);
        }
      }

      // 4. Growth calculation:
      // Regular water: +1%
      // Viral Growth Hack: If user was invited via referral & this is their first water: +5%!
      let progressAdd = 1.0;
      const user = await em.findOneOrFail(User, { where: { id: userId } });
      const isFirstWater = !contribution || contribution.waterCount === 0;
      let isViralBoost = false;

      if (isFirstWater && user.referredBy) {
        const boost = this.launchConfig?.isLaunchEventActive()
          ? this.launchConfig.getGuildNewMemberWaterBoost()
          : 5.0;
        progressAdd = boost;
        isViralBoost = true;

        // Credit referrer contribution in this guild if present
        const referrerMember = await em.findOne(GuildMember, {
          where: { guildId: guild.id, userId: user.referredBy },
        });
        if (referrerMember) {
          let referrerContrib = await em.findOne(TreeContribution, {
            where: { guildId: guild.id, userId: user.referredBy },
          });
          if (referrerContrib) {
            referrerContrib.invitedCount += 1;
            referrerContrib.calculatedPoints =
              (referrerContrib.waterCount * 1) + (referrerContrib.invitedCount * 5);
            await em.save(TreeContribution, referrerContrib);
          } else {
            referrerContrib = em.create(TreeContribution, {
              guildId: guild.id,
              userId: user.referredBy,
              waterCount: 0,
              invitedCount: 1,
              calculatedPoints: 5,
              claimed: false,
            });
            await em.save(TreeContribution, referrerContrib);
          }
        }
      }

      // 5. Update user contribution
      if (!contribution) {
        contribution = em.create(TreeContribution, {
          guildId: guild.id,
          userId,
          waterCount: 1,
          invitedCount: 0,
          calculatedPoints: 1,
          lastWateredAt: now,
          claimed: false,
        });
      } else {
        contribution.waterCount += 1;
        contribution.calculatedPoints = (contribution.waterCount * 1) + (contribution.invitedCount * 5);
        contribution.lastWateredAt = now;
        contribution.claimed = false;
      }
      await em.save(TreeContribution, contribution);

      // 6. Update tree progress
      const currentProgress = Number(guild.treeProgressPercent || 0);
      let newProgress = currentProgress + progressAdd;
      let isRipe = false;

      if (newProgress >= 100) {
        newProgress = 100.0;
        guild.status = 'ripe';
        guild.ripeAt = now;
        isRipe = true;
        const levelMult = Math.max(1, guild.treeLevel);
        guild.rewardPoolFarm = Number((100 * levelMult * (guild.isElite ? 1.5 : 1.0)).toFixed(2));
        guild.rewardPoolGold = Number((2000 * levelMult * (guild.isElite ? 1.5 : 1.0)).toFixed(2));
      }
      guild.treeProgressPercent = newProgress;
      await em.save(Guild, guild);

      return {
        message: isViralBoost
          ? `🌟 Viral Boost! First water from referral added +${progressAdd}% growth!`
          : `💧 Watered successfully! +1% tree growth.`,
        progressAdded: progressAdd,
        treeProgressPercent: Number(guild.treeProgressPercent),
        treeLevel: guild.treeLevel,
        status: guild.status,
        isRipe,
        myPoints: contribution.calculatedPoints,
        waterCount: contribution.waterCount,
        invitedCount: contribution.invitedCount,
      };
    });
  }

  /**
   * Proof of Contribution Claim:
   * When tree is ripe, 10% goes to Guild Master, 90% is shared by member points.
   */
  async claimTreeReward(userId: string) {
    return this.dataSource.transaction(async (em) => {
      const member = await em.findOne(GuildMember, { where: { userId } });
      if (!member) throw new NotFoundException('You are not in a guild');

      const guild = await em.findOne(Guild, {
        where: { id: member.guildId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!guild) throw new NotFoundException('Guild not found');

      if (guild.status !== 'ripe') {
        throw new BadRequestException(`World Tree is not ripe yet! Progress: ${guild.treeProgressPercent}%`);
      }

      const myContrib = await em.findOne(TreeContribution, {
        where: { guildId: guild.id, userId },
      });
      if (!myContrib) throw new BadRequestException('You have not contributed to this World Tree');
      if (myContrib.claimed) throw new BadRequestException('You have already claimed rewards for this cycle');

      const allContribs = await em.find(TreeContribution, {
        where: { guildId: guild.id },
      });
      const totalPoints = allContribs.reduce((sum, c) => sum + (c.calculatedPoints || 0), 0) || 1;

      const isOwner = guild.ownerId === userId;
      // 10% base to Owner + proportional share of 90%
      const ownerShare = isOwner ? 0.10 : 0.0;
      const memberShare = (myContrib.calculatedPoints / totalPoints) * 0.90;
      const totalShare = ownerShare + memberShare;

      const earnedFarm = parseFloat((Number(guild.rewardPoolFarm) * totalShare).toFixed(2));
      const earnedGold = parseFloat((Number(guild.rewardPoolGold) * totalShare).toFixed(2));

      // Credit user
      await em.increment(User, { id: userId }, 'goldBalance', earnedGold);
      await em.increment(User, { id: userId }, 'goldBalance', Math.round(earnedFarm * 10)); // Gold backing

      myContrib.claimed = true;
      await em.save(TreeContribution, myContrib);

      // Check if all active members claimed to advance to next level
      const allDone = allContribs.every((c) => c.userId === userId || c.claimed || c.calculatedPoints === 0);
      if (allDone) {
        const maxLevel = guild.isElite ? 10 : 3;
        guild.treeLevel = Math.min(maxLevel, guild.treeLevel + 1);
        guild.treeProgressPercent = 0;
        guild.status = 'growing';
        guild.ripeAt = null;
        guild.shieldUntil = null;
        guild.worldTreeHp = 1000;
        guild.rewardPoolFarm = 100 * guild.treeLevel * (guild.isElite ? 1.5 : 1.0);
        guild.rewardPoolGold = 2000 * guild.treeLevel * (guild.isElite ? 1.5 : 1.0);
        await em.save(Guild, guild);

        await em.update(TreeContribution, { guildId: guild.id }, {
          waterCount: 0,
          invitedCount: 0,
          calculatedPoints: 0,
          claimed: false,
        });
      }

      return {
        message: `🎉 Claimed ${earnedFarm} $FARM & ${earnedGold} Gold from World Tree!`,
        earnedFarm,
        earnedGold,
        myPoints: myContrib.calculatedPoints,
        totalGuildPoints: totalPoints,
        isOwner,
        cycleFinished: allDone,
      };
    });
  }

  /**
   * Energy Shield (The Token Sink):
   * Premium Guilds can spend Gold/$FARM to protect their World Tree during GvG raids.
   */
  async buyShield(userId: string) {
    const member = await this.memberRepo.findOne({ where: { userId } });
    if (!member) throw new NotFoundException('You are not in a guild');

    const guild = await this.guildRepo.findOneOrFail({ where: { id: member.guildId } });
    if (!guild.isElite) {
      throw new BadRequestException('Free tier guilds cannot purchase Energy Shields. Upgrade to Elite to unlock!');
    }

    const SHIELD_COST_GOLD = 500;
    const SHIELD_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

    return this.dataSource.transaction(async (em) => {
      const user = await em.findOneOrFail(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (Number(user.goldBalance) < SHIELD_COST_GOLD) {
        throw new BadRequestException(`Insufficient gold for Energy Shield (Need ${SHIELD_COST_GOLD}G)`);
      }

      await em.decrement(User, { id: userId }, 'goldBalance', SHIELD_COST_GOLD);

      const now = new Date();
      const baseTime = guild.shieldUntil && new Date(guild.shieldUntil) > now
        ? new Date(guild.shieldUntil)
        : now;
      const shieldUntil = new Date(baseTime.getTime() + SHIELD_DURATION_MS);

      await em.update(Guild, guild.id, { shieldUntil });

      return {
        message: `🛡️ Energy Shield activated! World Tree protected for 12 hours.`,
        shieldUntil,
      };
    });
  }

  /**
   * GvG PvP Guild Wars:
   * Raid an unshielded ripe tree from another guild.
   */
  async raidGuildTree(attackerId: string, targetGuildId: string) {
    const attackerMember = await this.memberRepo.findOne({ where: { userId: attackerId } });
    if (!attackerMember) throw new BadRequestException('You must be in a guild to raid other trees');
    if (attackerMember.guildId === targetGuildId) {
      throw new BadRequestException('Cannot raid your own guild tree!');
    }

    return this.dataSource.transaction(async (em) => {
      const targetGuild = await em.findOne(Guild, {
        where: { id: targetGuildId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!targetGuild) throw new NotFoundException('Target guild not found');

      if (targetGuild.status !== 'ripe') {
        throw new BadRequestException('Target World Tree is not RIPE yet! Only ripe trees can be raided.');
      }

      const now = new Date();
      if (targetGuild.shieldUntil && new Date(targetGuild.shieldUntil) > now) {
        throw new BadRequestException('Target guild is protected by an active Energy Shield! Raid repelled.');
      }

      if (targetGuild.lastAttackedAt) {
        const diff = now.getTime() - new Date(targetGuild.lastAttackedAt).getTime();
        if (diff < 3 * 60 * 60 * 1000) {
          const minLeft = Math.ceil((3 * 60 * 60 * 1000 - diff) / 60000);
          throw new BadRequestException(`Target guild was recently raided. Cooldown: ${minLeft}m remaining.`);
        }
      }

      // Siphon 15% of the target's current rewards
      const stolenFarm = parseFloat((Number(targetGuild.rewardPoolFarm) * 0.15).toFixed(2));
      const stolenGold = parseFloat((Number(targetGuild.rewardPoolGold) * 0.15).toFixed(2));

      targetGuild.rewardPoolFarm = Math.max(0, Number(targetGuild.rewardPoolFarm) - stolenFarm);
      targetGuild.rewardPoolGold = Math.max(0, Number(targetGuild.rewardPoolGold) - stolenGold);
      targetGuild.lastAttackedAt = now;
      targetGuild.worldTreeHp = Math.max(0, (targetGuild.worldTreeHp ?? 1000) - 150);
      await em.save(Guild, targetGuild);

      // Give reward to attacker
      await em.increment(User, { id: attackerId }, 'goldBalance', stolenGold);

      return {
        message: `⚔️ Raid successful! Siphoned ${stolenFarm} $FARM & ${stolenGold}G from ${targetGuild.name}!`,
        stolenFarm,
        stolenGold,
      };
    });
  }

  /**
   * Set Harvest Tax (1% - 5%) - Elite Master only
   */
  async setTaxRate(ownerId: string, taxRate: number) {
    const member = await this.memberRepo.findOne({ where: { userId: ownerId } });
    if (!member) throw new NotFoundException('You are not in a guild');

    const guild = await this.guildRepo.findOneOrFail({ where: { id: member.guildId } });
    if (guild.ownerId !== ownerId) throw new ForbiddenException('Only the owner can set tax rate');
    if (!guild.isElite) throw new BadRequestException('Only Elite guilds can set harvest tax (1% - 5%)');

    const rate = Number(taxRate);
    if (isNaN(rate) || rate < ELITE_TAX_MIN || rate > ELITE_TAX_MAX) {
      throw new BadRequestException(`Tax rate must be between 1% (0.01) and 5% (0.05)`);
    }

    await this.guildRepo.update(guild.id, { taxRate: rate });
    return { message: `Harvest tax updated to ${(rate * 100).toFixed(0)}%`, taxRate: rate };
  }

  /**
   * Link Telegram Group Chat to Guild
   */
  async linkTelegramGroup(ownerId: string, telegramGroupId: string, guildNameOrId?: string) {
    let guild: Guild | null = null;
    const cleanParam = guildNameOrId?.trim();
    if (cleanParam) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanParam);
      if (isUuid) {
        guild = await this.guildRepo.findOne({ where: { id: cleanParam, ownerId } });
      } else {
        guild = await this.guildRepo.findOne({ where: { name: ILike(cleanParam), ownerId } });
      }
    }
    if (!guild) {
      guild = await this.guildRepo.findOne({ where: { ownerId } });
    }
    if (!guild) {
      const member = await this.memberRepo.findOne({ where: { userId: ownerId } });
      if (!member) throw new NotFoundException('You are not in a guild. Create one first!');
      throw new ForbiddenException('Only the guild owner can link Telegram groups');
    }

    await this.guildRepo.update(guild.id, { telegramGroupId });
    return { message: `Telegram Group linked to guild "${guild.name}"!`, telegramGroupId };
  }

  // ── Staking & Elite Tier ──────────────────────────────────────────────────

  async upgradeToElite(ownerId: string) {
    const member = await this.memberRepo.findOne({ where: { userId: ownerId } });
    if (!member) throw new NotFoundException('You are not in a guild');

    const guild = await this.guildRepo.findOneOrFail({ where: { id: member.guildId } });
    if (guild.ownerId !== ownerId) throw new ForbiddenException('Only the owner can upgrade');
    if (guild.tier === 'elite' || guild.isPremium) throw new BadRequestException('Already Elite tier');
    if (Number(guild.stakedFarm) < 1000) {
      throw new BadRequestException('Need 1,000 staked $FARM to upgrade to Elite (Blue Badge)');
    }

    await this.guildRepo.update(guild.id, { tier: 'elite', isPremium: true, taxRate: 0.02 });
    return { message: 'Guild upgraded to Elite! Blue Badge activated. Harvest tax set to 2%.' };
  }

  async stakeToGuild(userId: string, amount: number) {
    if (!amount || amount <= 0) throw new BadRequestException('Amount must be positive');

    const member = await this.memberRepo.findOne({ where: { userId } });
    if (!member) throw new NotFoundException('You are not in a guild');

    const guild = await this.guildRepo.findOneOrFail({ where: { id: member.guildId } });
    if (guild.ownerId !== userId) throw new ForbiddenException('Only the owner can stake $FARM');

    return this.dataSource.transaction(async (em) => {
      const user = await em.findOneOrFail(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (Number(user.goldBalance) < amount) {
        throw new BadRequestException('Insufficient gold balance');
      }
      await em.decrement(User, { id: userId }, 'goldBalance', amount);
      await em.increment(Guild, { id: guild.id }, 'stakedFarm', amount);
      const updated = await em.findOneOrFail(Guild, { where: { id: guild.id } });
      return {
        message: `Staked ${amount}G to guild. Total staked: ${updated.stakedFarm}`,
        stakedFarm: Number(updated.stakedFarm),
        canUpgrade: Number(updated.stakedFarm) >= 1000,
      };
    });
  }

  // ── Subscription (#49) ────────────────────────────────────────────────────

  async purchaseSubscription(userId: string, effectType: string) {
    const days = SUBSCRIPTION_DAYS[effectType];
    if (!days) throw new BadRequestException('Unknown subscription type');
    return this.dataSource.transaction((em) => this._applySubscription(em, userId, effectType, days));
  }

  async purchaseSubscriptionTx(em: EntityManager, userId: string, effectType: string) {
    const days = SUBSCRIPTION_DAYS[effectType];
    if (!days) throw new BadRequestException('Unknown subscription type');
    return this._applySubscription(em, userId, effectType, days);
  }

  private async _applySubscription(em: EntityManager, userId: string, effectType: string, days: number) {
    const type = effectType.startsWith('butler') ? 'butler' : 'crop_insurance';
    const existing = await em.findOne(Subscription, {
      where: { userId, type, expiresAt: MoreThan(new Date()) },
    });

    const now = new Date();
    const base = existing?.expiresAt ?? now;
    const expiresAt = new Date(base.getTime() + days * 86_400_000);

    if (existing) {
      await em.update(Subscription, existing.id, { expiresAt });
    } else {
      await em.save(Subscription, { userId, type, expiresAt });
    }

    return { message: `${type} subscription active until ${expiresAt.toISOString()}`, expiresAt };
  }

  async getSubscriptionStatus(userId: string) {
    const subs = await this.subRepo.find({
      where: { userId, expiresAt: MoreThan(new Date()) },
      relations: ['preferredSeed'],
    });
    const butler = subs.find((s) => s.type === 'butler');
    const insurance = subs.find((s) => s.type === 'crop_insurance');
    return {
      hasButler: !!butler,
      butlerExpiresAt: butler?.expiresAt ?? null,
      butlerPreferredSeedId: butler?.preferredSeedId ?? null,
      butlerPreferredSeed: butler?.preferredSeed
        ? {
            id: butler.preferredSeed.id,
            name: butler.preferredSeed.name,
            costGold: Number(butler.preferredSeed.costGold),
            levelRequired: butler.preferredSeed.levelRequired,
          }
        : null,
      hasCropInsurance: !!insurance,
      insuranceExpiresAt: insurance?.expiresAt ?? null,
      subscriptions: subs.map((s) => ({
        type: s.type,
        expiresAt: s.expiresAt,
        preferredSeedId: s.preferredSeedId,
      })),
    };
  }

  async setButlerPreferredSeed(userId: string, seedId: string | null) {
    const now = new Date();
    const butlerSub = await this.subRepo.findOne({
      where: { userId, type: 'butler', expiresAt: MoreThan(now) },
    });
    if (!butlerSub) {
      throw new BadRequestException('No active Barn Butler subscription found');
    }

    if (seedId) {
      const seed = await this.seedRepo.findOne({ where: { id: seedId } });
      if (!seed) {
        throw new NotFoundException('Seed not found');
      }
      const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'level'] });
      if ((user?.level ?? 1) < seed.levelRequired) {
        throw new BadRequestException(`Requires player level ${seed.levelRequired}`);
      }
      butlerSub.preferredSeedId = seedId;
    } else {
      butlerSub.preferredSeedId = null;
    }

    await this.subRepo.save(butlerSub);
    return {
      message: 'Butler preferred replanting crop updated successfully',
      preferredSeedId: butlerSub.preferredSeedId,
    };
  }

  // ── Butler cron (#49) ─────────────────────────────────────────────────────

  @Cron(BUTLER_CHECK_INTERVAL)
  async runButlerHarvests(): Promise<void> {
    const now = new Date();

    const butlerSubs = await this.subRepo.find({
      where: { type: 'butler', expiresAt: MoreThan(now) },
    });
    if (butlerSubs.length === 0) return;

    const userIds = [...new Set(butlerSubs.map((s) => s.userId))];
    let totalHarvested = 0;

    for (const userId of userIds) {
      try {
        // ── Butler Step 1: Auto-Harvest Ripe Crops ──
        const ripePlots = await this.plotRepo
          .createQueryBuilder('p')
          .leftJoinAndSelect('p.seed', 'seed')
          .where('p.user_id = :userId', { userId })
          .andWhere('p.seed_id IS NOT NULL')
          .andWhere('p.harvestable_at <= :now', { now })
          .getMany();

        for (const plot of ripePlots) {
          const baseYield = Number(plot.seed?.baseYield ?? 0);
          const mult = UPGRADE_MULTIPLIERS[(plot.level ?? 1) - 1] ?? 1.0;
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

        // ── Butler Step 2: Auto-Cure Weather Debuffs & Pests (OpEx) ──
        const growingPlots = await this.plotRepo.find({
          where: { userId, seedId: Not(IsNull()) },
        });

        for (const gp of growingPlots) {
          if (gp.harvestableAt && new Date(gp.harvestableAt) > now) {
            let opexCost = 0;
            const updates: Partial<FarmPlot> = {};

            if (gp.hasBugs) { opexCost += 60; updates.hasBugs = false; }
            if (gp.hasWeeds) { opexCost += 40; updates.hasWeeds = false; }
            const needsWater = !gp.lastWateredAt || (gp.plantedAt && new Date(gp.lastWateredAt) < new Date(gp.plantedAt));
            if (needsWater) { opexCost += 30; updates.lastWateredAt = now; }

            if (opexCost > 0) {
              const u = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'goldBalance'] });
              if (u && Number(u.goldBalance) >= opexCost + 100) {
                await this.dataSource.transaction(async (em) => {
                  await em.decrement(User, { id: userId }, 'goldBalance', opexCost);
                  await em.update(FarmPlot, gp.id, updates);
                });
              }
            }
          }
        }

        // ── Butler Step 3: Auto-Replant Empty Plots ──
        const emptyPlots = await this.plotRepo.find({
          where: { userId, seedId: IsNull() },
        });
        const plantable = emptyPlots.filter((p) => (p.soilFertility ?? 100) > 0);

        if (plantable.length > 0) {
          const butlerSub = await this.subRepo.findOne({
            where: { userId, type: 'butler', expiresAt: MoreThan(now) },
            relations: ['preferredSeed'],
          });

          const [defaultSeed] = await this.seedRepo.find({
            order: { levelRequired: 'ASC', costGold: 'ASC' },
            take: 1,
          });

          const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'goldBalance', 'level'] });
          let availableGold = Number(user?.goldBalance || 0);
          const userLevel = user?.level || 1;

          // Determine preferred seed eligibility
          let chosenSeed = defaultSeed;
          if (butlerSub?.preferredSeed) {
            const pref = butlerSub.preferredSeed;
            if (userLevel >= pref.levelRequired && availableGold >= Number(pref.costGold) + 100) {
              chosenSeed = pref;
            }
          }

          if (chosenSeed) {
            const initialCost = Number(chosenSeed.costGold);

            for (const ep of plantable) {
              // Dynamically check if available gold can afford chosenSeed; if not, fallback to defaultSeed
              let activeSeed = chosenSeed;
              let activeCost = initialCost;

              if (availableGold < activeCost + 100 && defaultSeed && activeSeed.id !== defaultSeed.id) {
                activeSeed = defaultSeed;
                activeCost = Number(defaultSeed.costGold);
              }

              if (availableGold >= activeCost + 100) {
                const harvestableAt = new Date(now.getTime() + activeSeed.growTimeSec * 1000);
                await this.dataSource.transaction(async (em) => {
                  await em.decrement(User, { id: userId }, 'goldBalance', activeCost);
                  await em.update(FarmPlot, ep.id, {
                    seedId: activeSeed.id,
                    plantedAt: now,
                    harvestableAt,
                    lastWateredAt: now,
                    fertilized: false,
                    hasBugs: false,
                    hasWeeds: false,
                    totalStolen: 0,
                  });
                });
                availableGold -= activeCost;
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Butler automation failed for ${userId}: ${err.message}`);
      }
    }

    if (totalHarvested > 0) {
      this.logger.log(`Butler: auto-harvested ${totalHarvested} plots for ${userIds.length} users`);
    }
  }

  // ── Harvest tax (called by action.service/inventory.service on harvest/sale) ──

  async applyGuildHarvestTax(userId: string, goldEarned: number): Promise<number> {
    const member = await this.memberRepo.findOne({ where: { userId } });
    if (!member) return 0;

    const guild = await this.guildRepo.findOne({ where: { id: member.guildId } });
    if (!guild || !guild.isElite) return 0;

    const taxRate = Math.min(Number(guild.taxRate), ELITE_TAX_MAX);
    const tax = parseFloat((goldEarned * taxRate).toFixed(2));
    if (tax <= 0) return 0;

    await this.guildRepo.increment({ id: guild.id }, 'rewardPoolGold', tax);
    this.logger.log(`Guild ${guild.name} collected ${tax} GOLD harvest tax from user ${userId}`);
    return tax;
  }

  /**
   * Auto-Compound Treasury:
   * Reinvests 50% of the accumulated guild rewardPoolGold into:
   * 1. World Tree Growth Progress (+% towards harvest)
   * 2. World Tree Health (+HP healing)
   * 3. Compounded $FARM Staking
   * 4. Bonus Contribution points for the initiating member
   */
  async autoCompound(userId: string) {
    return this.dataSource.transaction(async (em) => {
      const member = await em.findOne(GuildMember, { where: { userId } });
      if (!member) throw new NotFoundException('You are not in a guild');

      const guild = await em.findOne(Guild, {
        where: { id: member.guildId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!guild) throw new NotFoundException('Guild not found');

      const currentGold = Number(guild.rewardPoolGold || 0);
      if (currentGold < 100) {
        throw new BadRequestException(
          `Guild treasury requires at least 100 GOLD to auto-compound (current: ${currentGold.toFixed(0)} GOLD)`,
        );
      }

      // Reinvest 50% of current treasury gold
      const compoundGold = Math.floor(currentGold * 0.5);
      guild.rewardPoolGold = currentGold - compoundGold;

      // 40% of compoundGold -> Growth Progress (50 gold = +1.0% progress)
      const growthGold = compoundGold * 0.4;
      const progressBoost = parseFloat((growthGold / 50).toFixed(2));
      let newProgress = Number(guild.treeProgressPercent || 0) + progressBoost;
      if (newProgress >= 100) {
        newProgress = 100.0;
        guild.status = 'ripe';
        guild.ripeAt = new Date();
        const levelMult = Math.max(1, guild.treeLevel);
        guild.rewardPoolFarm = Number((100 * levelMult * (guild.isElite ? 1.5 : 1.0)).toFixed(2));
      }
      guild.treeProgressPercent = newProgress;

      // 30% of compoundGold -> World Tree HP healing (1 gold = 1.5 HP)
      const healGold = compoundGold * 0.3;
      const maxHp = 1000 * Math.max(1, guild.treeLevel);
      const hpGained = Math.round(healGold * 1.5);
      guild.worldTreeHp = Math.min(maxHp, Number(guild.worldTreeHp || 0) + hpGained);

      // 30% of compoundGold -> Compounded $FARM staking (100 gold = 1 FARM)
      const stakeGold = compoundGold * 0.3;
      const farmGained = parseFloat((stakeGold / 100).toFixed(4));
      guild.stakedFarm = Number((Number(guild.stakedFarm || 0) + farmGained).toFixed(4));

      await em.save(Guild, guild);

      // Reward initiating member with +5 contribution points
      let contribution = await em.findOne(TreeContribution, {
        where: { guildId: guild.id, userId },
      });
      if (!contribution) {
        contribution = em.create(TreeContribution, {
          guildId: guild.id,
          userId,
          waterCount: 0,
          invitedCount: 0,
          calculatedPoints: 5,
          claimed: false,
        });
      } else {
        contribution.calculatedPoints = Number(contribution.calculatedPoints || 0) + 5;
      }
      await em.save(TreeContribution, contribution);

      return {
        message: `⚡ Successfully auto-compounded ${compoundGold} GOLD into World Tree (+${progressBoost}% Growth, +${hpGained} HP, +${farmGained} $FARM Staked)!`,
        compoundGold,
        remainingTreasuryGold: Number(guild.rewardPoolGold),
        progressAdded: progressBoost,
        treeProgressPercent: Number(guild.treeProgressPercent),
        worldTreeHp: guild.worldTreeHp,
        maxWorldTreeHp: maxHp,
        stakedFarm: Number(guild.stakedFarm),
        treeStatus: guild.status,
      };
    });
  }
}
