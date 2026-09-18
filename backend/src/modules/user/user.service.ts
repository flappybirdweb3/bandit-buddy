import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, MoreThan, ILike, MoreThanOrEqual, DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { UserItem } from './entities/user-item.entity';
import { ReferralReward } from './entities/referral-reward.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';
import { StealLog } from '../farm/entities/steal-log.entity';
import { NotificationService } from '../notification/notification.service';
import { LaunchConfigService } from './launch-config.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserItem)
    private readonly itemRepo: Repository<UserItem>,
    @InjectRepository(ReferralReward)
    private readonly referralRewardRepo: Repository<ReferralReward>,
    @InjectRepository(FarmPlot)
    private readonly plotRepo: Repository<FarmPlot>,
    @InjectRepository(SeedConfig)
    private readonly seedRepo: Repository<SeedConfig>,
    @InjectRepository(StealLog)
    private readonly stealLogRepo: Repository<StealLog>,
    private readonly notificationService: NotificationService,
    private readonly launchConfig: LaunchConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private readonly DAILY_REWARDS = [120, 200, 300, 450, 650, 950, 1500];
  private readonly MAX_ENERGY = 100;
  private readonly ENERGY_REGEN_PER_HOUR = 15;   // full regen in ~6.7h (was 10 = 10h)
  private readonly DAILY_ENERGY_RESTORE = 50;
  private readonly CLAIM_COOLDOWN_MS = 20 * 3600 * 1000;   // 20h — allows claiming same time each day
  private readonly STREAK_WINDOW_MS  = 48 * 3600 * 1000;   // miss within 48h = streak resets

  private async applyEnergyRegen(user: User): Promise<number> {
    const now = Date.now();
    const lastUpdate = user.lastEnergyUpdate?.getTime() ?? now;
    const elapsedHours = (now - lastUpdate) / 3600_000;
    const gained = Math.floor(elapsedHours * this.ENERGY_REGEN_PER_HOUR);
    if (gained === 0) return user.energy;

    const cap = user.maxEnergy ?? this.MAX_ENERGY;
    const newEnergy = Math.min(cap, user.energy + gained);
    await this.userRepo.update(user.id, {
      energy: newEnergy,
      lastEnergyUpdate: new Date(),
    });
    return newEnergy;
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [plotCount, energy] = await Promise.all([
      this.plotRepo.count({ where: { userId } }),
      this.applyEnergyRegen(user),
    ]);

    const now = Date.now();
    const lastClaim = user.lastDailyClaim?.getTime() ?? 0;
    const canClaimDaily = (now - lastClaim) >= this.CLAIM_COOLDOWN_MS;
    const nextClaimAt = lastClaim ? new Date(lastClaim + this.CLAIM_COOLDOWN_MS) : null;
    const isStreakExpired = lastClaim > 0 && (now - lastClaim) >= this.STREAK_WINDOW_MS;
    if (isStreakExpired && user.dailyStreak > 0) {
      user.dailyStreak = 0;
      await this.userRepo.update(user.id, { dailyStreak: 0 });
    }

    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      walletAddress: user.walletAddress,
      goldBalance: Number(user.goldBalance),
      energy,
      maxEnergy: user.maxEnergy ?? this.MAX_ENERGY,
      lastEnergyUpdate: user.lastEnergyUpdate,
      trustScore: user.trustScore,
      plotCount,
      dailyStreak: user.dailyStreak,
      canClaimDaily,
      nextClaimAt,
      notificationsEnabled: user.notificationsEnabled,
      goldStolen: Number(user.goldStolen),
      totalHarvests: user.totalHarvests,
      totalPlants: user.totalPlants,
      totalAttacks: user.totalAttacks ?? 0,
      totalWaters: user.totalWaters ?? 0,
      normalFertCharges: user.normalFertCharges ?? 0,
      superFertCharges: user.superFertCharges ?? 0,
      advancedFertCharges: user.advancedFertCharges ?? 0,
      fertilizerCharges: (user.normalFertCharges ?? 0) + (user.superFertCharges ?? 0) + (user.advancedFertCharges ?? 0),
      // Raid stats
      dailyStealCount: user.lastStealDate === new Date().toISOString().slice(0, 10) ? (user.dailyStealCount ?? 0) : 0,
      maxDailySteals: 5,
    };
  }

  async claimDaily(userId: string) {
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

      const now = Date.now();
      const lastClaim = user.lastDailyClaim?.getTime() ?? 0;

      if ((now - lastClaim) < this.CLAIM_COOLDOWN_MS) {
        const nextAt = new Date(lastClaim + this.CLAIM_COOLDOWN_MS);
        throw new BadRequestException(`Already claimed. Next reward at ${nextAt.toISOString()}`);
      }

      const isConsecutive = lastClaim > 0 && (now - lastClaim) < this.STREAK_WINDOW_MS;
      const newStreak = isConsecutive ? user.dailyStreak + 1 : 1;
      const cycleDay   = ((newStreak - 1) % 7);
      const goldReward = this.DAILY_REWARDS[cycleDay];
      const userMaxEnergy = user.maxEnergy ?? this.MAX_ENERGY;
      const energyRestore = cycleDay === 6 ? userMaxEnergy : this.DAILY_ENERGY_RESTORE;
      const nextStreakReward = this.DAILY_REWARDS[newStreak % 7];

      // Compute passive energy regen inside the lock so it can't race with the claim
      const lastEnergyUpdate = user.lastEnergyUpdate?.getTime() ?? now;
      const elapsedHours = (now - lastEnergyUpdate) / 3600_000;
      const regenGained = Math.floor(elapsedHours * this.ENERGY_REGEN_PER_HOUR);
      const energyAfterRegen = Math.min(userMaxEnergy, user.energy + regenGained);
      const finalEnergy = Math.min(userMaxEnergy, energyAfterRegen + energyRestore);

      await qr.manager.update(User, userId, {
        goldBalance: () => `"gold_balance" + ${goldReward}`,
        energy: finalEnergy,
        trustScore: () => `LEAST(200, "trust_score" + 2)`,
        lastDailyClaim: new Date(),
        lastEnergyUpdate: new Date(),
        dailyStreak: newStreak,
      });

      await qr.manager.query(
        `INSERT INTO gold_transactions (user_id, amount, type, category, description) VALUES ($1, $2, 'MINT', 'DAILY_REWARD', $3)`,
        [userId, goldReward, `Day ${cycleDay + 1} daily reward`],
      ).catch(() => {});

      await qr.commitTransaction();
      return {
        goldReward,
        energyRestore,
        streak: newStreak,
        nextStreakReward,
        isMaxStreak: cycleDay === 6,
      };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * Link (or re-link) a BSC wallet.
   *
   * Canonicalised to lowercase, and this is load-bearing — not cosmetic. Wallets arrive
   * EIP-55 checksummed (viem's privateKeyToAccount().address), and Postgres compares
   * varchar case-sensitively. Every lookup in the codebase — notably
   * MarketplaceService.handleOffchainItemSold() — queries `wallet_address = lower(...)`,
   * so a checksummed row could never be found: seller/buyer lookups returned null, item
   * delivery never happened, and (since that handler throws rather than returns) the sweep
   * retried the same event forever. Storing lowercase makes writer and readers agree.
   *
   * Checksum casing remains a display concern; the chain treats both forms identically.
   *
   * ONE ACCOUNT, ONE WALLET. This used to be an unconditional UPDATE. Because the client
   * generates its key locally (localStorage), opening the same Telegram account on a
   * second device generated a SECOND key and silently overwrote wallet_address — the
   * account then reported a different wallet on every machine, and any $FARM already held
   * by the first wallet became unreachable (nobody holds that key any more). The client
   * now imports the existing key; the server refuses to move it.
   */
  async updateWalletAddress(userId: string, walletAddress: string): Promise<void> {
    const canonical = walletAddress.toLowerCase();
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.walletAddress && user.walletAddress.toLowerCase() !== canonical) {
      throw new ConflictException(
        "This account already has a linked wallet. Import that wallet's private key on " +
          'this device instead of creating a new one.',
      );
    }

    if (user.walletAddress === canonical) return; // already linked here — nothing to do

    // The DB also enforces this via UQ_users_wallet_address; checking first turns a raw
    // 23505 into an actionable 409 instead of a 500.
    const owner = await this.userRepo.findOne({
      where: { walletAddress: canonical },
      select: ['id'],
    });
    if (owner && owner.id !== userId) {
      throw new ConflictException('This wallet is already linked to another account');
    }

    await this.userRepo.update(userId, { walletAddress: canonical });
  }

  async unlinkWalletAddress(userId: string): Promise<void> {
    await this.userRepo.update(userId, { walletAddress: null as any });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByTelegramId(telegramId: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { telegramId } });
  }

  async getLeaderboard(requesterId: string, limit = 50, category: 'thieves' | 'rich' | 'streak' | 'farmer' = 'thieves') {
    type SortKey = 'goldStolen' | 'goldBalance' | 'dailyStreak' | 'totalHarvests';
    const sortKey: SortKey =
      category === 'rich'    ? 'goldBalance' :
      category === 'streak'  ? 'dailyStreak' :
      category === 'farmer'  ? 'totalHarvests' : 'goldStolen';

    const selectFields: (keyof User)[] = ['id', 'username', 'telegramId', 'goldStolen', 'goldBalance', 'dailyStreak', 'trustScore', 'totalHarvests'];

    const top = await this.userRepo.find({
      order: { [sortKey]: 'DESC', trustScore: 'DESC', id: 'ASC' },
      take: limit,
      select: selectFields,
    });

    const toEntry = (u: User, rank: number) => ({
      rank,
      userId: u.id,
      username: u.username ?? `Player${String(u.telegramId ?? '').slice(-4) || 'Anon'}`,
      goldStolen:    Number(u.goldStolen ?? 0),
      goldBalance:   Number(u.goldBalance ?? 0),
      dailyStreak:   u.dailyStreak ?? 0,
      trustScore:    u.trustScore ?? 50,
      totalHarvests: u.totalHarvests ?? 0,
      isMe: u.id === requesterId,
    });

    const entries = top.map((u, i) => toEntry(u, i + 1));

    const inTop = entries.some((e) => e.isMe);
    let myEntry: ReturnType<typeof toEntry> | null = null;

    if (!inTop) {
      const me = await this.userRepo.findOne({ where: { id: requesterId }, select: selectFields });
      if (me) {
        const myVal = me[sortKey as keyof User] ?? 0;
        const above = await this.userRepo.count({ where: { [sortKey]: MoreThan(myVal) } as never });
        myEntry = toEntry(me, above + 1);
      }
    }

    return { entries, myEntry, category };
  }

  async getFriends(userId: string) {
    const me = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'referredBy'],
    });
    if (!me) return [];

    // Bidirectional: people I recruited + person who recruited me
    const [recruited, referrer] = await Promise.all([
      this.userRepo.find({
        where: { referredBy: userId },
        select: ['id', 'username', 'telegramId'],
      }),
      me.referredBy
        ? this.userRepo.findOne({
            where: { id: me.referredBy },
            select: ['id', 'username', 'telegramId'],
          })
        : Promise.resolve(null),
    ]);

    // Merge: referrer first (if exists), then recruits; de-dupe by id
    const seen = new Set<string>();
    const allFriends: Array<{ id: string; username: string | null; telegramId: number; connection: 'invited_by' | 'invited' }> = [];

    if (referrer && !seen.has(referrer.id)) {
      seen.add(referrer.id);
      allFriends.push({ ...referrer, connection: 'invited_by' });
    }
    for (const u of recruited) {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        allFriends.push({ ...u, connection: 'invited' });
      }
    }

    if (allFriends.length === 0) return [];

    // Check ripe + stealable crops for each friend
    const now = new Date();
    const results = await Promise.all(
      allFriends.map(async (friend) => {
        // Check for any ripe AND stealable plot across all plots of this friend
        const stealablePlot = await this.plotRepo
          .createQueryBuilder('p')
          .innerJoin(SeedConfig, 'sc', 'sc.id = p.seed_id')
          .where('p.user_id = :uid', { uid: friend.id })
          .andWhere('p.seed_id IS NOT NULL')
          .andWhere('p.harvestable_at <= :now', { now })
          .andWhere('p.total_stolen < sc.base_yield * 0.20')
          .getOne();

        const ripePlot = stealablePlot
          ? stealablePlot
          : await this.plotRepo
              .createQueryBuilder('p')
              .where('p.user_id = :uid', { uid: friend.id })
              .andWhere('p.seed_id IS NOT NULL')
              .andWhere('p.harvestable_at <= :now', { now })
              .getOne();

        return {
          userId: friend.id,
          username: friend.username ?? `Player${String(friend.telegramId ?? '').slice(-4) || 'Anon'}`,
          hasRipeCrops: !!ripePlot,
          isStealable: !!stealablePlot,
          connection: friend.connection,
        };
      }),
    );

    return results;
  }

  async grantItem(userId: string, itemType: string, quantity: number): Promise<void> {
    const existing = await this.itemRepo.findOne({ where: { userId, itemType } });
    if (existing) {
      await this.itemRepo.increment({ id: existing.id }, 'quantity', quantity);
    } else {
      await this.itemRepo.save(
        this.itemRepo.create({
          userId,
          itemType,
          quantity,
          lockedQuantity: 0,
        }),
      );
    }
  }

  async checkAndGrantMasterKeys(referrerId: string): Promise<number> {
    // Count how many referred users have reached level >= 3 OR trustScore >= 30
    const [level3Count, rewardedRewards] = await Promise.all([
      this.userRepo.count({
        where: [
          { referredBy: referrerId, level: MoreThanOrEqual(3) },
          { referredBy: referrerId, trustScore: MoreThanOrEqual(30) },
        ],
      }),
      this.referralRewardRepo.find({
        where: { referrerId, rewardType: 'master_key' },
        order: { milestoneCount: 'DESC' },
      }),
    ]);

    const eligibleKeys = Math.floor(level3Count / 3);
    const keysAlreadyAwarded = rewardedRewards.length;
    const keysToAward = eligibleKeys - keysAlreadyAwarded;

    if (keysToAward > 0) {
      for (let i = 0; i < keysToAward; i++) {
        const milestone = (keysAlreadyAwarded + i + 1) * 3;
        await this.referralRewardRepo.save(
          this.referralRewardRepo.create({
            referrerId,
            rewardType: 'master_key',
            milestoneCount: milestone,
          }),
        );
      }
      await this.grantItem(referrerId, 'master_key', keysToAward);

      const referrer = await this.userRepo.findOne({
        where: { id: referrerId },
        select: ['id', 'telegramId'],
      });
      if (referrer) {
        void this.notificationService
          .notifyMasterKeyAwarded(referrer.id, Number(referrer.telegramId), keysToAward)
          .catch(() => {});
      }
    }

    return keysToAward;
  }

  async getReferralInfo(user: User, botUsername: string) {
    // Check and grant any pending master keys for friends who hit Lvl 3
    await this.checkAndGrantMasterKeys(user.id).catch(() => {});

    const [recruits, rewards] = await Promise.all([
      this.userRepo.find({
        where: { referredBy: user.id },
        select: ['id', 'username', 'level', 'trustScore', 'createdAt'],
        order: { createdAt: 'DESC' },
      }),
      this.referralRewardRepo.find({
        where: { referrerId: user.id },
      }),
    ]);

    const referralCount = recruits.length;
    const bonusPerReferral = 120;
    const inviteLink = `https://t.me/${botUsername}?startapp=ref_${user.telegramId}`;
    const shareText = `🥷 Join me in Bandit Buddy! Plant crops, steal from friends & earn $FARM token. Use my invite link:`;

    const level3FriendsCount = recruits.filter((r) => (r.level ?? 1) >= 3 || (r.trustScore ?? 0) >= 30).length;
    const masterKeyProgress = level3FriendsCount % 3;
    const masterKeysEarned = rewards.filter((r) => r.rewardType === 'master_key').length;
    const multiplier = this.launchConfig.getRefMagnifierMultiplier() || 1;
    const magnifiersEarned = rewards.filter((r) => r.rewardType === 'magnifying_glass').length * multiplier;

    const crew = recruits.map((r) => {
      const effectiveLevel = Math.max(r.level ?? 1, Math.floor((r.trustScore ?? 0) / 10));
      return {
        id: r.id,
        username: r.username ?? 'Neighbor',
        level: effectiveLevel,
        isLevel3: effectiveLevel >= 3,
        status: effectiveLevel >= 3 ? 'Level 3 Reached' : 'Grinding',
      };
    });

    return {
      referralCount,
      bonusEarned: referralCount * bonusPerReferral,
      bonusPerReferral,
      inviteLink,
      shareText,
      level3FriendsCount,
      masterKeyProgress,
      masterKeyTarget: 3,
      masterKeysEarned,
      magnifiersEarned,
      isLaunchEventActive: this.launchConfig.isLaunchEventActive(),
      magnifierMultiplier: this.launchConfig.getRefMagnifierMultiplier(),
      guildWaterBoost: this.launchConfig.getGuildNewMemberWaterBoost(),
      crew,
    };
  }

  async setNotifications(userId: string, enabled: boolean): Promise<void> {
    await this.userRepo.update(userId, { notificationsEnabled: enabled });
  }

  // Search players by username (min 2 chars)
  async searchUsers(currentUserId: string, query: string) {
    const q = (query ?? '').trim();
    if (q.length < 2) return [];

    const users = await this.userRepo.find({
      where: { username: ILike(`%${q}%`) },
      select: ['id', 'username'],
      take: 10,
    });

    return users
      .filter((u) => u.id !== currentUserId && u.username)
      .map((u) => ({ userId: u.id, username: u.username }));
  }

  // Returns up to 20 players with ripe stealable crops, backfilled with active farms if needed
  async getExploreFarms(currentUserId: string) {
    const now = new Date();

    const rows = await this.plotRepo
      .createQueryBuilder('p')
      .select([
        'u.id AS "userId"',
        'u.username AS "username"',
        'CAST(COUNT(p.id) AS INTEGER) AS "ripePlots"',
        `EXISTS(SELECT 1 FROM nft_guard_dogs d WHERE d.owner_id = u.id AND d.is_active = true AND d.is_guarding = true AND d.listing_id IS NULL) AS "hasGuardDog"`,
        `(SELECT d2.dog_type FROM nft_guard_dogs d2 WHERE d2.owner_id = u.id AND d2.is_active = true AND d2.is_guarding = true AND d2.listing_id IS NULL ORDER BY d2.defense_power DESC LIMIT 1) AS "guardDogType"`,
        `COALESCE((SELECT d3.defense_power FROM nft_guard_dogs d3 WHERE d3.owner_id = u.id AND d3.is_active = true AND d3.is_guarding = true AND d3.listing_id IS NULL ORDER BY d3.defense_power DESC LIMIT 1), 0) AS "guardDogDefense"`,
      ])
      .innerJoin('users', 'u', 'u.id = p.user_id')
      .innerJoin('seed_configs', 'sc', 'sc.id = p.seed_id')
      .where('p.harvestable_at <= :now', { now })
      .andWhere('p.total_stolen < sc.base_yield * 0.20')
      .andWhere('u.id != :id', { id: currentUserId })
      .andWhere('u.username IS NOT NULL')
      .groupBy('u.id, u.username')
      .orderBy('COUNT(p.id)', 'DESC')
      .limit(20)
      .getRawMany<{ userId: string; username: string; ripePlots: number; hasGuardDog: boolean; guardDogType: string | null; guardDogDefense: number }>();

    const filtered = rows.filter((r) => Number(r.ripePlots) > 0);

    // If fewer than 10 targets with ripe crops, backfill with active neighbor farms so explore is never empty
    if (filtered.length < 10) {
      const excludeIds = [currentUserId, ...filtered.map((r) => r.userId)];
      const backfill = await this.plotRepo
        .createQueryBuilder('p')
        .select([
          'u.id AS "userId"',
          'u.username AS "username"',
          'CAST(0 AS INTEGER) AS "ripePlots"',
          `EXISTS(SELECT 1 FROM nft_guard_dogs d WHERE d.owner_id = u.id AND d.is_active = true AND d.is_guarding = true AND d.listing_id IS NULL) AS "hasGuardDog"`,
          `(SELECT d2.dog_type FROM nft_guard_dogs d2 WHERE d2.owner_id = u.id AND d2.is_active = true AND d2.is_guarding = true AND d2.listing_id IS NULL ORDER BY d2.defense_power DESC LIMIT 1) AS "guardDogType"`,
          `COALESCE((SELECT d3.defense_power FROM nft_guard_dogs d3 WHERE d3.owner_id = u.id AND d3.is_active = true AND d3.is_guarding = true AND d3.listing_id IS NULL ORDER BY d3.defense_power DESC LIMIT 1), 0) AS "guardDogDefense"`,
        ])
        .innerJoin('users', 'u', 'u.id = p.user_id')
        .where('p.seed_id IS NOT NULL')
        .andWhere('u.id NOT IN (:...excludeIds)', { excludeIds })
        .andWhere('u.username IS NOT NULL')
        .groupBy('u.id, u.username, u.updated_at')
        .orderBy('u.updated_at', 'DESC')
        .limit(10 - filtered.length)
        .getRawMany<{ userId: string; username: string; ripePlots: number; hasGuardDog: boolean; guardDogType: string | null; guardDogDefense: number }>();

      filtered.push(...backfill);
    }

    return filtered;
  }

  async applyReferral(newUserId: string, referrerTelegramId: number): Promise<void> {
    const referrer = await this.userRepo.findOne({ where: { telegramId: referrerTelegramId } });
    if (!referrer || referrer.id === newUserId) return;

    await this.userRepo.update(newUserId, { referredBy: referrer.id });

    // Bonus gold for referrer
    const REFERRAL_BONUS = 120;
    await this.userRepo.increment({ id: referrer.id }, 'goldBalance', REFERRAL_BONUS);

    // PVP-03: Grant Magnifying Glass to referrer
    const magnifierQty = 1 * this.launchConfig.getRefMagnifierMultiplier(); // 2 during launch event, 1 normally
    if (magnifierQty > 0) {
      await this.grantItem(referrer.id, 'magnifying_glass', magnifierQty);
      await this.referralRewardRepo.save(
        this.referralRewardRepo.create({
          referrerId: referrer.id,
          rewardType: 'magnifying_glass',
          referredUserId: newUserId,
          milestoneCount: 1,
        }),
      );
    }

    // Notify referrer (non-blocking)
    const newUser = await this.userRepo.findOne({ where: { id: newUserId }, select: ['username'] });
    void this.notificationService
      .notifyReferralBonus(
        referrer.id,
        Number(referrer.telegramId),
        newUser?.username ?? 'A new player',
        REFERRAL_BONUS,
        magnifierQty,
      )
      .catch(() => {});
  }

  async getAchievements(userId: string) {
    const [user, successfulSteals, referralCount] = await Promise.all([
      this.userRepo.findOne({
        where: { id: userId },
        select: ['id', 'totalHarvests', 'totalPlants', 'totalAttacks', 'totalWaters', 'goldStolen', 'dailyStreak'],
      }),
      this.stealLogRepo.count({ where: { thiefId: userId, success: true } }),
      this.userRepo.count({ where: { referredBy: userId } }),
    ]);

    if (!user) throw new NotFoundException('User not found');

    const h  = user.totalHarvests ?? 0;
    const p  = user.totalPlants ?? 0;
    const a  = user.totalAttacks ?? 0;
    const w  = user.totalWaters ?? 0;
    const s  = successfulSteals;
    const gs = Number(user.goldStolen);
    const streak = user.dailyStreak;
    const refs = referralCount;

    type AchievementDef = {
      id: string; emoji: string; name: string; description: string;
      category: string; progress: number; target: number;
    };

    const defs: AchievementDef[] = [
      // 🌾 Harvest
      { id: 'first_harvest',  emoji: '🌾', name: 'First Harvest',   category: 'farmer', description: 'Harvest your first crop',    progress: Math.min(h, 1),    target: 1    },
      { id: 'harvest_10',     emoji: '🌾', name: 'Busy Farmer',     category: 'farmer', description: 'Harvest 10 crops',           progress: Math.min(h, 10),   target: 10   },
      { id: 'harvest_50',     emoji: '🌾', name: 'Seasoned Farmer', category: 'farmer', description: 'Harvest 50 crops',           progress: Math.min(h, 50),   target: 50   },
      { id: 'harvest_100',    emoji: '🌾', name: 'Master Farmer',   category: 'farmer', description: 'Harvest 100 crops',          progress: Math.min(h, 100),  target: 100  },
      { id: 'harvest_300',    emoji: '🌾', name: 'Legendary Farmer',category: 'farmer', description: 'Harvest 300 crops',          progress: Math.min(h, 300),  target: 300  },
      // 🌱 Planter
      { id: 'first_plant',    emoji: '🌱', name: 'Green Thumb',     category: 'farmer', description: 'Plant your first seed',      progress: Math.min(p, 1),    target: 1    },
      { id: 'plant_50',       emoji: '🌱', name: 'Seed Sower',      category: 'farmer', description: 'Plant 50 seeds',             progress: Math.min(p, 50),   target: 50   },
      { id: 'plant_100',      emoji: '🌱', name: 'Seed Master',     category: 'farmer', description: 'Plant 100 seeds',            progress: Math.min(p, 100),  target: 100  },
      // 💧 Waterer
      { id: 'water_5',        emoji: '💧', name: 'Diligent',        category: 'farmer', description: 'Water 5 crops',              progress: Math.min(w, 5),    target: 5    },
      { id: 'water_20',       emoji: '💧', name: 'Water Keeper',    category: 'farmer', description: 'Water 20 crops',             progress: Math.min(w, 20),   target: 20   },
      // 🥷 Raider
      { id: 'first_steal',    emoji: '🥷', name: 'Bandit',          category: 'raider', description: 'Successfully steal from a farm',  progress: Math.min(s, 1),   target: 1   },
      { id: 'steal_10',       emoji: '🥷', name: 'Seasoned Thief',  category: 'raider', description: 'Steal successfully 10 times',     progress: Math.min(s, 10),  target: 10  },
      { id: 'steal_50',       emoji: '🥷', name: 'Master Raider',   category: 'raider', description: 'Steal successfully 50 times',     progress: Math.min(s, 50),  target: 50  },
      // 💰 Gold stolen
      { id: 'gold_100',   emoji: '💰', name: 'Petty Thief',     category: 'raider', description: 'Steal 100G total',    progress: Math.min(gs, 100),   target: 100   },
      { id: 'gold_500',   emoji: '💰', name: 'Gold Grabber',    category: 'raider', description: 'Steal 500G total',    progress: Math.min(gs, 500),   target: 500   },
      { id: 'gold_2000',  emoji: '💰', name: 'Kingpin',         category: 'raider', description: 'Steal 2000G total',   progress: Math.min(gs, 2000),  target: 2000  },
      // 🐛 Saboteur
      { id: 'attack_1',   emoji: '🐛', name: 'Troublemaker',   category: 'raider', description: 'Sabotage 1 neighbor crop',    progress: Math.min(a, 1),   target: 1   },
      { id: 'attack_5',   emoji: '🐛', name: 'Pest Spreader',  category: 'raider', description: 'Sabotage 5 neighbor crops',   progress: Math.min(a, 5),   target: 5   },
      { id: 'attack_20',  emoji: '🐛', name: 'Chaos Agent',    category: 'raider', description: 'Sabotage 20 neighbor crops',  progress: Math.min(a, 20),  target: 20  },
      // 🔥 Streak
      { id: 'streak_3',   emoji: '🔥', name: 'On Fire',         category: 'streak', description: 'Reach a 3-day login streak',   progress: Math.min(streak, 3),  target: 3  },
      { id: 'streak_7',   emoji: '👑', name: 'Unstoppable',     category: 'streak', description: 'Reach a 7-day login streak',   progress: Math.min(streak, 7),  target: 7  },
      { id: 'streak_14',  emoji: '⭐', name: 'Dedicated',       category: 'streak', description: 'Reach a 14-day login streak',  progress: Math.min(streak, 14), target: 14 },
      { id: 'streak_30',  emoji: '🌟', name: 'Obsessed',        category: 'streak', description: 'Reach a 30-day login streak',  progress: Math.min(streak, 30), target: 30 },
      // 👥 Social
      { id: 'first_ref',  emoji: '🎉', name: 'Recruiter',       category: 'social', description: 'Invite 1 friend',   progress: Math.min(refs, 1),  target: 1  },
      { id: 'refs_5',     emoji: '🎉', name: 'Gang Leader',     category: 'social', description: 'Invite 5 friends',  progress: Math.min(refs, 5),  target: 5  },
      { id: 'refs_10',    emoji: '🎉', name: 'Community Boss',  category: 'social', description: 'Invite 10 friends', progress: Math.min(refs, 10), target: 10 },
    ];

    return defs.map((d) => ({
      ...d,
      unlocked: d.progress >= d.target,
      pct: Math.round((d.progress / d.target) * 100),
    }));
  }
}
