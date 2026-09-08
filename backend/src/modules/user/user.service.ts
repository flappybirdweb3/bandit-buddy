import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from './entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FarmPlot)
    private readonly plotRepo: Repository<FarmPlot>,
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
}
