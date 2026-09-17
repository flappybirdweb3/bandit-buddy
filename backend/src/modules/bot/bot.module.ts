import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { User } from '../user/entities/user.entity';
import { FarmPlot } from '../farm/entities/farm-plot.entity';

import { GuildModule } from '../guild/guild.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, FarmPlot]), GuildModule, UserModule],
  controllers: [BotController],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
