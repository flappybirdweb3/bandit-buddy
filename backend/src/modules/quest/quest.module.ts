import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestController } from './quest.controller';
import { QuestService } from './quest.service';
import { QuestDefinition } from './entities/quest-definition.entity';
import { UserDailyQuest } from './entities/user-daily-quest.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QuestDefinition, UserDailyQuest, User])],
  controllers: [QuestController],
  providers: [QuestService],
  exports: [QuestService],
})
export class QuestModule {}
