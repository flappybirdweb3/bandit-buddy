import { Controller, Get, Post, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { QuestService } from './quest.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

@Controller('quest')
@UseGuards(TelegramAuthGuard)
export class QuestController {
  constructor(private readonly questService: QuestService) {}

  @Get('daily')
  getDailyQuests(@CurrentUser() user: User) {
    return this.questService.getDailyQuests(user.id);
  }

  @Post('daily/:id/claim')
  claimReward(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) questId: string,
  ) {
    return this.questService.claimReward(user.id, questId);
  }
}
