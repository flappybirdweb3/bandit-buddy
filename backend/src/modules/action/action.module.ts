import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';
import { StealLog } from '../farm/entities/steal-log.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FarmPlot, SeedConfig, StealLog, NftGuardDog, User])],
  controllers: [ActionController],
  providers: [ActionService],
})
export class ActionModule {}
