import { Controller, Get, Post, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
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

  @Get('weather/today')
  getWeather() {
    return this.farmService.getTodayWeather();
  }

  @Get('my')
  async getMyFarm(@CurrentUser() user: User) {
    await this.farmService.ensureInitialPlots(user.id);
    return this.farmService.getFarm(user.id);
  }

  @Post('buy-plot')
  async buyPlot(@CurrentUser() user: User) {
    return this.farmService.buyPlot(user.id);
  }

  @Post('upgrade-plot')
  async upgradePlot(@CurrentUser() user: User, @Body('plotId') plotId: string) {
    return this.farmService.upgradePlot(user.id, plotId);
  }

  @Get(':userId')
  async getFarm(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.farmService.getFarm(userId);
  }
}
