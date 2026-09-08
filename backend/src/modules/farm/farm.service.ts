import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FarmPlot } from './entities/farm-plot.entity';
import { SeedConfig } from './entities/seed-config.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class FarmService {
  constructor(
    @InjectRepository(FarmPlot)
    private readonly plotRepo: Repository<FarmPlot>,
    @InjectRepository(SeedConfig)
    private readonly seedRepo: Repository<SeedConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async getFarm(targetUserId: string) {
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    const plots = await this.plotRepo.find({
      where: { userId: targetUserId },
      relations: ['seed'],
      order: { plotIndex: 'ASC' },
    });

    const now = Date.now();

    return {
      userId: targetUserId,
      username: user.username,
      plots: plots.map((plot) => ({
        id: plot.id,
        plotIndex: plot.plotIndex,
        isEmpty: !plot.seedId,
        seed: plot.seed
          ? {
              id: plot.seed.id,
              name: plot.seed.name,
              iconKey: plot.seed.iconKey,
              baseYield: Number(plot.seed.baseYield),
            }
          : null,
        plantedAt: plot.plantedAt,
        harvestableAt: plot.harvestableAt,
        isRipe: plot.harvestableAt ? now >= plot.harvestableAt.getTime() : false,
        totalStolen: Number(plot.totalStolen),
        stealableRemaining: plot.seed
          ? Math.max(0, Number(plot.seed.baseYield) * 0.20 - Number(plot.totalStolen))
          : 0,
        lastStolenAt: plot.lastStolenAt,
      })),
    };
  }

  async ensureInitialPlots(userId: string): Promise<void> {
    const existingCount = await this.plotRepo.count({ where: { userId } });
    if (existingCount > 0) return;

    const initialPlots = (this.config.get<number>('game.initialPlots')) ?? 6;
    const plots: Partial<FarmPlot>[] = Array.from({ length: initialPlots }, (_, i) => ({
      userId,
      plotIndex: i,
    }));
    await this.plotRepo.save(plots as FarmPlot[]);
  }

  async getSeeds(): Promise<SeedConfig[]> {
    return this.seedRepo.find({ order: { costGold: 'ASC' } });
  }
}
