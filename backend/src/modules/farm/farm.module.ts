import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmController } from './farm.controller';
import { FarmService } from './farm.service';
import { FarmPlot } from './entities/farm-plot.entity';
import { SeedConfig } from './entities/seed-config.entity';
import { StealLog } from './entities/steal-log.entity';
import { NftGuardDog } from './entities/nft-guard-dog.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FarmPlot, SeedConfig, StealLog, NftGuardDog, User])],
  controllers: [FarmController],
  providers: [FarmService],
  exports: [FarmService, TypeOrmModule],
})
export class FarmModule {}
