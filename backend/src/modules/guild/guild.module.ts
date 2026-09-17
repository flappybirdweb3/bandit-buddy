import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guild } from './entities/guild.entity';
import { GuildMember } from './entities/guild-member.entity';
import { Subscription } from './entities/subscription.entity';
import { GuildService } from './guild.service';
import { GuildController } from './guild.controller';
import { SubscriptionController } from './subscription.controller';
import { User } from '../user/entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';
import { SeedConfig } from '../farm/entities/seed-config.entity';

import { TreeContribution } from './entities/tree-contribution.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Guild, GuildMember, Subscription, User, FarmPlot, SeedConfig, TreeContribution]),
    forwardRef(() => UserModule),
  ],
  controllers: [GuildController, SubscriptionController],
  providers: [GuildService],
  exports: [GuildService, TypeOrmModule],
})
export class GuildModule {}
