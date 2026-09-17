import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { AdminController } from './admin.controller';
import { UserService } from './user.service';
import { LaunchConfigService } from './launch-config.service';
import { User } from './entities/user.entity';
import { UserItem } from './entities/user-item.entity';
import { ReferralReward } from './entities/referral-reward.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';
import { StealLog } from '../farm/entities/steal-log.entity';
import { Web3Module } from '../web3/web3.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserItem, ReferralReward, FarmPlot, SeedConfig, StealLog]),
    Web3Module,
  ],
  controllers: [UserController, AdminController],
  providers: [UserService, LaunchConfigService],
  exports: [UserService, LaunchConfigService, TypeOrmModule],
})
export class UserModule {}
