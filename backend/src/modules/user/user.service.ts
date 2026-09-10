import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, ILike } from 'typeorm';
import { User } from './entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';
import { StealLog } from '../farm/entities/steal-log.entity';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FarmPlot)
    private readonly plotRepo: Repository<FarmPlot>,
    @InjectRepository(SeedConfig)
    private readonly seedRepo: Repository<SeedConfig>,
    @InjectRepository(StealLog)
    private readonly stealLogRepo: Repository<StealLog>,
    private readonly notificationService: NotificationService,
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
    };
  }

  async claimDaily(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const now = Date.now();
    const lastClaim = user.lastDailyClaim?.getTime() ?? 0;

    if ((now - lastClaim) < this.CLAIM_COOLDOWN_MS) {
      const nextAt = new Date(lastClaim + this.CLAIM_COOLDOWN_MS);
      throw new BadRequestException(`Already claimed. Next reward at ${nextAt.toISOString()}`);
    }

    const isConsecutive = lastClaim > 0 && (now - lastClaim) < this.STREAK_WINDOW_MS;
    const newStreak = isConsecutive ? user.dailyStreak + 1 : 1;
    const cycleDay   = ((newStreak - 1) % 7);          // 0-6, repeats every 7 days
    const goldReward = this.DAILY_REWARDS[cycleDay];
    const energyRestore = cycleDay === 6 ? this.MAX_ENERGY : this.DAILY_ENERGY_RESTORE;
    const nextStreakReward = this.DAILY_REWARDS[newStreak % 7];

    await this.userRepo.update(userId, {
      goldBalance: () => `"gold_balance" + ${goldReward}`,
      energy: () => `LEAST(${this.MAX_ENERGY}, "energy" + ${energyRestore})`,
      trustScore: () => `LEAST(200, "trust_score" + 2)`,
      lastDailyClaim: new Date(),
      lastEnergyUpdate: new Date(),
      dailyStreak: newStreak,
    });

    return {
      goldReward,
      energyRestore,
      streak: newStreak,
      nextStreakReward,
      isMaxStreak: cycleDay === 6,
    };
  }

  async updateWalletAddress(userId: string, walletAddress: string): Promise<void> {
    await this.userRepo.update(userId, { walletAddress });
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

    const selectFields: (keyof User)[] = ['id', 'username', 'goldStolen', 'goldBalance', 'dailyStreak', 'trustScore', 'totalHarvests'];

    const top = await this.userRepo.find({
      order: { [sortKey]: 'DESC' },
      take: limit,
      select: selectFields,
    });

    const toEntry = (u: User, rank: number) => ({
      rank,
      userId: u.id,
      username: u.username ?? `Player${String(u.telegramId ?? '').slice(-4)}`,
      goldStolen:    Number(u.goldStolen),
      goldBalance:   Number(u.goldBalance),
      dailyStreak:   u.dailyStreak,
      trustScore:    u.trustScore,
      totalHarvests: u.totalHarvests ?? 0,
      isMe: u.id === requesterId,
    });

    const entries = top.map((u, i) => toEntry(u, i + 1));

    const inTop = entries.some((e) => e.isMe);
    let myEntry: ReturnType<typeof toEntry> | null = null;

    if (!inTop) {
      const me = await this.userRepo.findOne({ where: { id: requesterId }, select: selectFields });
      if (me) {
        const myVal = me[sortKey as keyof User];
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
        const ripePlot = await this.plotRepo
          .createQueryBuilder('p')
          .where('p.user_id = :uid', { uid: friend.id })
          .andWhere('p.seed_id IS NOT NULL')
          .andWhere('p.harvestable_at <= :now', { now })
          .getOne();

        const stealablePlot = ripePlot
          ? await this.plotRepo
              .createQueryBuilder('p')
              .innerJoin(SeedConfig, 'sc', 'sc.id = p.seed_id')
              .where('p.id = :pid', { pid: ripePlot.id })
              .andWhere('p.total_stolen < sc.base_yield * 0.20')
              .getOne()
          : null;

        return {
          userId: friend.id,
          username: friend.username ?? `Player${String(friend.telegramId).slice(-4)}`,
          hasRipeCrops: !!ripePlot,
          isStealable: !!stealablePlot,
          connection: friend.connection,
        };
      }),
    );

    return results;
  }

  async getReferralInfo(user: User, botUsername: string) {
    const referralCount = await this.userRepo.count({ where: { referredBy: user.id } });
    const bonusPerReferral = 120;
    const inviteLink = `https://t.me/${botUsername}?startapp=ref_${user.telegramId}`;
    const shareText = `🥷 Join me in Bandit Buddy! Plant crops, steal from friends & earn $FARM token. Use my invite link:`;

    return {
      referralCount,
      bonusEarned: referralCount * bonusPerReferral,
      bonusPerReferral,
      inviteLink,
      shareText,
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

  // Returns up to 20 players who currently have ripe stealable crops
  async getExploreFarms(currentUserId: string) {
    const now = new Date();

    const rows = await this.plotRepo
      .createQueryBuilder('p')
      .select([
        'u.id AS "userId"',
        'u.username AS "username"',
        'CAST(COUNT(p.id) AS INTEGER) AS "ripePlots"',
        `EXISTS(SELECT 1 FROM nft_guard_dogs d WHERE d.owner_id = u.id AND d.is_active = true) AS "hasGuardDog"`,
        `(SELECT d2.dog_type FROM nft_guard_dogs d2 WHERE d2.owner_id = u.id AND d2.is_active = true ORDER BY d2.defense_power DESC LIMIT 1) AS "guardDogType"`,
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
      .getRawMany<{ userId: string; username: string; ripePlots: number; hasGuardDog: boolean; guardDogType: string | null }>();

    return rows.filter((r) => r.ripePlots > 0);
  }

  async applyReferral(newUserId: string, referrerTelegramId: number): Promise<void> {
    const referrer = await this.userRepo.findOne({ where: { telegramId: referrerTelegramId } });
    if (!referrer || referrer.id === newUserId) return;

    await this.userRepo.update(newUserId, { referredBy: referrer.id });
    // Bonus gold for referrer
    const REFERRAL_BONUS = 25;
    await this.userRepo.increment({ id: referrer.id }, 'goldBalance', REFERRAL_BONUS);
    // Notify referrer (non-blocking)
    const newUser = await this.userRepo.findOne({ where: { id: newUserId }, select: ['username'] });
    void this.notificationService
      .notifyReferralBonus(
        referrer.id,
        Number(referrer.telegramId),
        newUser?.username ?? 'A new player',
        REFERRAL_BONUS,
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
