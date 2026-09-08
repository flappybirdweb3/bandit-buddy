import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from './entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FarmPlot)
    private readonly plotRepo: Repository<FarmPlot>,
    @InjectRepository(SeedConfig)
    private readonly seedRepo: Repository<SeedConfig>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const plotCount = await this.plotRepo.count({ where: { userId } });

    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      walletAddress: user.walletAddress,
      goldBalance: Number(user.goldBalance),
      energy: user.energy,
      trustScore: user.trustScore,
      plotCount,
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

  async getLeaderboard(requesterId: string, limit = 50) {
    const top = await this.userRepo.find({
      order: { goldBalance: 'DESC' },
      take: limit,
      select: ['id', 'username', 'goldBalance', 'trustScore'],
    });

    const entries = top.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      username: u.username ?? `Player${String(u.telegramId ?? '').slice(-4)}`,
      goldBalance: Number(u.goldBalance),
      trustScore: u.trustScore,
      isMe: u.id === requesterId,
    }));

    // If requester is not in top, find their rank
    const inTop = entries.some((e) => e.isMe);
    let myEntry: (typeof entries)[0] | null = null;

    if (!inTop) {
      const me = await this.userRepo.findOne({
        where: { id: requesterId },
        select: ['id', 'username', 'goldBalance', 'trustScore'],
      });
      if (me) {
        const above = await this.userRepo.count({
          where: { goldBalance: MoreThan(me.goldBalance) },
        });
        myEntry = {
          rank: above + 1,
          userId: me.id,
          username: me.username ?? 'You',
          goldBalance: Number(me.goldBalance),
          trustScore: me.trustScore,
          isMe: true,
        };
      }
    }

    return { entries, myEntry };
  }

  async getFriends(userId: string) {
    // Friends = users who were referred by this user
    const referred = await this.userRepo.find({
      where: { referredBy: userId },
      select: ['id', 'username', 'telegramId'],
    });

    if (referred.length === 0) return [];

    // Check which friends have ripe harvestable plots
    const now = new Date();
    const results = await Promise.all(
      referred.map(async (friend) => {
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
        };
      }),
    );

    return results;
  }

  async getReferralInfo(user: User, botUsername: string) {
    const referralCount = await this.userRepo.count({ where: { referredBy: user.id } });
    const bonusPerReferral = 25;
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

  async applyReferral(newUserId: string, referrerTelegramId: number): Promise<void> {
    const referrer = await this.userRepo.findOne({ where: { telegramId: referrerTelegramId } });
    if (!referrer || referrer.id === newUserId) return;

    await this.userRepo.update(newUserId, { referredBy: referrer.id });
    // Bonus gold for referrer
    await this.userRepo.increment({ id: referrer.id }, 'goldBalance', 25);
  }
}
