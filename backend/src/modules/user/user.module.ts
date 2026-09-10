import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { AdminController } from './admin.controller';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';
import { StealLog } from '../farm/entities/steal-log.entity';
import { Web3Module } from '../web3/web3.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, FarmPlot, SeedConfig, StealLog]), Web3Module],
  controllers: [UserController, AdminController],
  providers: [UserService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
