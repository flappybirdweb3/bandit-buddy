import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}
