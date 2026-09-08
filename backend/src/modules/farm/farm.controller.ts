import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { FarmService } from './farm.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

@Controller('farm')
@UseGuards(TelegramAuthGuard)
export class FarmController {
  constructor(private readonly farmService: FarmService) {}

  @Get('seeds')
  async getSeeds() {
    return this.farmService.getSeeds();
  }

  @Get('my')
  async getMyFarm(@CurrentUser() user: User) {
    await this.farmService.ensureInitialPlots(user.id);
    return this.farmService.getFarm(user.id);
  }

  @Get(':userId')
  async getFarm(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.farmService.getFarm(userId);
  }
}
