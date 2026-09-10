import { Controller, Get, Post, Delete, UseGuards, HttpCode } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { TelegramAuthGuard } from '../../common/guards/telegram-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

@Controller('notification')
@UseGuards(TelegramAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('inbox')
  getInbox(@CurrentUser() user: User) {
    return this.notificationService.getInbox(user.id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.notificationService.markAllRead(user.id);
  }

  @Delete('clear')
  @HttpCode(204)
  clearAll(@CurrentUser() user: User) {
    return this.notificationService.clearAll(user.id);
  }

  // Dev-only: trigger the harvest-ready cron manually
  @Post('trigger-harvest-check')
  @HttpCode(200)
  async triggerHarvestCheck() {
    if (process.env.NODE_ENV === 'production') return { skipped: true };
    await this.notificationService.notifyRipeHarvests();
    return { ok: true };
  }
}
